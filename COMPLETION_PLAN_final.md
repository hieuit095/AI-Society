# 🚀 ZERO-CLAW AI SOCIETY: COMPLETION PLAN

## 📊 AUDIT CONTEXT & REALITY CHECK
Contrary to the `[ ]` checkboxes in [docs/plan.md](file:///c:/Users/USER/Documents/GitHub/AI%20world/docs/plan.md), the evidence-based codebase audit verifies that **Phases 1 through 6 are fully implemented and architecturally sound.** The codebase has successfully achieved strict Rust-authoritative state, eradicated all frontend mock loops and prototype contamination, and fully integrated ZeroClaw's SQLite FTS5 memory semantics. Features like dynamic LLM prompt assembly (Active Roster/Channel History injection) and Economic Tier Routing (Elite Cloud/Citizen Local) are actively enforced.

The remaining tasks below represent the *true* final gaps from the original [plan.md](file:///c:/Users/USER/Documents/GitHub/AI%20world/docs/plan.md) documentation—specifically Phase 6 (Save/Load State) and Phase 7 (Production Optimization) required to declare the architecture 100% complete and ship-ready for 1,000-agent load parameters.

---

## 🛠️ THE ROADMAP TO 100% COMPLETION

### TASK 1: Scenario State Persistence (Snapshot & Hydrate) [BLOCKER]
**Objective:** Address the unchecked Phase 6 requirement to implement reliable scenario save/load mechanisms.
* **Target Files:**
  * [society-server/src/world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs)
  * [society-server/src/ws.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/ws.rs)
  * [society-server/src/memory.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/memory.rs)
* **Execution:**
  1. Add full state serialization to [WorldState](file:///c:/Users/USER/Documents/GitHub/AI%20world/src/store/useWorldStore.ts#36-74) (including `mention_queue`, `channel_history`, and agent tracking).
  2. Implement `world.snapshot` and `world.hydrate` as `ClientCommand` enums in [ws.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/ws.rs) to allow dumping state to an operator-accessible JSON structure.
  3. Ensure [memory.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/memory.rs) correctly maps restored seed metadata back to Agent schemas preserving `MemoryCategory` relational graphs upon hydration.

### TASK 2: WebSocket Backpressure & Event Coalescing [CRITICAL ARCHITECTURE]
**Objective:** Address Phase 7 risks of flooding the browser socket during 1000-agent burst simulation storms.
* **Target Files:**
  * [society-server/src/ws.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/ws.rs)
  * [society-server/src/world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs)
* **Execution:**
  1. Replace the unbounded `tx.send(json)` broadcast triggers in [world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs) with bounded channel buffering.
  2. Implement a targeted drop strategy inside the outbound loop in [ws.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/ws.rs). If a client's transport buffers max out, safely discard lower-priority telemetry (like `agent.status.batch` or `graph.snapshot`) while guaranteeing delivery for `chat.message` and `world.bootstrap`.
  3. Refactor `chat.message` emissions to coalesce multiple message objects generated in the same tick into a single `chat.batch` message array websocket envelope to reduce network framing overhead.

### TASK 3: Observability Dashboards & Load Telemetry [UI WIRING]
**Objective:** Complete Phase 7's final telemetry and performance monitoring directives.
* **Target Files:**
  * [society-server/src/analytics.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/analytics.rs)
  * [society-server/src/world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs)
  * [src/features/analytics/MarketAnalytics.tsx](file:///c:/Users/USER/Documents/GitHub/AI%20world/src/features/analytics/MarketAnalytics.tsx)
  * [src/types/world.ts](file:///c:/Users/USER/Documents/GitHub/AI%20world/src/types/world.ts)
* **Execution:**
  1. Expand [AnalyticsPoint](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/analytics.rs#12-21) in [analytics.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/analytics.rs) to include `tick_latency_ms`, `recall_latency_ms` (SQLite FTS5 timing), and active `ws_queue_depth`.
  2. Instrument the [world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs) lock boundaries with `Instant::now()` calculations to capture real-time execution speeds.
  3. Wire the new metrics directly into visually corresponding trend charts in `MarketAnalytics.tsx` to detect early signs of system degradation under 1K concurrent simulated loads.

### TASK 4: Extended UI Safety Limits (Virtualization) [CLEANUP]
**Objective:** Verify memory bounds for long-lived browser sessions as required by Phase 7.
* **Target Files:** 
  * [src/features/citizens/Citizens.tsx](file:///c:/Users/USER/Documents/GitHub/AI%20world/src/features/citizens/Citizens.tsx)
  * [src/services/wsClient.ts](file:///c:/Users/USER/Documents/GitHub/AI%20world/src/services/wsClient.ts)
* **Execution:**
  1. Verify the `Citizens.tsx` data grid maps to `@tanstack/react-virtual` similarly to how [ChatFeed.tsx](file:///c:/Users/USER/Documents/GitHub/AI%20world/src/features/society-hub/ChatFeed.tsx) does, guaranteeing that DOM node counts remain constant even when 1,000 unique records are hydrated.
  2. Map the existing `requestResync` sequence tracker in [wsClient.ts](file:///c:/Users/USER/Documents/GitHub/AI%20world/src/services/wsClient.ts) to trigger a global Zustand context flag rendering a "Connection Degraded / Re-syncing" top-bar warning.
