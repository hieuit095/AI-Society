# 🏙️ ZeroClaw AI Society

> **A real-time, tick-driven "God-Mode" operator dashboard simulating an autonomous synthetic civilization of 1,000+ AI agents.**

![Rust](https://img.shields.io/badge/Rust-1.76+-black?style=for-the-badge&logo=rust)
![React](https://img.shields.io/badge/React-18+-20232a?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue?style=for-the-badge&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**ZeroClaw AI Society is not a chatbot UI.** It is a complex, Tokio tick-driven simulation engine where hundreds to thousands of AI agents coexist, reason, remember, collaborate, compete, and react to operator-injected scenarios in real time.

---

## 🌌 Vision & Objectives

The primary objective of the AI Society is to simulate emergent behavior at scale. It provides a cyberpunk "God-Mode" aesthetic for monitoring and controlling a sprawling digital metropolis.

- **Emergent Social Dynamics:** Observe how a massive synthetic civilization responds to injected "Black Swan" events.
- **AI Economic Routing:** Test autonomous resource allocation and inference routing across 1,000+ concurrent agents.
- **Multi-Agent Orchestration:** Create a robust framework capable of stable memory usage and fast cold starts at massive scale.

---

## ⚙️ Core Architecture & Operating Logic

The architecture enforces the fundamental paradigm: **"Rust Owns Reality"**. The Rust backend is the absolute authority over time, state, and simulation logic.

### Backend (Rust/Tokio)
- **Tick Engine:** A Tokio-based async tick-engine drives the world clock.
- **Lock-Free Concurrency:** Lock-free concurrent LLM execution prevents bottlenecks.
- **WebSocket Fan-Out:** An authoritative, WebSocket-first transport layer projects committed state mutations to the frontend.

### ZeroClaw Framework (Agent Runtime)
- **Trait-Driven Runtimes:** Agents are instantiated via trait-driven definitions.
- **Modular Prompt Assembly:** Context is dynamically constructed (`IDENTITY.md`, `SOUL.md`, tools) per agent.
- **Tool Access by Role:** Agents are provisioned with specific capabilities—engineers have file/git tools, researchers have web search, while standard citizens may have none.
- **Reactive LLM Scheduler & JIT Context Injection:** Agents are not deaf. N-to-N communication is facilitated through a Reactive Scheduler and Just-In-Time Context Injection, allowing agents to accurately process channel history and mention each other (`@AGT-XXX`).

### Memory (SQLite FTS5)
- **Relational Memory:** Long-term memories and inter-agent relationships are stored reliably.
- **Hybrid Search (BM25 + Vectors):** Agents recall historical context via SQLite FTS5 `MATCH` queries alongside vector similarity search prior to their LLM turn, giving them historical continuity without blowing up RAM.

### Frontend (React/Vite)
- **DOM Virtualization:** `@tanstack/react-virtual` efficiently renders the massive citizen registry and append-only chat feeds.
- **State Hydration:** Zustand manages the strictly projected UI state from the authoritative WebSocket feed.
- **Force-Graph Topologies:** `react-force-graph-2d` visualizes real-time, dynamic agent communication networks.

### Economics & Routing Strategy
Running 1,000+ agents requires bounded inference costs.
- **5% "Elite" Agents:** Leadership and crisis coordinators route to Cloud LLMs (e.g., OpenAI, Anthropic) for executive synthesis.
- **95% "Citizen" Agents:** The vast majority of the population routes to Local LLMs (e.g., Ollama) for high-frequency, local decisions and ambient chatter.

---

## 🚀 Prerequisites

To run the AI Society, ensure the following tools are installed:

- **Rust:** `1.76+`
- **Node.js:** `v20+`
- **SQLite:** For the authoritative world-state store.
- **Ollama:** Running locally to power the 95% Citizen inference tier.

---

## 🛠️ Installation & Setup

### Step 1: Clone the repository
```bash
git clone https://github.com/hieuit095/AI-Society
cd AI-Society
```

### Step 2: Frontend Setup
Install the necessary React/Vite dependencies:
```bash
npm install
```

### Step 3: Backend Execution (Critical)
The Rust tick engine **must** be run in release mode. Debug mode will cause tick slippage and performance degradation at the 1,000-agent scale.
```bash
cargo run -p society-server --release
```

### Step 4: Running the Frontend
In a separate terminal, launch the dashboard:
```bash
npm run dev
```

---

## 🕹️ Usage & "God-Mode" Operations

Open `http://localhost:5173` to access the operator dashboard.

- **The Black Swan Scenario:** Use the "Inject Seed" modal to reset the world clock to `0` and inject a system directive (e.g., "Global AGI Network Outage"). All agents will awaken to the new reality, purging prior context.
- **Force-Graph Interaction:** Observe the society's communication graph via the interactive topology visualization.
- **Agent Inspector:** Click on any agent node or message to open the slide-in inspector, revealing their system stats, model routing details, memory usage, and live thought-log reasoning traces.
- **Live Channels:** Monitor the real-time discourse across public and private society channels.

---

## 📂 Project Structure

```text
.
├── society-core/       # Domain types, event schemas, world state, ids, and role definitions
├── society-server/     # Authoritative tick engine, LLM routing, SQLite memory, and WS fan-out
├── src/                # React/Vite frontend dashboard
│   ├── components/     # Reusable UI elements
│   ├── features/       # Feature-specific components (e.g., ChatFeed, ForceGraph)
│   ├── store/          # Zustand store for WebSocket payload hydration
│   └── types/          # TypeScript interfaces for WebSocket contracts
├── docs/               # System architecture, prompt templates, and protocol specs
├── Cargo.toml          # Rust workspace definition
└── package.json        # Frontend dependencies
```

---

## 🤝 Contribution & License

Contributions are welcome! If you're interested in refining the reactive scheduler, optimizing the SQLite FTS5 queries, or improving the frontend virtualization, please open an issue or submit a pull request.

This project is licensed under the MIT License.
