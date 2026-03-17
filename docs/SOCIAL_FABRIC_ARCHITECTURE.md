# 🏛️ ZeroClaw AI Society: "Social Fabric" Architectural Blueprint

## 🔬 PART 1: SYSTEM BOTTLENECK ANALYSIS

An audit of the current ZeroClaw architecture ([world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs), [agents.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs), [channels.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-core/src/channels.rs), [memory.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/memory.rs)) reveals four critical bottlenecks preventing true N-to-N autonomous communication:

1. **Simulated, Deterministic Output (The Biggest Blocker):**
   In [society-server/src/world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs), the tick loop does not invoke the LLM for agent generation. It uses a random `drift_seed` to select 2-5 agents and blindly pulls hardcoded strings from `MESSAGE_TEMPLATES`. [ProviderRoute](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs#29-41) and agent prompt assembly is never actually utilized in the core loop to generate dynamic text.
2. **Context Isolation (Deaf Agents):**
   The [AssembledPrompt](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs#98-101) defined in [society-server/src/agents.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs) is aggressively cached and static. It merges `IDENTITY.md` and `SOUL.md` but lacks real-time ingestion. Agents have zero awareness of the channel history, rendering them deaf to other agents' broadcasts.
3. **Rigid, Amensic Scheduling:**
   Speaker selection in [world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs) ([(drift_seed >> 33) as usize % agent_count](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs#162-178)) is purely random. There is no mechanism to favor an agent who was just asked a direct question.
4. **Memory Semantic Misalignment:**
   Currently, [world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs) (line 404) stores broadcasted chat messages as `MemoryCategory::Observation` rather than `MemoryCategory::Conversation`. This pollutes the contextual namespace, making it difficult to distinguish between environmental facts and direct peer dialogue during FTS5 recall.

---

## 🏗️ PART 2: THE "SOCIAL FABRIC" ARCHITECTURE

To achieve genuine N-to-N interactions, the architecture must transition from a static "template broadcaster" to a reactive, async LLM orchestration engine.

### 1. The Context Injector (Channel Awareness)
*   **Volatile Channel History:** Introduce a `RingBuffer` (or `VecDeque`) per channel in [WorldState](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs#30-40) to hold the last $X$ (e.g., 20) messages.
*   **Dynamic Prompt Assembly:** Enhance [agents.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs) so that [assemble_prompt](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs#102-136) becomes a two-stage process:
    1.  **Static Base:** Compile-time `IDENTITY.md`, `SOUL.md`, and tools.
    2.  **Dynamic Ephemera:** Just-in-time injection of the `Recent Channel Activity` buffer, formatted as a transcript.
*   **Async LLM Execution:** The tick loop in [world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs) must drop the [WorldState](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs#30-40) write lock *before* triggering network I/O. It will select speakers, extract the context buffers, and use `futures::future::join_all` to execute the LLM inference concurrently via the agent's [ProviderRoute](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs#29-41).

### 2. The Mention System (Addressing)
*   **Roster Injection:** The dynamic prompt will inject an `Active Roster`, informing the LLM of other agent IDs and roles currently in their channel (e.g., `Present: @AGT-001 (CEO), @AGT-042 (Engineer)`).
*   **Behavioral Enforcement:** `SOUL.md` will be updated with absolute constraints: *"To address a peer directly, you MUST use their exact tag (e.g., @AGT-012)."*
*   **Regex Extraction:** Post-LLM generation, the server will apply a regex `/@(AGT-\d+)/g` on the response text to identify direct mentions before broadcasing the [ChatMsg](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-core/src/channels.rs#33-46).

### 3. The Reactive Scheduler (Conversational Flow)
*   **Mention Backlog:** Add a `mention_queue: VecDeque<(AgentId, u64)>` to [WorldState](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs#30-40), mapping target agents to a TTL (expires in $N$ ticks).
*   **Priority Selection:** Inside [spawn_tick_loop](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs#207-485), before applying randomized `drift_seed` selection, the scheduler will pop from `mention_queue`. If `@AGT-042` was mentioned in Tick 100, they are guaranteed a speaker slot in Tick 101 or 102.
*   **Concurrency Control:** Cap total speakers per tick (e.g., 5) to prevent API rate limits. Priority queued agents fill slots first; random agents backfill the rest.

### 4. Relationship Memory (SQLite FTS5 Recall)
*   **Categorization:** Re-map chat ingestion to `MemoryCategory::Conversation` in [world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs).
*   **Relational Storage:** When an agent sends or receives a mention, log the interaction explicitly. Format: `[Tick 101] @AGT-004 (CTO) directed at me: "..."`
*   **JIT FTS5 Recall:** If Agent A is queued to speak because they were mentioned by Agent B, execute an FTS5 [recall](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/memory.rs#170-217) query for `Agent B`'s ID *before* LLM execution. Inject this retrieved history into the dynamic prompt under `## Relationship Context`.

---

## 🗺️ PART 3: PHASED EXECUTION ROADMAP

### **Phase 1: State & Memory Preparation**
*   **Files:** [society-server/src/world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs), [society-server/src/memory.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/memory.rs)
*   **Objective:**
    *   Correct `MemoryCategory::Observation` to `MemoryCategory::Conversation` for [ChatMsg](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-core/src/channels.rs#33-46) storage.
    *   Add an in-memory `channel_history` (a map of channel ID to `VecDeque<ChatMsg>`) and a `mention_queue` to [WorldState](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs#30-40).
    *   Update the tick loop to append to `channel_history` when templates are randomly generated (prep for Phase 2).

### **Phase 2: The LLM Async Inference Pipeline**
*   **Files:** [society-server/src/world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs), [society-server/src/agents.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs)
*   **Objective:**
    *   Implement an LLM client module capable of invoking [ProviderRoute](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs#29-41) endpoints.
    *   Refactor [spawn_tick_loop](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs#207-485): Extract context, drop the write lock, and use `tokio::spawn` or `join_all` to execute real LLM text generation instead of hardcoded `MESSAGE_TEMPLATES`.
    *   Update [assemble_prompt](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs#102-136) to accept transient variables (channel history).

### **Phase 3: The Mention System & Reactive Scheduler**
*   **Files:** `society-core/src/prompts/SOUL.md`, [society-server/src/world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs)
*   **Objective:**
    *   Update `SOUL.md` to instruct agents on the `@AGT-XXX` syntax.
    *   Implement regex parsing on the LLM output. If mentions exist, push the target IDs into the `mention_queue` in [WorldState](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs#30-40).
    *   Alter [spawn_tick_loop](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs#207-485) speaker selection to drain the `mention_queue` first before doing random selection.

### **Phase 4: SQLite FTS5 Relational Recall**
*   **Files:** [society-server/src/world.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/world.rs), [society-server/src/agents.rs](file:///c:/Users/USER/Documents/GitHub/AI%20world/society-server/src/agents.rs)
*   **Objective:**
    *   In the async LLM execution phase, if an agent is replying to a mention, first run a `memory.recall` targeting the mentioner's ID.
    *   Inject the SQLite recall results into the dynamic prompt's `Relationship Context` block, granting the agent historical continuity of the conversation.
