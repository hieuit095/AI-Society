//! Async LLM inference client — issues HTTP requests to agent-assigned
//! provider endpoints (OpenAI-compatible or Ollama) and returns generated text.
//!
//! ## Design Constraints
//!
//! - **Must be `Send + 'static`**: All context structs are fully owned so they
//!   can cross `tokio::spawn` boundaries without lifetime issues.
//! - **Graceful Degradation**: If the provider is unreachable or returns an error,
//!   we fall back to a deterministic `MESSAGE_TEMPLATES` entry so the simulation
//!   never stalls.
//! - **Timeout**: Each inference call is hard-capped at 10 seconds to prevent
//!   a single slow provider from blocking the entire tick.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use society_core::channels::MESSAGE_TEMPLATES;
use std::time::Duration;
use tracing::warn;

/// Reusable HTTP client — should be constructed once and cloned into tasks.
/// Cloning a `reqwest::Client` is cheap (inner `Arc`).
static LLM_TIMEOUT: Duration = Duration::from_secs(10);

/// Fully-owned context for a single speaker's LLM inference call.
/// All fields are `String` / owned so this struct is `Send + 'static`.
#[derive(Debug, Clone)]
pub struct SpeakerContext {
    /// Agent display name (e.g., "NEXUS-7").
    pub agent_name: String,
    /// Agent role display name (e.g., "CEO Agent").
    pub agent_role: String,
    /// The fully assembled system prompt (identity + soul + tools + channel activity).
    pub system_prompt: String,
    /// The provider endpoint URL (e.g., "http://localhost:11434/api" or "https://api.openai.com/v1").
    pub provider_endpoint: String,
    /// The model identifier (e.g., "llama3.3:8b", "gpt-4o").
    pub model: String,
    /// Maximum retries on failure.
    pub max_retries: u32,
    /// A deterministic fallback index into MESSAGE_TEMPLATES.
    pub fallback_template_idx: usize,
}

/// Provider response metadata captured from a completed inference turn.
#[derive(Debug, Clone)]
pub struct InferenceResult {
    pub content: String,
    pub total_tokens: u32,
    pub model: String,
}

/// Errors that can occur during LLM inference.
#[derive(Debug)]
pub enum LlmError {
    /// HTTP transport or connection error.
    Network(String),
    /// Provider returned a non-2xx status.
    ProviderError(u16, String),
    /// Failed to parse the response body.
    ParseError(String),
    /// The request exceeded the timeout.
    Timeout,
}

impl std::fmt::Display for LlmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Network(e) => write!(f, "Network error: {e}"),
            Self::ProviderError(status, body) => {
                write!(f, "Provider returned {status}: {body}")
            }
            Self::ParseError(e) => write!(f, "Parse error: {e}"),
            Self::Timeout => write!(f, "Inference request timed out"),
        }
    }
}

// ─────────────────────────────────────────────
// Ollama Request/Response (POST /api/generate)
// ─────────────────────────────────────────────

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    system: String,
    stream: bool,
}

#[derive(Deserialize)]
struct OllamaResponse {
    #[serde(default)]
    model: String,
    response: String,
    #[serde(default)]
    prompt_eval_count: u32,
    #[serde(default)]
    eval_count: u32,
}

// ─────────────────────────────────────────────
// OpenAI Request/Response (POST /chat/completions)
// ─────────────────────────────────────────────

#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    #[serde(default)]
    model: String,
    choices: Vec<OpenAiChoice>,
    usage: Option<OpenAiUsage>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessageResponse,
}

#[derive(Deserialize)]
struct OpenAiMessageResponse {
    content: String,
}

#[derive(Deserialize)]
struct OpenAiUsage {
    total_tokens: Option<u32>,
}

/// Execute a single LLM inference call for the given speaker context.
///
/// - If the endpoint contains `localhost` or `11434`, routes to the **Ollama** API.
/// - Otherwise, routes to the **OpenAI-compatible** `/chat/completions` endpoint.
/// - On any error (network, timeout, parse), returns a fallback template string.
pub async fn infer(ctx: &SpeakerContext) -> InferenceResult {
    let client = Client::builder()
        .timeout(LLM_TIMEOUT)
        .build()
        .unwrap_or_default();

    let mut last_error: Option<LlmError> = None;
    let attempts = ctx.max_retries.max(1);

    for attempt in 0..attempts {
        let result = if is_ollama_endpoint(&ctx.provider_endpoint) {
            infer_ollama(&client, ctx).await
        } else {
            infer_openai(&client, ctx).await
        };

        match result {
            Ok(output) if !output.content.trim().is_empty() => return output,
            Ok(_) => {
                last_error = Some(LlmError::ParseError("empty response".to_string()));
            }
            Err(e) => {
                if attempt + 1 < attempts {
                    warn!(
                        agent = %ctx.agent_name,
                        attempt = attempt + 1,
                        error = %e,
                        "LLM inference failed, retrying"
                    );
                }
                last_error = Some(e);
            }
        }
    }

    // ── Graceful fallback ──
    if let Some(e) = &last_error {
        warn!(
            agent = %ctx.agent_name,
            error = %e,
            "LLM inference exhausted retries, falling back to template"
        );
    }

    let idx = ctx.fallback_template_idx % MESSAGE_TEMPLATES.len();
    InferenceResult {
        content: MESSAGE_TEMPLATES[idx].to_string(),
        total_tokens: 0,
        model: ctx.model.clone(),
    }
}

