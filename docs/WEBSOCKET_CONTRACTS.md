# WebSocket Wire Protocol — ZeroClaw AI Society

> **Schema Version:** 1  
> **Transport:** WebSocket (`ws://localhost:4000/ws`)  
> **Envelope:** All messages wrapped in `Envelope<T>`

---

## Envelope Format

Every message is wrapped in a versioned envelope:

```json
{
  "schemaVersion": 1,
  "worldId": "default",
  "sequence": 42,
  "sentAt": "2026-03-17T04:00:00.000Z",
  "eventType": "tick.sync",
  "payload": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `u32` | Always `1` for now |
| `worldId` | `string` | World instance ID (always `"default"`) |
| `sequence` | `u64` | Strictly monotonic counter per direction |
| `sentAt` | `string` | ISO 8601 timestamp |
| `eventType` | `string` | Human-readable event type key |
| `payload` | `T` | Tagged JSON object with `"type"` discriminator |

---

## Server → Client Events

### `world.bootstrap`

Sent on initial connection. Full world state snapshot.

```json
{
  "type": "worldBootstrap",
  "isPlaying": true,
  "currentTick": 0,
  "awakeAgents": 120,
  "totalAgents": 150,
  "rustRam": 64
}
```

### `tick.sync`

Sent every 1.5s tick. Heartbeat with current world state.

```json
{
  "type": "tickSync",
  "isPlaying": true,
  "currentTick": 42,
  "awakeAgents": 118,
  "totalAgents": 150,
  "rustRam": 67
}
```

### `chat.message`

A single agent chat message.

```json
{
  "type": "chatMessage",
  "id": "msg-42-0",
  "agentId": "AGT-001",
  "agentName": "ARIA-7",
  "agentRole": "CEO Agent",
  "agentRoleColor": "emerald",
  "agentAvatarInitials": "AR",
  "channelId": "board-room",
  "content": "Strategic objective alignment check...",
  "timestamp": "2026-03-17T04:00:00.000Z",
  "tick": 42,
  "isSystemMessage": false
}
```

### `graph.snapshot`

Full society relationship graph (emitted every 5th tick).

```json
{
  "type": "graphSnapshot",
  "data": {
    "nodes": [
      { "id": "AGT-001", "name": "ARIA-7", "group": "CEO Agent", "val": 8, "status": "Awake" }
    ],
    "links": [
      { "source": "AGT-001", "target": "AGT-002", "label": "delegates" }
    ]
  }
}
```

### `agent.detail`

Agent inspector telemetry (response to `inspectAgent` command).

```json
{
  "type": "agentDetail",
  "id": "AGT-001",
  "name": "ARIA-7",
  "role": "CEO Agent",
  "tier": "Elite",
  "provider": "GPT-4 Turbo",
  "status": "Awake",
  "systemPrompt": "You are the CEO...",
  "tools": ["StrategicPlanner", "MarketAnalyzer"],
  "thoughtLog": ["> Initializing...", "> Running analysis..."]
}
```

### `seed.applied`

Emitted after a seed injection resets the world.

```json
{
  "type": "seedApplied",
  "seedId": "seed-a1b2c3d4",
  "title": "AI Startup Launch",
  "id": "msg-sys-0",
  "agentId": "SYSTEM",
  "agentName": "SYSTEM",
  "agentRole": "System",
  "agentRoleColor": "amber",
  "agentAvatarInitials": "SY",
  "content": "🌱 SEED: \"AI Startup Launch\" — ...",
  "timestamp": "2026-03-17T04:00:00.000Z",
  "tick": 0,
  "isSystemMessage": true
}
```

### `analytics.tick`

Per-tick KPI data point (server-computed).

```json
{
  "type": "analyticsTick",
  "tick": 42,
  "positive": 65,
  "negative": 12,
  "tokens": 1050,
  "adoption": 73
}
```

### `agent.status.batch`

Batched agent status changes (Phase 7 — emitted once per tick).

```json
{
  "type": "agentStatusBatch",
  "changes": [
    { "agentId": "AGT-005", "status": "awake" },
    { "agentId": "AGT-012", "status": "suspended" }
  ]
}
```

### `echo`

Debug echo response.

```json
{
  "type": "echo",
  "message": "hello"
}
```

---

## Client → Server Commands

### `simulationControl`

Play/pause the tick loop.

```json
{
  "type": "simulationControl",
  "action": "play"
}
```

Actions: `"play"`, `"pause"`

### `inspectAgent`

Request agent telemetry for the inspector panel.

```json
{
  "type": "inspectAgent",
  "agentId": "AGT-001"
}
```

### `injectSeed`

Reset the world and inject a new scenario.

```json
{
  "type": "injectSeed",
  "title": "AI Startup Launch",
  "audience": "Investors",
  "context": "A startup pivoting to AI-first products..."
}
```

### `requestResync`

Request full world re-bootstrap (sent on sequence gap detection).

```json
{
  "type": "requestResync"
}
```

Server responds with `world.bootstrap` + `graph.snapshot`.

### `echo`

Debug echo request.

```json
{
  "type": "echo",
  "message": "hello"
}
```

---

## Sequence Tracking

- Server increments `sequence` monotonically per envelope.
- Client tracks `expectedSequence` — if `incoming > expected`, sends `requestResync`.
- After resync, client resets `expectedSequence` from the new bootstrap envelope.
