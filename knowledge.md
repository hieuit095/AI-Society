# ZeroClaw AI Society Knowledge Compass

## Mission

ZeroClaw AI Society is not a chatbot UI. It is a localized synthetic civilization where hundreds to thousands of agents coexist, reason, remember, collaborate, compete, and react to user-injected scenarios in real time.

The target operating scale is **1,000+ concurrent agents** with stable memory usage, fast cold starts, and bounded inference cost. This makes the backend architecture non-negotiable:

- The backend is **strictly Rust**.
- The agent runtime is **strictly ZeroClaw**.
- The server event loop is **Tokio-based**.
- Realtime transport is **WebSocket-first**.
- Agent memory uses **ZeroClaw SQLite hybrid search** for vector + keyword recall.
- Python or Node.js may remain frontend/build tooling only. They must not become the simulation control plane.

## Frontend Reality Today

The current workspace is a **React + Vite + Zustand + Tailwind** God-Mode dashboard prototype with a client-only simulation loop.

- `src/store/useWorldStore.ts` is the single mocked world store.
- `src/features/society-hub/ChatFeed.tsx` owns the current tick engine via `setInterval(..., 1500)`.
- `currentTick`, `messages`, `rustRam`, `awakeAgents`, and `analyticsData` are mutated entirely on the client.
- `citizens` and `graphData` are pre-generated client-side and never originate from a server.
- The UI has four live data surfaces that must eventually be server-authored.
- chat stream
- simulation clock and top-bar counters
- analytics time series
- citizen registry and force-graph topology

## Frontend-Derived Constraints

These are important because future backend work must align to the real prototype, not an imagined one.

- The header displays `isPlaying`, `currentTick`, `awakeAgents`, `totalAgents`, and `rustRam`.
- The chat feed renders a rolling append-only message list with a practical cap near 200 messages.
- Analytics renders a rolling window of points with fields `tick`, `positive`, `negative`, `tokens`, and `adoption`.
- The citizens table expects `id`, `name`, `role`, `status`, `memoryUsage`, and `connections`.
- The force graph expects node fields `id`, `name`, `val`, `group`, and `status`, plus link fields `source` and `target`.

## Prototype Gaps To Correct In Rust

- The top bar claims `totalAgents = 1000`, but the client only materializes 150 citizens.
- Chat messages use agent IDs like `a1`, while citizens and graph nodes use IDs like `AGT-001`; this must be unified.
- Chat messages currently have no `channelId`, so channel switching is cosmetic.
- The inspector thought log is hard-coded for eight mock agents only.
- Inspector stats such as model name and tokens-per-tick are random placeholders.
- Channel unread counts and footer stats are static mock numbers.
- `src/data/citizenData.ts`, `src/features/citizens/CitizenCard.tsx`, and `src/features/world-map/mapData.ts` are currently unused prototype artifacts.
- `@supabase/supabase-js` is installed but unused.

## Authoritative Stack

### Frontend

- React 18
- Vite
- Zustand
- Tailwind CSS
- Recharts
- `react-force-graph-2d`
- WebSocket client transport

### Backend

- Rust stable
- Tokio for async runtime and task orchestration
- `axum` WebSocket server or `tokio-tungstenite` transport layer
- ZeroClaw as the agent framework and trait system
- `serde` and `serde_json` for event contracts
- `tracing` for observability

### Memory And Persistence

- ZeroClaw SQLite memory backend
- Hybrid recall through vector search + SQLite FTS5 keyword search
- Weighted merge tuned around ZeroClaw defaults such as `vector_weight = 0.7` and `keyword_weight = 0.3`
- One authoritative world-state store in Rust; React becomes a projection, not a source of truth

## Recommended Runtime Topology

The backend should be split into clear Rust layers, even if it starts in one binary.

- `society-core`: domain types, event schemas, world state, ids, role definitions
- `society-engine`: authoritative tick engine, scheduling, scenario lifecycle, market simulation
- `society-agents`: ZeroClaw agent wrappers, provider routing, toolset mapping, prompt assembly
- `society-memory`: SQLite setup, memory categories, recall policies, snapshot/export
- `society-ws`: websocket session management, fan-out, backpressure, payload batching
- `society-api`: seed injection commands, health endpoints, admin controls

## ZeroClaw Integration Strategy

### Agent Traits And Identity

ZeroClaw's official architecture is trait-driven for providers, channels, tools, memory, and runtime adapters. We will use that as the foundation instead of inventing a parallel agent framework.

