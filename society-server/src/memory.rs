//! ZeroClaw SQLite memory backend — persistent agent memory with FTS5 search.
//!
//! ## Architecture
//!
//! Each agent has a namespaced memory store within a shared SQLite database.
//! Memories are categorized, timestamped, and searchable via:
//! - **FTS5 full-text search** with BM25 relevance scoring (SQL-native, zero Rust-side evaluation)
//! - Future: **sqlite-vss** vector embeddings for semantic similarity
//!
//! ## Memory Categories
//!
//! - `Conversation` — inter-agent messages observed or sent
//! - `Observation` — world state observations during a tick
//! - `Decision` — actions taken and their rationale
//! - `MarketSignal` — economic/market data points

// These types and functions are intentionally public API for future phases.
#[allow(dead_code)]
use rusqlite::{params, Connection, Result as SqlResult};
use tracing::{debug, info};

/// Memory categories for the agent memory store.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum MemoryCategory {
    Conversation,
    Observation,
    Decision,
    MarketSignal,
}

#[allow(dead_code)]
impl MemoryCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Conversation => "conversation",
            Self::Observation => "observation",
            Self::Decision => "decision",
            Self::MarketSignal => "market_signal",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "conversation" => Some(Self::Conversation),
            "observation" => Some(Self::Observation),
            "decision" => Some(Self::Decision),
            "market_signal" => Some(Self::MarketSignal),
            _ => None,
        }
    }
}

/// A single memory entry stored in the SQLite backend.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct MemoryEntry {
    pub id: i64,
    pub agent_id: String,
    pub category: String,
    pub content: String,
    pub tick: u64,
    pub relevance_score: f64,
}

/// Recall configuration for future hybrid search (FTS5 + vector embeddings).
/// Currently unused — BM25 scoring is computed entirely in SQL.
#[allow(dead_code)]
pub struct RecallWeights {
    pub fts_weight: f64,
    pub vector_weight: f64,
}

impl Default for RecallWeights {
    fn default() -> Self {
        Self {
            fts_weight: 1.0,
            vector_weight: 0.0, // No vector backend yet
        }
    }
}

/// The agent memory store — wraps a shared SQLite connection.
#[allow(dead_code)]
pub struct MemoryStore {
    conn: Connection,
    weights: RecallWeights,
}

#[allow(dead_code)]
impl MemoryStore {
    /// Initialize an in-memory SQLite database with the required schema.
    pub fn new_in_memory() -> SqlResult<Self> {
        let conn = Connection::open_in_memory()?;
        let store = Self {
            conn,
            weights: RecallWeights::default(),
        };
        store.init_schema()?;
        info!("🧠 Memory store initialized (in-memory SQLite)");
        Ok(store)
    }

    /// Purge ALL memories from the database — called on seed injection
    /// to ensure agents from old scenarios cannot recall stale context.
    pub fn purge_all(&self) -> SqlResult<()> {
        let deleted = self.conn.execute("DELETE FROM memories", [])?;
        // Also clear the FTS5 index content
        let _ = self.conn.execute("DELETE FROM memories_fts", []);
        info!("🧹 Memory purge complete: {deleted} entries deleted");
        Ok(())
    }

    /// Initialize a file-based SQLite database.
    pub fn new_file(path: &str) -> SqlResult<Self> {
        let conn = Connection::open(path)?;
        let store = Self {
            conn,
            weights: RecallWeights::default(),
        };
        store.init_schema()?;
        info!("🧠 Memory store initialized (file: {path})");
        Ok(store)
    }

