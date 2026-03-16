# ZeroClaw AI Society Implementation Roadmap

## Phase 1: Backend Foundation (Rust And ZeroClaw)

- [ ] Create a Cargo workspace at the repository root and keep the existing Vite app as the frontend package.
- [ ] Add a backend application crate for the server binary.
- [ ] Add shared Rust crates for domain types and websocket contracts if separation helps maintainability.
- [ ] Add core dependencies: `tokio`, `serde`, `serde_json`, `tracing`, `tracing-subscriber`, and websocket support through `axum` or `tokio-tungstenite`.
- [ ] Add ZeroClaw from the official repository with a pinned revision or matching published crate version.
- [ ] Add a health endpoint and a minimal websocket route.
- [ ] Implement a websocket echo server to prove Rust networking, serialization, and browser connectivity.
- [ ] Define a versioned event envelope shared by server and frontend.
- [ ] Check in a `rust-toolchain.toml` or explicit toolchain policy for reproducible builds.
- [ ] Add `cargo fmt`, `cargo clippy`, and a smoke test to CI as the minimum backend quality gate.

## Phase 2: The World Engine And Time Sync

- [ ] Create a server-side `WorldState` struct that owns `isPlaying`, `currentTick`, `awakeAgents`, `totalAgents`, and `rustRam`.
- [ ] Implement a Tokio-driven tick loop that replaces the frontend `setInterval`.
- [ ] Make the tick loop the sole authority for advancing simulation time.
- [ ] Emit `tick.sync` websocket events on every committed tick.
- [ ] Add connection bootstrap logic so new clients receive `world.bootstrap` before incremental events.
- [ ] Replace the frontend's local `incrementTick()` loop with a websocket subscription.
- [ ] Keep the existing UI rendering intact while hydrating Zustand from websocket events instead of mock generators.
- [ ] Preserve pause and play controls, but route them to Rust through websocket commands.
- [ ] Add deterministic tick-rate configuration on the server so 1x, 2x, and future simulation speeds are possible.
- [ ] Add tests that assert tick monotonicity, pause behavior, and bootstrap correctness.

## Phase 3: Agent Genesis (ZeroClaw Setup)

- [ ] Define a canonical Rust `AgentId` type used everywhere: chat, citizens, graph, inspector, memory, and analytics.
- [ ] Define role profiles for at least CEO, CTO, Engineer, Consumer, Researcher, Analyst, Finance, and Legal.
- [ ] Model each runtime agent as a ZeroClaw-backed struct with identity, soul, provider route, tool profile, and memory handle.
- [ ] Build a role-template loader for `IDENTITY.md`, `SOUL.md`, and `AGENTS.md` driven prompt assembly.
- [ ] Decide the runtime authoring model for agent bootstrap files: shared role files plus per-agent inline deltas.
- [ ] Implement bulk spawn logic for the initial society population.
- [ ] Route elite agents to cloud providers such as OpenAI or Anthropic through ZeroClaw.
- [ ] Route citizen agents to local providers such as Ollama or compatible endpoints through ZeroClaw.
- [ ] Add provider resilience and model fallback policies for the elite tier.
- [ ] Add lightweight status probes so the world engine knows which agents are awake, idle, processing, suspended, or failed.
- [ ] Remove the current frontend mismatch between `a1` style chat ids and `AGT-###` style citizen ids by converging on a single server-issued id space.

## Phase 4: Society Hub (Channels And Tools)

- [ ] Implement internal society channels in Rust using Tokio `mpsc` for direct messages and `broadcast` or pub-sub for public channels.
- [ ] Represent channel ids explicitly and keep them stable across frontend and backend.
- [ ] Add a `channelId` to all chat messages and stop treating the feed as one global channel.
- [ ] Map tool access by role so agents have real differentiated physical capabilities.
- [ ] Give Engineers ZeroClaw shell/file/git capability.
- [ ] Give Researchers browser, HTTP, and search capability.
- [ ] Give Analysts memory-centric and data-centric capability.
- [ ] Keep low-agency citizens mostly tool-light or read-only.
- [ ] Emit `chat.message` events whenever society discourse produces a committed message.
- [ ] Emit `agent.status` and `graph.snapshot` or graph delta events whenever the social topology changes.
- [ ] Build real inspector payloads so `thoughtLog`, `model`, and `tokensPerTick` come from Rust rather than placeholders.
- [ ] Add bounded queues and cancellation semantics so slow agents do not stall the whole society.