- `IDENTITY.md` is the canonical source for role, title, mandate, authority, and operating constraints.
- `SOUL.md` is the canonical source for tone, personality, temperament, conflict style, and decision character.
- `AGENTS.md` remains the society-wide coordination contract for shared rules.
- `USER.md`, `TOOLS.md`, and optional `MEMORY.md` can be used for world-level operator context and curated seed context.
- For 1,000+ agents, do not duplicate full bootstrap files per agent on disk. Author them once per role family, then overlay compact per-agent deltas inline at spawn time.
- Each runtime agent should resolve to a compact struct such as `AgentRuntime { identity, role_profile, provider_route, tool_profile, memory_handle, channel_memberships, state }`.
- ZeroClaw's prompt builder already supports `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `TOOLS.md`, `USER.md`, `BOOTSTRAP.md`, and `MEMORY.md`; we should reuse that model instead of hand-rolling prompt assembly.

### Tools By Role

Roles should not differ only by prompt text. They must differ by actual tool capability.

- Executives and coordinators get read-heavy tools plus limited delegation and planning.
- Engineers get the ZeroClaw shell/file/git toolset, which is the Rust-native equivalent of a `BashTool` capability.
- Researchers get `BrowserTool`, `http_request`, and `web_search`.
- Analysts get memory recall, structured data inspection, and analytics computation tools.
- Legal and finance roles get read-only or constrained tools by default.
- Consumers and low-agency citizens should often have no side-effecting tools at all.
- High-risk tools should execute through ZeroClaw runtime adapters with policy gates and, when needed, Docker isolation.

### Channels And Society Communication

ZeroClaw channels are designed as trait-based message transports. For the AI Society, we should adopt the same mental model internally but implement custom Rust channels for agent-to-agent communication.

- Use Tokio `mpsc` for point-to-point direct messages and work queues.
- Use Tokio `broadcast` or a pub-sub layer for high-fanout public channels.
- Keep channel ids stable and human-readable, aligned with the frontend where possible.
- `board-room`
- `rnd-team`
- `market-square`
- `dev-ops`
- `legal-floor`
- `hr-lounge`
- `finance-desk`
- `research-lab`
- Add explicit society-only scopes that the current UI can grow into later, such as `town-square` and `dm:{agentId}`.
- Public channels represent ambient society discourse.
- Private channels represent leadership rooms, team subgraphs, or bilateral negotiation threads.
- Every emitted message should include `channelId`, `visibility`, `participants`, and `tick`.

### Turn Execution Model

The world engine, not the browser, drives time.

- Each server tick advances the simulation clock.
- The scheduler selects which agents act this tick.
- Each selected agent runs a bounded ZeroClaw turn cycle.
- Agent turns may read memory, send messages, call tools, update market state, and emit topology changes.
- All world mutations are committed in Rust before websocket fan-out.
- React only renders committed server events.

## LLM Economics Strategy

The society must be architected around cost tiers, not a single-model fantasy.

- **5% elite agents** use cloud providers through ZeroClaw, typically OpenAI or Anthropic class models.
- **95% citizen agents** use local or near-local inference through ZeroClaw's Ollama or OpenAI-compatible routing.
- Elite agents are leadership, crisis coordinators, synthesis agents, and escalation paths.
- Citizen agents handle ambient chatter, routine reactions, low-stakes memory updates, and local decisions.
- Local models should summarize upward; elite agents should arbitrate only when thresholds are crossed.
- Use ZeroClaw provider resilience for retry, model fallback, and key rotation on the cloud tier.
- Prefer local-first models for high-frequency ticks and reserve cloud calls for sparse strategic turns.

## Memory Strategy

- Store long-term memories in ZeroClaw SQLite for each world shard.
- Use memory categories for at least conversation, observation, decision, market, and relationship signals.
- Keep short-lived tick-local state in memory structures, not in prompt history.
- Use hybrid recall for semantically relevant experiences and exact historical events.
- Use compact context for small local models when needed.
- Snapshot and hydrate world memory during scenario reset, save, and replay workflows.

## WebSocket Contract Principles

- Every websocket event must be versioned.
- Every event must carry a monotonic `sequence`.
- Every event must carry `worldId`.
- The server is authoritative for time, agent state, analytics, and topology.
- The client may own transient UI state such as selected view, selected agent panel openness, and modal visibility.

## WebSocket Envelope

```json
{
  "schemaVersion": 1,
  "worldId": "default",
  "sequence": 14052,
  "sentAt": "2026-03-16T08:43:00.000Z",
  "type": "world.bootstrap",
  "payload": {}
}
```

