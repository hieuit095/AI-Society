# AI Society

> **A real-time, tick-driven "God-Mode" operator dashboard for a synthetic civilization of 1,000+ AI agents.**

![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![ZeroClaw Framework](https://img.shields.io/badge/ZeroClaw-Framework-blueviolet?style=for-the-badge)
![WebSocket](https://img.shields.io/badge/WebSocket-Data_Stream-green?style=for-the-badge)

---

## Vision & Concept

AI Society is a cyberpunk-themed, real-time "God-Mode" operator dashboard designed to monitor and control a localized synthetic civilization. **This is not a simple chatbot UI.** It is a complex, tick-driven simulation engine where hundreds to thousands of AI agents coexist, reason, remember, collaborate, compete, and react to operator-injected scenarios in real time.

The dashboard serves as a projection of a persistent, authoritative world state managed entirely by a high-performance Rust backend.

## Core Objectives & Applications

The primary goal of the AI Society is to simulate emergent behavior at scale, providing a testbed for complex scenarios such as:
- Simulating black swan events and observing emergent social responses.
- Testing AI economic routing and autonomous resource allocation.
- Tracking real-time market analytics, sentiment drift, and society adoption rates.

### LLM Economics Strategy
Operating a society of 1,000+ agents requires a sustainable economic model for inference. The simulation relies on a strict cost-tier routing architecture:
- **5% Elite Cloud Models:** Top-tier agents (CEOs, Crisis Coordinators, Synthesis Agents) route through ZeroClaw to elite cloud providers (e.g., OpenAI, Anthropic) for complex synthesis and strategic decisions.
- **95% Citizen Local Models:** The vast majority of agents handle ambient chatter, routine reactions, and low-stakes memory updates using local or near-local inference (e.g., Ollama or OpenAI-compatible local endpoints) via ZeroClaw.

## Technical Architecture & Stack

The architecture is built around the fundamental paradigm: **"Rust Owns Reality"**. The Rust backend is the absolute authority over time, state, and simulation logic. The React frontend is strictly a WebSocket-driven projection of that reality.

### Backend (The Authority)
- **Language:** Rust (Stable)
- **Runtime:** Tokio (Tick Engine and async task orchestration)
- **Transport:** Axum / tokio-tungstenite (WebSocket server layer)
- **Agent Framework:** ZeroClaw (Trait-driven identity, prompt assembly, and toolset mapping)
- **Memory:** SQLite with FTS5 BM25 Hybrid Search (Vector + keyword recall, strictly non-blocking I/O on async threads)

### Frontend (The Projection)
- **Framework:** React 18 / Vite
- **State:** Zustand
- **Styling:** Tailwind CSS
- **Visualization:** react-force-graph-2d (Topology), Recharts (Analytics)

## Prerequisites

To run the AI Society locally, ensure your host machine has the following installed:

- **Rust & Cargo:** For compiling and running the backend engine.
- **Node.js (v20+):** For the React frontend tooling.
- **Git:** For version control and cloning the repository.
- **Ollama:** Required for local model inference powering the 95% Citizen tier. Ensure it is running and populated with your preferred models.

## Installation & Localhost Setup

Follow these steps to launch the simulation environment:

**Step 1: Clone and install frontend dependencies**
```bash
git clone https://github.com/hieuit095/AI-Society
cd AI-Society
npm install
```

**Step 2: Start the Rust Backend Engine**
*Crucial:* The simulation engine must be run in release mode to handle the high-throughput tick loop and 1,000-agent concurrency.
```bash
cargo run -p society-server --release
```

**Step 3: Start the Vite Frontend**
In a new terminal instance, start the operator dashboard:
```bash
npm run dev
```

## Usage & "God-Mode" Operations

Once both the backend and frontend are running, open your browser to `http://localhost:5173` to access the operator dashboard.

### Operator Capabilities

- **Seed Injection Pipeline:** Use the full-screen "Inject Seed" modal to trigger new scenarios (e.g., a "Black Swan" event or "Post-AGI Consumer Economy"). Injecting a seed purges prior context, resets the simulation tick, and awakens agents to react to the new reality.
- **World Map Topology:** Observe the society's communication graph via the interactive force-graph topology visualization.
- **Citizen Registry:** Browse, search, and filter the virtualized table of all citizen agents.
- **Live Chat Feed:** Monitor the real-time, append-only discourse across society channels.
- **Agent Inspector:** Click on any agent node or message to open the slide-in inspector, revealing their system stats, model routing details, memory usage, and live thought-log reasoning traces.
