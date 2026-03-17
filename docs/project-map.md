# ZeroClaw AI Society — Frontend Architecture Map

> **Purpose:** Feed this file to any AI coding session targeting this codebase.
> It provides instant, hallucination-free architectural context for the React + Vite + Tailwind + Zustand + Recharts + ForceGraph frontend.

---

## 1. Architecture Overview

**ZeroClaw AI Society** is a cyberpunk-themed, real-time God-Mode operator dashboard for monitoring and controlling an autonomous AI agent society. The UI is split into four primary views accessible via a persistent left sidebar:

| View | Component | Purpose |
|------|-----------|---------|
| **Society Hub** | `SocietyHub.tsx` | Live agent chat feed, channel nav, agent inspector panel |
| **World Map** | `WorldMap.tsx` | 150-node interactive force-directed graph topology |
| **Citizens** | `Citizens.tsx` | Searchable, filterable table of all citizen agents |
| **Analytics** | `MarketAnalytics.tsx` | KPI cards, sentiment charts, token burn, adoption rates |

A persistent **TopBar** shows tick counter, play/pause controls, agent counts, and RAM stats.
A slide-in **AgentInspector** panel reveals agent detail + live thought logs on any agent click.
A **SeedModal** allows the operator to reset the simulation with a new scenario.

**Current state:** The entire app is driven by a Zustand `setInterval` tick engine that generates mock data every 1.5 seconds. There is **no backend** — all data is client-side.

---

## 2. Directory Tree (annotated)

```
src/
├── App.tsx                         # Root shell: TopBar + LeftSidebar + view router + SeedModal overlay
├── main.tsx                        # React DOM entry, wraps <App> in StrictMode
├── index.css                       # Tailwind directives, scrollbar utilities, keyframe animations
├── vite-env.d.ts                   # Vite client types
│
├── types/
│   ├── index.ts                    # Barrel re-export
│   └── world.ts                    # ALL TypeScript interfaces: Agent, Message, Citizen, GraphNode, AnalyticsPoint, etc.
│
├── store/
│   └── useWorldStore.ts            # Zustand store: tick engine, mock generators, UI state, and all actions
│
├── data/
│   ├── mockData.ts                 # Static agents, channels, thought logs, message templates, generateMockMessage()
│   └── citizenData.ts              # Extended citizen data (legacy, partially unused — has duplicate types)
│
├── lib/
│   └── utils.ts                    # cn() helper (clsx + tailwind-merge)
│
├── components/
│   ├── layout/
│   │   ├── TopBar.tsx              # Global header: tick display, play/pause, agent/RAM stats, "Inject Seed" button
│   │   └── LeftSidebar.tsx         # Collapsible navigation sidebar with view links
│   └── modals/
│       └── SeedModal.tsx           # Full-screen modal for scenario seed injection
│
└── features/
    ├── society-hub/
    │   ├── SocietyHub.tsx          # Composition shell: ChannelList + ChatFeed + AgentInspector
    │   ├── ChannelList.tsx         # Text/voice channel sidebar
    │   ├── ChatFeed.tsx            # Chat stream renderer + TICK ENGINE (setInterval lives here)
    │   └── MessageItem.tsx         # Individual message row with agent-click drilldown
    │
    ├── inspector/
    │   ├── AgentInspector.tsx      # Slide-in panel with agent stats + thought log
    │   └── ThoughtLog.tsx          # Animated mock reasoning trace feed
    │
    ├── world-map/
    │   ├── WorldMap.tsx            # Container with ResizeObserver + node click → inspector bridge
    │   ├── WorldGraphCanvas.tsx    # Memoized ForceGraph2D canvas with custom node painting
    │   ├── WorldMapOverlay.tsx     # HUD overlays (stats, legend, zoom hint)
    │   └── mapData.ts             # Legacy territory map data (UNUSED by current force-graph)
    │
    ├── analytics/
    │   └── MarketAnalytics.tsx     # KPI cards + Recharts (Area, Line, Bar) + diagnostics panel
    │
    └── citizens/
        ├── Citizens.tsx            # Searchable/filterable table + row → inspector bridge
        └── CitizenCard.tsx         # Legacy card component (UNUSED by current table view)
```

---

## 3. State Management Flow (Zustand)

### Store: `src/store/useWorldStore.ts`

The single `useWorldStore` Zustand store is split into two logical domains:

#### UI State (client-only, stays during backend integration)
| Field | Type | Purpose |
|-------|------|---------|
| `currentView` | `WorldView` | Active tab: `'hub' \| 'analytics' \| 'map' \| 'citizens' \| 'settings'` |
| `isSeedModalOpen` | `boolean` | Controls SeedModal visibility |
| `selectedAgent` | `Agent \| null` | Currently inspected agent (drives AgentInspector) |
| `activeChannel` | `string` | Active chat channel ID |