## Phase 5: The Seed Pipeline

- [ ] Define a websocket client command for seed injection with `title`, `audience`, and `context`.
- [ ] Replace the modal's fake timeout with a real websocket request to Rust.
- [ ] On seed execution, reset the authoritative world tick to `0`.
- [ ] Purge or archive the prior scenario memory according to world reset policy.
- [ ] Reinitialize or awaken the society according to the new seed.
- [ ] Emit a `seed.applied` event and a fresh `world.bootstrap` or equivalent snapshot to all clients.
- [ ] Ensure the first post-seed message is a server-authored system directive, not a client-generated placeholder.
- [ ] Add replay-safe seed identifiers so scenario runs can be logged, resumed, or compared.
- [ ] Add tests covering seed reset, message purge, analytics reset, and resumed ticking after reset.

## Phase 6: Memory And Real-Time Analytics

- [ ] Integrate ZeroClaw SQLite memory for each world shard or scenario instance.
- [ ] Define memory categories for conversation, observation, decision, relationship, and market signals.
- [ ] Store agent observations and important turns with consistent keys and metadata.
- [ ] Use hybrid recall to feed relevant context back into agent turns.
- [ ] Move analytics computation entirely into Rust and stop deriving simulation KPIs from random client math.
- [ ] Compute sentiment, token burn, adoption, and any future market metrics from actual agent actions.
- [ ] Emit `analytics.tick` every committed tick.
- [ ] Keep the Recharts UI on the frontend, but feed it from streamed Rust analytics data.
- [ ] Introduce an `agent.detail` endpoint or websocket event so the inspector can show real model routing, real tokens-per-tick, and real thought traces.
- [ ] Add snapshot and hydrate workflows for scenario save/load.
- [ ] Add tests for memory recall quality, SQLite concurrency, analytics correctness, and replay determinism.

## Phase 7: Production Optimization

- [ ] Add websocket backpressure controls so a hot simulation cannot flood the browser.
- [ ] Batch low-priority events such as agent status chatter into compact envelopes.
- [ ] Rate-limit graph recomputation and prefer graph deltas where practical.
- [ ] Cap or virtualize long frontend lists so 1,000 active agents do not overwhelm the DOM.
- [ ] Introduce server-side message coalescing for noisy channels.
- [ ] Add client-side sequence tracking and drop or request resync on gaps.
- [ ] Add periodic snapshot resync so long-running sessions can self-heal after packet loss or reconnects.
- [ ] Measure memory, CPU, and websocket throughput with 1,000-agent load tests.
- [ ] Add world sharding strategy if one runtime cannot comfortably host all agents and channels.
- [ ] Add observability dashboards for tick latency, queue depth, websocket lag, provider usage, local-vs-cloud call mix, and memory recall latency.
- [ ] Add failure budgets and degradation modes so the system can reduce fidelity instead of crashing under pressure.

## Cross-Cutting Cleanup Tasks

- [ ] Delete or quarantine prototype-only code paths once their Rust replacements are live.
- [ ] Remove unused frontend artifacts such as `citizenData.ts`, `CitizenCard.tsx`, and `mapData.ts` if they remain unused after migration.
- [ ] Remove `@supabase/supabase-js` if it stays out of the final architecture.
- [ ] Keep frontend store shape close to the current UI to minimize unnecessary churn during migration.
- [ ] Document all event contracts in one shared schema file and keep `knowledge.md` updated as the north star.
- [ ] Never reintroduce a client-authored simulation loop once Rust takes ownership.