## Required Server Events

### `world.bootstrap`

Sent immediately after websocket connection. This replaces the initial Zustand seed state.

```json
{
  "schemaVersion": 1,
  "worldId": "default",
  "sequence": 1,
  "sentAt": "2026-03-16T08:43:00.000Z",
  "type": "world.bootstrap",
  "payload": {
    "isPlaying": false,
    "currentTick": 14052,
    "awakeAgents": 842,
    "totalAgents": 1000,
    "rustRam": 45,
    "messages": [
      {
        "id": "msg-14052-0001",
        "channelId": "board-room",
        "agentId": "AGT-001",
        "agentName": "ARIA-7",
        "agentRole": "CEO Agent",
        "agentRoleColor": "emerald",
        "agentAvatarInitials": "A7",
        "content": "Strategic synthesis in progress.",
        "timestamp": "2026-03-16T08:43:00.000Z",
        "tick": 14052,
        "isSystemMessage": false
      }
    ],
    "analyticsData": [
      {
        "tick": 14052,
        "positive": 48,
        "negative": 12,
        "tokens": 35130,
        "adoption": 63
      }
    ],
    "citizens": [
      {
        "id": "AGT-001",
        "name": "ARIA-7",
        "role": "CEO",
        "status": "Awake",
        "memoryUsage": "42.1 MB",
        "connections": ["AGT-002", "AGT-019"]
      }
    ],
    "graphData": {
      "nodes": [
        {
          "id": "AGT-001",
          "name": "ARIA-7",
          "val": 1.5,
          "group": "CEO",
          "status": "Awake"
        }
      ],
      "links": [
        {
          "source": "AGT-001",
          "target": "AGT-019"
        }
      ]
    }
  }
}
```

### `tick.sync`

Sent every authoritative server tick, even if no chat is emitted.

```json
{
  "schemaVersion": 1,
  "worldId": "default",
  "sequence": 14053,
  "sentAt": "2026-03-16T08:43:01.500Z",
  "type": "tick.sync",
  "payload": {
    "isPlaying": true,
    "currentTick": 14053,
    "awakeAgents": 847,
    "totalAgents": 1000,
    "rustRam": 46
  }
}
```

### `chat.message`

Sent for every society message appended to the feed.

```json
{
  "schemaVersion": 1,
  "worldId": "default",
  "sequence": 14054,
  "sentAt": "2026-03-16T08:43:01.520Z",
  "type": "chat.message",
  "payload": {
    "id": "msg-14053-0002",
    "channelId": "board-room",
    "agentId": "AGT-001",
    "agentName": "ARIA-7",
    "agentRole": "CEO Agent",
    "agentRoleColor": "emerald",
    "agentAvatarInitials": "A7",
    "content": "Reallocating capital toward resilient edge inference.",
    "timestamp": "2026-03-16T08:43:01.520Z",
    "tick": 14053,
    "isSystemMessage": false
  }
}
```

### `analytics.tick`

Sent once per tick after market computation.

```json
{
  "schemaVersion": 1,
  "worldId": "default",
  "sequence": 14055,
  "sentAt": "2026-03-16T08:43:01.530Z",
  "type": "analytics.tick",
  "payload": {
    "tick": 14053,
    "positive": 51,
    "negative": 10,
    "tokens": 35132,
    "adoption": 64
  }
}
```

### `agent.status`

Sent whenever a citizen row or graph node changes. This must use the same `agentId` namespace as chat.

```json
{
  "schemaVersion": 1,
  "worldId": "default",
  "sequence": 14056,
  "sentAt": "2026-03-16T08:43:01.540Z",
  "type": "agent.status",
  "payload": {
    "id": "AGT-019",
    "name": "SIGMA-1",
    "role": "Engineer",
    "status": "Awake",
    "memoryUsage": "18.4 MB",
    "connections": ["AGT-001", "AGT-044", "AGT-112"],
    "graphNode": {
      "id": "AGT-019",
      "name": "SIGMA-1",
      "val": 1.5,
      "group": "Engineer",
      "status": "Awake"
    }
  }
}
```

### `graph.snapshot`

Sent on connect, on seed reset, and when a large topology recompute is cheaper than many deltas.

```json
{
  "schemaVersion": 1,
  "worldId": "default",
  "sequence": 14057,
  "sentAt": "2026-03-16T08:43:01.600Z",
  "type": "graph.snapshot",
  "payload": {
    "nodes": [
      {
        "id": "AGT-001",
        "name": "ARIA-7",
        "val": 1.5,
        "group": "CEO",
        "status": "Awake"
      }
    ],
    "links": [
      {
        "source": "AGT-001",
        "target": "AGT-019"
      }
    ]
  }
}
```