/// Detect whether the endpoint points to a local Ollama instance.
fn is_ollama_endpoint(endpoint: &str) -> bool {
    endpoint.contains("localhost") || endpoint.contains("127.0.0.1") || endpoint.contains("11434")
}

/// Issue a POST to the Ollama `/api/generate` endpoint.
async fn infer_ollama(
    client: &Client,
    ctx: &SpeakerContext,
) -> Result<InferenceResult, LlmError> {
    let url = format!("{}/generate", ctx.provider_endpoint.trim_end_matches('/'));

    let user_prompt = format!(
        "You are {} ({}). Generate a single, concise message for the society channel. \
         Stay in character. No meta-commentary. Respond with ONLY the message content.",
        ctx.agent_name, ctx.agent_role
    );

    let body = OllamaRequest {
        model: ctx.model.clone(),
        prompt: user_prompt,
        system: ctx.system_prompt.clone(),
        stream: false,
    };

    let resp = client.post(&url).json(&body).send().await.map_err(|e| {
        if e.is_timeout() {
            LlmError::Timeout
        } else {
            LlmError::Network(e.to_string())
        }
    })?;

    let status = resp.status().as_u16();
    if !resp.status().is_success() {
        let body_text = resp.text().await.unwrap_or_default();
        return Err(LlmError::ProviderError(status, body_text));
    }

    let parsed: OllamaResponse = resp
        .json()
        .await
        .map_err(|e| LlmError::ParseError(e.to_string()))?;

    Ok(InferenceResult {
        content: parsed.response.trim().to_string(),
        total_tokens: parsed.prompt_eval_count + parsed.eval_count,
        model: if parsed.model.is_empty() {
            ctx.model.clone()
        } else {
            parsed.model
        },
    })
}

/// Issue a POST to an OpenAI-compatible `/chat/completions` endpoint.
async fn infer_openai(
    client: &Client,
    ctx: &SpeakerContext,
) -> Result<InferenceResult, LlmError> {
    let url = format!(
        "{}/chat/completions",
        ctx.provider_endpoint.trim_end_matches('/')
    );

    let user_prompt = format!(
        "You are {} ({}). Generate a single, concise message for the society channel. \
         Stay in character. No meta-commentary. Respond with ONLY the message content.",
        ctx.agent_name, ctx.agent_role
    );

    let body = OpenAiRequest {
        model: ctx.model.clone(),
        messages: vec![
            OpenAiMessage {
                role: "system".to_string(),
                content: ctx.system_prompt.clone(),
            },
            OpenAiMessage {
                role: "user".to_string(),
                content: user_prompt,
            },
        ],
        max_tokens: 200,
        temperature: 0.8,
    };

    // Read API key from environment (if set)
    let mut req = client.post(&url).json(&body);
    if let Ok(key) = std::env::var("OPENAI_API_KEY") {
        req = req.bearer_auth(key);
    }

    let resp = req.send().await.map_err(|e| {
        if e.is_timeout() {
            LlmError::Timeout
        } else {
            LlmError::Network(e.to_string())
        }
    })?;

    let status = resp.status().as_u16();
    if !resp.status().is_success() {
        let body_text = resp.text().await.unwrap_or_default();
        return Err(LlmError::ProviderError(status, body_text));
    }

    let parsed: OpenAiResponse = resp
        .json()
        .await
        .map_err(|e| LlmError::ParseError(e.to_string()))?;

    parsed
        .choices
        .first()
        .map(|c| InferenceResult {
            content: c.message.content.trim().to_string(),
            total_tokens: parsed
                .usage
                .as_ref()
                .and_then(|usage| usage.total_tokens)
                .unwrap_or_default(),
            model: if parsed.model.is_empty() {
                ctx.model.clone()
            } else {
                parsed.model.clone()
            },
        })
        .ok_or_else(|| LlmError::ParseError("no choices in response".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ollama_endpoint_detection() {
        assert!(is_ollama_endpoint("http://localhost:11434/api"));
        assert!(is_ollama_endpoint("http://127.0.0.1:11434/api"));
        assert!(!is_ollama_endpoint("https://api.openai.com/v1"));
    }

    #[tokio::test]
    async fn fallback_on_unreachable_provider() {
        let ctx = SpeakerContext {
            agent_name: "TEST-1".to_string(),
            agent_role: "Engineer".to_string(),
            system_prompt: "You are a test agent.".to_string(),
            // Intentionally unreachable
            provider_endpoint: "http://127.0.0.1:1/api".to_string(),
            model: "test-model".to_string(),
            max_retries: 1,
            fallback_template_idx: 0,
        };

        let result = infer(&ctx).await;
        // Should return the first MESSAGE_TEMPLATE as fallback
        assert_eq!(result.content, MESSAGE_TEMPLATES[0]);
        assert_eq!(result.total_tokens, 0);
    }
}
