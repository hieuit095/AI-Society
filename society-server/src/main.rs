//! # society-server
//!
//! The authoritative WebSocket backend for ZeroClaw AI Society.
//!
//! ## Endpoints
//!
//! - `GET /health` — Health check, returns `{"status":"ok"}`
//! - `GET /ws`     — WebSocket upgrade, echo handler (Phase 1 POC)
//!
//! ## Running
//!
//! ```bash
//! cargo run -p society-server
//! ```
//!
//! The server binds to `0.0.0.0:4000` by default.

mod ws;

use axum::{routing::get, Json, Router};
use serde_json::json;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

/// Application entry point.
///
/// Initializes tracing, builds the Axum router, and binds to port 4000.
#[tokio::main]
async fn main() {
    // Initialize structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "society_server=debug,tower_http=debug".into()),
        )
        .init();

    // CORS — allow the Vite dev server (localhost:5173) to connect
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws::ws_handler))
        .layer(cors);

    let addr = "0.0.0.0:4000";
    info!("🚀 ZeroClaw society-server listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind to address");

    axum::serve(listener, app).await.expect("server error");
}

/// `GET /health` — Returns 200 OK with a JSON status body.
async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::util::ServiceExt;

    /// Build the app router for testing (mirrors main but without tracing/bind).
    fn app() -> Router {
        Router::new()
            .route("/health", get(health))
            .route("/ws", get(ws::ws_handler))
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let response = app()
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["status"], "ok");
    }
}