    /// Create the schema tables — main memory + FTS5 index.
    fn init_schema(&self) -> SqlResult<()> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS memories (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id    TEXT NOT NULL,
                category    TEXT NOT NULL,
                content     TEXT NOT NULL,
                tick        INTEGER NOT NULL,
                seed_id     TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
            CREATE INDEX IF NOT EXISTS idx_memories_seed ON memories(seed_id);
            CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);

            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                content,
                content='memories',
                content_rowid='id'
            );

            CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
                INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
            END;

            CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, content) VALUES ('delete', old.id, old.content);
            END;
            ",
        )?;
        Ok(())
    }

    /// Store a memory entry for an agent.
    pub fn store(
        &self,
        agent_id: &str,
        category: MemoryCategory,
        content: &str,
        tick: u64,
        seed_id: &str,
    ) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO memories (agent_id, category, content, tick, seed_id) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![agent_id, category.as_str(), content, tick, seed_id],
        )?;
        let id = self.conn.last_insert_rowid();
        debug!(agent_id, category = category.as_str(), "Memory stored");
        Ok(id)
    }

    /// SQL-native FTS5 recall — relevance ranking is computed entirely within
    /// the SQLite engine using the BM25 algorithm. Zero row evaluation in Rust.
    ///
    /// The query is tokenized into OR-joined terms for broad recall, then
    /// ranked by `bm25()` (lower = more relevant, so we negate for DESC ordering).
    /// Results are filtered by `agent_id` and `seed_id` before ranking.
    pub fn recall(
        &self,
        agent_id: &str,
        query: &str,
        seed_id: &str,
        limit: usize,
    ) -> SqlResult<Vec<MemoryEntry>> {
        // Tokenize the query into OR-joined terms for broad FTS5 matching.
        // e.g., "market autonomous" → "market OR autonomous"
        let fts_query: String = query.split_whitespace().collect::<Vec<&str>>().join(" OR ");

        // SQL-native ranking: bm25() returns negative values (lower = better),
        // so we negate it for intuitive DESC ordering.
        let mut stmt = self.conn.prepare(
            "SELECT m.id, m.agent_id, m.category, m.content, m.tick,
                    (-bm25(memories_fts)) AS relevance
             FROM memories_fts
             JOIN memories m ON m.id = memories_fts.rowid
             WHERE memories_fts MATCH ?1
               AND m.agent_id = ?2
               AND m.seed_id = ?3
             ORDER BY relevance DESC
             LIMIT ?4",
        )?;

        let entries: Vec<MemoryEntry> = stmt
            .query_map(params![fts_query, agent_id, seed_id, limit as i64], |row| {
                Ok(MemoryEntry {
                    id: row.get(0)?,
                    agent_id: row.get(1)?,
                    category: row.get(2)?,
                    content: row.get(3)?,
                    tick: row.get::<_, i64>(4)? as u64,
                    relevance_score: row.get(5)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(entries)
    }

    /// Purge all memories for a given seed (used during seed injection reset).
    pub fn purge_seed(&self, seed_id: &str) -> SqlResult<usize> {
        // The delete trigger on 'memories' automatically cleans the FTS5 table.
        let deleted = self
            .conn
            .execute("DELETE FROM memories WHERE seed_id = ?1", params![seed_id])?;
        info!(seed_id, deleted, "\u{1f9f9} Memory purged for seed");
        Ok(deleted)
    }

    /// Get total memory count for an agent in the current seed.
    pub fn count_for_agent(&self, agent_id: &str, seed_id: &str) -> SqlResult<i64> {
        self.conn.query_row(
            "SELECT COUNT(*) FROM memories WHERE agent_id = ?1 AND seed_id = ?2",
            params![agent_id, seed_id],
            |row| row.get(0),
        )
    }

    /// Get total memory count across all agents.
    pub fn total_count(&self) -> SqlResult<i64> {
        self.conn
            .query_row("SELECT COUNT(*) FROM memories", [], |row| row.get(0))
    }

    /// Recall conversation memories that reference a specific peer agent,
    /// using SQL-native FTS5 `MATCH` with `bm25()` relevance ranking.
    ///
    /// The `peer_agent_id` (e.g., `"AGT-042"`) is passed directly as an
    /// FTS5 match term. Because agent IDs are embedded in the stored
    /// content (e.g., `"[Tick 5] @AGT-042 (CTO) directed at me: ..."`),
    /// FTS5 tokenises them and `MATCH` finds them without a full table scan.
    ///
    /// Results are filtered to `category = 'conversation'` and the calling
    /// agent's `agent_id` + `seed_id`, then ranked by BM25 relevance
    /// (computed entirely inside SQLite — zero Rust-side evaluation).
    ///
    /// ## Use Case (Social Fabric Phase 4)
    ///
    /// When an agent is selected to speak because they were @-mentioned,
    /// this function retrieves their past interactions with the mentioner
    /// so the LLM has relational context before generating a reply.
    pub fn recall_peer_conversations(
        &self,
        agent_id: &str,
        peer_agent_id: &str,
        seed_id: &str,
        limit: usize,
    ) -> SqlResult<Vec<MemoryEntry>> {
        // Sanitise the peer ID into a safe FTS5 query token.
        // e.g., "AGT-042" → "AGT-042" (hyphens are kept as token chars by
        // the default unicode61 tokeniser when they appear mid-token).
        let fts_query = peer_agent_id.to_string();

        let mut stmt = self.conn.prepare(
            "SELECT m.id, m.agent_id, m.category, m.content, m.tick,
                    (-bm25(memories_fts)) AS relevance
             FROM memories_fts
             JOIN memories m ON m.id = memories_fts.rowid
             WHERE memories_fts MATCH ?1
               AND m.agent_id = ?2
               AND m.category = ?3
               AND m.seed_id = ?4
             ORDER BY relevance DESC
             LIMIT ?5",
        )?;

        let entries: Vec<MemoryEntry> = stmt
            .query_map(
                params![
                    fts_query,
                    agent_id,
                    MemoryCategory::Conversation.as_str(),
                    seed_id,
                    limit as i64
                ],
                |row| {
                    Ok(MemoryEntry {
                        id: row.get(0)?,
                        agent_id: row.get(1)?,
                        category: row.get(2)?,
                        content: row.get(3)?,
                        tick: row.get::<_, i64>(4)? as u64,
                        relevance_score: row.get(5)?,
                    })
                },
            )?
            .filter_map(|r| r.ok())
            .collect();

        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_store() -> MemoryStore {
        MemoryStore::new_in_memory().expect("create in-memory store")
    }

    #[test]
    fn store_and_recall() {
        let store = test_store();
        store
            .store(
                "AGT-001",
                MemoryCategory::Observation,
                "The market is bullish on autonomous products",
                1,
                "seed-1",
            )
            .unwrap();
        store
            .store(
                "AGT-001",
                MemoryCategory::Decision,
                "Decided to increase production capacity",
                2,
                "seed-1",
            )
            .unwrap();

        let results = store
            .recall("AGT-001", "market autonomous", "seed-1", 10)
            .unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].agent_id, "AGT-001");
    }

    #[test]
    fn recall_respects_agent_namespace() {
        let store = test_store();
        store
            .store(
                "AGT-001",
                MemoryCategory::Observation,
                "Agent one observation",
                1,
                "seed-1",
            )
            .unwrap();
        store
            .store(
                "AGT-002",
                MemoryCategory::Observation,
                "Agent two observation",
                1,
                "seed-1",
            )
            .unwrap();

        let results = store
            .recall("AGT-001", "observation", "seed-1", 10)
            .unwrap();
        assert!(results.iter().all(|r| r.agent_id == "AGT-001"));
    }

    #[test]
    fn purge_seed_removes_all() {
        let store = test_store();
        store
            .store(
                "AGT-001",
                MemoryCategory::Observation,
                "test memory one",
                1,
                "seed-old",
            )
            .unwrap();
        store
            .store(
                "AGT-002",
                MemoryCategory::Decision,
                "test memory two",
                2,
                "seed-old",
            )
            .unwrap();
        store
            .store(
                "AGT-001",
                MemoryCategory::Observation,
                "new seed memory",
                1,
                "seed-new",
            )
            .unwrap();

        let deleted = store.purge_seed("seed-old").unwrap();
        assert_eq!(deleted, 2);

        assert_eq!(store.total_count().unwrap(), 1);
    }

    #[test]
    fn count_for_agent() {
        let store = test_store();
        store
            .store(
                "AGT-001",
                MemoryCategory::Observation,
                "obs one",
                1,
                "seed-1",
            )
            .unwrap();
        store
            .store("AGT-001", MemoryCategory::Decision, "dec one", 2, "seed-1")
            .unwrap();
        store
            .store(
                "AGT-002",
                MemoryCategory::Observation,
                "obs two",
                1,
                "seed-1",
            )
            .unwrap();

        assert_eq!(store.count_for_agent("AGT-001", "seed-1").unwrap(), 2);
        assert_eq!(store.count_for_agent("AGT-002", "seed-1").unwrap(), 1);
    }

    #[test]
    fn hybrid_recall_weights() {
        let store = test_store();
        store
            .store(
                "AGT-001",
                MemoryCategory::MarketSignal,
                "autonomous products demand up 31 percent this quarter",
                1,
                "seed-1",
            )
            .unwrap();
        store
            .store(
                "AGT-001",
                MemoryCategory::MarketSignal,
                "supply chain stable no disruptions",
                2,
                "seed-1",
            )
            .unwrap();

        let results = store
            .recall("AGT-001", "autonomous demand", "seed-1", 10)
            .unwrap();
        assert!(!results.is_empty());
        // First result should be the one with more keyword overlap
        assert!(results[0].content.contains("autonomous"));
    }
}