#### Simulation State (to be replaced by WebSocket events)
| Field | Type | Source during mock | Future WS event |
|-------|------|--------------------|-----------------|
| `isPlaying` | `boolean` | Local toggle | Stays local (play/pause controls WS subscription) |
| `currentTick` | `number` | `incrementTick()` | `tick.sync` |
| `messages` | `Message[]` | `generateMockMessage()` | `chat.message` |
| `analyticsData` | `AnalyticsPoint[]` | Random per tick | `analytics.tick` |
| `citizens` | `Citizen[]` | `generateCitizens()` | `citizens.snapshot` |
| `graphData` | `GraphData` | `buildGraphData()` | `graph.snapshot` |
| `awakeAgents` | `number` | Random drift | `tick.sync` |
| `rustRam` | `number` | Random drift | `tick.sync` |
| `totalAgents` | `number` | Static 1000 | `session.init` |

#### Key Actions
| Action | Current behavior | Future behavior |
|--------|-----------------|-----------------|
| `incrementTick()` | Generates mock message, analytics, RAM/agent drift | **DELETE** — replaced by WS event handlers |
| `injectSeed(title)` | Resets tick to 0, purges messages, injects system message | Sends `seed.inject` WS command, waits for `seed.applied` response |
| `togglePlay()` | Starts/stops `setInterval` in ChatFeed | Subscribes/unsubscribes from WS tick stream |

#### Tick Engine Location
The `setInterval` that drives mock ticks lives in **`ChatFeed.tsx`** (not in the store). It calls `incrementTick()` every 1500ms when `isPlaying === true`.

---

## 4. WebSocket Blueprint — Integration Registry

Every `🔗 [RUST-BINDING-POINT]` anchor inserted in the codebase, compiled as a migration checklist:

| # | File | Location | Mock behavior | Target WS event | Expected payload |
|---|------|----------|---------------|-----------------|-----------------|
| 1 | `useWorldStore.ts` | `INITIAL_MESSAGES` | 12 pre-generated messages | `session.init` | `{ messages: Message[] }` |
| 2 | `useWorldStore.ts` | `INITIAL_ANALYTICS` | 20 random analytics points | `session.init` | `{ analyticsHistory: AnalyticsPoint[] }` |
| 3 | `useWorldStore.ts` | `generateCitizens()` | 150 pseudo-random citizens | `citizens.snapshot` | `{ citizens: Citizen[] }` |
| 4 | `useWorldStore.ts` | `buildGraphData()` | Client-built graph from citizens | `graph.snapshot` | `{ nodes: GraphNode[], links: GraphLink[] }` |
| 5 | `useWorldStore.ts` | `injectSeed()` | Local state reset | `seed.applied` | `{ title, newTick: 0, systemMessage: Message }` |
| 6 | `useWorldStore.ts` | `incrementTick()` | Mock tick with random data | `tick.sync` | `{ tick, message, analytics, awakeAgents, rustRam }` |
| 7 | `ChatFeed.tsx` | `setInterval` | 1500ms polling loop | **DELETE** | N/A — server pushes events |
| 8 | `mockData.ts` | `CHANNELS` | Static 8 channels | `channels.list` | `{ channels: Channel[] }` |
| 9 | `mockData.ts` | `AGENTS` | Static 8 agents | `agents.list` | `{ agents: Agent[] }` |
| 10 | `mockData.ts` | `generateMockMessage()` | Random agent + template | **DELETE** | `chat.message` events arrive from server |
| 11 | `SeedModal.tsx` | `handleExecute()` | 800ms fake delay + local reset | `seed.inject` command | `{ title, audience, context }` |
| 12 | `MessageItem.tsx` | `handleAgentClick()` | Local `AGENTS_BY_ID` lookup | `agent.detail` | `{ agentId, ...Agent }` |
| 13 | `AgentInspector.tsx` | System Stats section | Deterministic mock values | `agent.detail` | `{ model, tokensPerTick, memoryUsage }` |
| 14 | `ThoughtLog.tsx` | `allLogs` consumption | Static `THOUGHT_LOGS` lookup | `agent.thought` stream | `{ agentId, logLine, isComplete }` |
| 15 | `MarketAnalytics.tsx` | Derived metrics section | Client-side random calculations | `analytics.tick` | `{ tick, positive, negative, tokens, adoption }` |

---

## 5. Performance Notes

- **All major components** are wrapped in `React.memo`
- **State selectors** use `useShallow` from `zustand/react/shallow` to prevent unnecessary re-renders
- **Heavy transformations** (graph data, citizen lookups, analytics derivations) use `useMemo`
- **Event handler props** use `useCallback` to maintain reference stability
- **ForceGraph2D** canvas rendering callbacks are all `useCallback`-stabilized
- **No `Math.random()` in render paths** — all mock values are deterministic or `useMemo`-cached

---

## 6. Known Legacy / Debt

| File | Issue |
|------|-------|
| `data/citizenData.ts` | Declares duplicate `Citizen` and `CitizenStatus` types that shadow `types/world.ts`. Only used by unused `CitizenCard.tsx`. |
| `features/citizens/CitizenCard.tsx` | Unused card component from earlier prototype iteration. |
| `features/world-map/mapData.ts` | Legacy SVG territory data, unused by current ForceGraph implementation. |
| `@supabase/supabase-js` | Listed in `package.json` but not imported anywhere — can be removed. |
