//! # society-server
//!
//! The authoritative WebSocket backend for ZeroClaw AI Society.
//!
//! ## Architecture (Phase 3)
//!
//! - **Agent Genesis**: On startup, spawns 150 agents with role profiles and provider routes.
//! - **WorldState**: Owns tick counter, agent roster, and runtime telemetry.
//! - **Tick Loop**: Advances time, drifts agent status, and broadcasts `TickSync` events.
//! - **WebSocket**: Bootstrap on connect, tick sync via broadcast, simulation control commands.
//!
//! ## Endpoints
//!
//! - `GET /health` — Health check
//! - `GET /ws`     — WebSocket upgrade

pub mod agents;
mod analytics;
pub mod genesis;
mod llm;
mod memory;
mod world;
mod ws;

use axum::{routing::get, Json, Router};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex, RwLock};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use world::WorldState;
use ws::AppState;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "society_server=debug,tower_http=debug".into()),
        )
        .init();

    // ── Agent Genesis ──
    let roster = agents::genesis_society();
    let world = Arc::new(RwLock::new(WorldState::with_agents(roster)));

    // ── Memory Store (file-based for persistence across restarts) ──
    let memory_store = memory::MemoryStore::new_file("./society-memory.db")
        .expect("failed to initialize memory store");
    let shared_memory = Arc::new(Mutex::new(memory_store));

    // ── Broadcast channel ──
    let (event_tx, _) = broadcast::channel::<String>(1024);

    // ── Tick loop ──
    world::spawn_tick_loop(world.clone(), event_tx.clone(), shared_memory.clone());

    // ── CORS ──
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // ── Router ──
    let app_state = AppState {
        world,
        event_tx,
        shared_memory,
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws::ws_handler))
        .with_state(app_state)
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

    fn test_app() -> Router {
        let roster = agents::genesis_society();
        let world = Arc::new(RwLock::new(WorldState::with_agents(roster)));
        let (event_tx, _) = broadcast::channel(16);
        let memory_store =
            memory::MemoryStore::new_in_memory().expect("failed to initialize memory store");
        let shared_memory = Arc::new(Mutex::new(memory_store));
        let app_state = AppState {
            world,
            event_tx,
            shared_memory,
        };

        Router::new()
            .route("/health", get(health))
            .route("/ws", get(ws::ws_handler))
            .with_state(app_state)
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let response = test_app()
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
