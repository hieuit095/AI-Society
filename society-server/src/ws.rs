//! WebSocket handler for the ZeroClaw society server.
//!
//! ## Phase 1: Echo Server
//!
//! Accepts WebSocket connections at `GET /ws`, deserializes incoming messages as
//! `Envelope<ClientCommand>`, and responds with `Envelope<ServerEvent>`.
//!
//! Currently implements only the `Echo` command — a proof-of-concept that validates
//! the full browser → Rust → browser message cycle with the versioned envelope format.

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use society_core::{ClientCommand, Envelope, ServerEvent};
use tracing::{debug, error, info, warn};

/// Axum handler that upgrades an HTTP request to a WebSocket connection.
pub async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    info!("WebSocket upgrade requested");
    ws.on_upgrade(handle_socket)
}

/// Per-connection WebSocket loop.
///
/// Reads text frames, deserializes as `Envelope<ClientCommand>`, dispatches to the
/// appropriate handler, and sends back `Envelope<ServerEvent>` responses.
async fn handle_socket(socket: WebSocket) {
    let (mut sender, mut receiver) = socket.split();
    let mut sequence: u64 = 0;

    info!("WebSocket connection established");

    while let Some(msg) = receiver.next().await {
        let msg = match msg {
            Ok(msg) => msg,
            Err(e) => {
                error!("WebSocket receive error: {e}");
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                debug!("Received: {text}");

                // Attempt to deserialize the envelope
                let envelope: Envelope<ClientCommand> = match serde_json::from_str(&text) {
                    Ok(env) => env,
                    Err(e) => {
                        warn!("Invalid envelope: {e}");
                        let error_json = serde_json::to_string(&serde_json::json!({
                            "error": "invalid_envelope",
                            "detail": e.to_string()
                        }))
                        .unwrap_or_default();
                        if sender.send(Message::Text(error_json.into())).await.is_err() {
                            break;
                        }
                        continue;
                    }
                };

                // Dispatch based on the command
                let response = match envelope.payload {
                    ClientCommand::Echo { message } => {
                        info!("Echo command received: {message}");
                        sequence += 1;
                        let event = ServerEvent::Echo {
                            message: message.clone(),
                        };
                        Envelope::new(sequence, "echo", event)
                    }
                };

                // Serialize and send
                match serde_json::to_string(&response) {
                    Ok(json) => {
                        if sender.send(Message::Text(json.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(e) => {
                        error!("Failed to serialize response: {e}");
                    }
                }
            }
            Message::Close(_) => {
                info!("WebSocket client disconnected");
                break;
            }
            // Ignore binary and ping/pong
            _ => {}
        }
    }

    info!("WebSocket connection closed");
}