### `seed.applied`

Sent after a scenario reset. This is the server-side replacement for the current `injectSeed()` mutation.

```json
{
  "schemaVersion": 1,
  "worldId": "default",
  "sequence": 2,
  "sentAt": "2026-03-16T08:50:00.000Z",
  "type": "seed.applied",
  "payload": {
    "title": "Post-AGI Consumer Economy v4.2",
    "currentTick": 0,
    "isPlaying": true,
    "systemMessage": {
      "id": "sys-0001",
      "channelId": "board-room",
      "agentId": "system",
      "agentName": "SYSTEM",
      "agentRole": "DIRECTIVE",
      "agentRoleColor": "rose",
      "agentAvatarInitials": "SY",
      "content": ">>> NEW SEED DIRECTIVE INJECTED: \"Post-AGI Consumer Economy v4.2\". AWAKENING AGENTS... ALL PRIOR CONTEXT PURGED. RE-INITIALIZING SIMULATION.",
      "timestamp": "2026-03-16T08:50:00.000Z",
      "tick": 0,
      "isSystemMessage": true
    },
    "analyticsData": [],
    "messages": []
  }
}
```

### `agent.detail`

Needed for a real inspector. The current UI fakes most of this data.

```json
{
  "schemaVersion": 1,
  "worldId": "default",
  "sequence": 14058,
  "sentAt": "2026-03-16T08:43:01.650Z",
  "type": "agent.detail",
  "payload": {
    "agent": {
      "id": "AGT-019",
      "name": "SIGMA-1",
      "role": "Engineer",
      "roleColor": "sky",
      "avatarInitials": "S1",
      "status": "processing"
    },
    "lastTick": 14053,
    "model": "ollama:qwen2.5-coder:32b",
    "tokensPerTick": 412,
    "thoughtLog": [
      "> Scanning codebase for security patterns...",
      "> Running static analysis on auth module...",
      "> Deploying patch to staging..."
    ]
  }
}
```

## Client Commands That Must Exist

These are not part of the mocked Zustand state, but the architecture requires them.

```json
{
  "type": "seed.inject",
  "payload": {
    "title": "Post-AGI Consumer Economy v4.2",
    "audience": "Mass Market Consumers",
    "context": "Global bandwidth shortage triggers local mesh network adoption."
  }
}
```

```json
{
  "type": "simulation.control",
  "payload": {
    "action": "play"
  }
}
```

```json
{
  "type": "simulation.control",
  "payload": {
    "action": "pause"
  }
}
```

## Non-Negotiable Engineering Rules

- Rust owns time.
- Rust owns state.
- ZeroClaw owns agent reasoning, provider abstraction, tool execution, and memory primitives.
- React never simulates the world after migration begins.
- Every server event must be replayable and sequence-safe.
- One stable agent id must power chat, citizens, graph, inspector, and memory.
- Local-first inference is the default; cloud inference is an escalation path.

## Official ZeroClaw References

- Official repository: https://github.com/zeroclaw-labs/zeroclaw
- Official README: https://github.com/zeroclaw-labs/zeroclaw/blob/master/README.md
- Wiki home: https://github.com/zeroclaw-labs/zeroclaw/wiki
- Trait-driven design: https://github.com/zeroclaw-labs/zeroclaw/wiki/03.1-Trait-Driven-Design
- Built-in providers: https://github.com/zeroclaw-labs/zeroclaw/wiki/05.1-Built-In-Providers
- Provider resilience: https://github.com/zeroclaw-labs/zeroclaw/wiki/05.3-Provider-Resilience
- Channel architecture: https://github.com/zeroclaw-labs/zeroclaw/wiki/06.1-Channel-Architecture
- Agent turn cycle: https://github.com/zeroclaw-labs/zeroclaw/wiki/07.1-Agent-Turn-Cycle
- System prompt construction: https://github.com/zeroclaw-labs/zeroclaw/wiki/07.4-System-Prompt-Construction
- Browser and HTTP tools: https://github.com/zeroclaw-labs/zeroclaw/wiki/08.2-Browser-And-HTTP-Tools
- Memory backends: https://github.com/zeroclaw-labs/zeroclaw/wiki/09.1-Memory-Backends
- Hybrid search: https://github.com/zeroclaw-labs/zeroclaw/wiki/09.2-Hybrid-Search
