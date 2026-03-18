//! Real-time analytics engine for the ZeroClaw society simulation.
//!
//! Computes per-tick KPIs: tokens burned, sentiment (positive/negative),
//! and adoption metric. All computation is server-side — the frontend
//! only renders the streamed data points.

use serde::{Deserialize, Serialize};

/// A single analytics data point emitted per tick.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsPoint {
    pub tick: u64,
    pub positive: u32,
    pub negative: u32,
    pub tokens: u64,
    pub adoption: u32,
    /// Cumulative simulated revenue derived from token burn (tokens × cost-per-token).
    pub simulated_revenue: f64,
    /// Actual wall-clock tick execution time in milliseconds.
    pub tick_latency_ms: u64,
    /// Total FTS5 recall execution time for this tick in milliseconds.
    pub recall_latency_ms: u64,
    /// Current depth of the broadcast channel queue.
    pub ws_queue_depth: usize,
}

/// Rolling analytics state — accumulates across ticks.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsEngine {
    /// Total tokens burned across all ticks in this scenario.
    pub cumulative_tokens: u64,
    /// Cumulative simulated revenue derived from token burn.
    pub cumulative_revenue: f64,
    /// Rolling positive sentiment counter.
    pub positive_sentiment: u32,
    /// Rolling negative sentiment counter.
    pub negative_sentiment: u32,
    /// Rolling adoption percentage (0-100).
    pub adoption_rate: u32,
    /// Deterministic seed for reproducible drift.
    drift_seed: u64,
}

impl AnalyticsEngine {
    pub fn new() -> Self {
        Self {
            cumulative_tokens: 0,
            cumulative_revenue: 0.0,
            positive_sentiment: 35,
            negative_sentiment: 15,
            adoption_rate: 12,
            drift_seed: 777,
        }
    }

    /// Reset all counters (called on seed injection).
    pub fn reset(&mut self) {
        self.cumulative_tokens = 0;
        self.cumulative_revenue = 0.0;
        self.positive_sentiment = 35;
        self.negative_sentiment = 15;
        self.adoption_rate = 12;
        self.drift_seed = 777;
    }

    /// Compute the analytics for a given tick based on the number of
    /// active agents and speakers this tick.
    ///
    /// Returns the computed `AnalyticsPoint`.
    pub fn compute_tick(
        &mut self,
        tick: u64,
        awake_agents: u32,
        speakers_this_tick: u32,
        tick_latency_ms: u64,
        recall_latency_ms: u64,
        ws_queue_depth: usize,
    ) -> AnalyticsPoint {
        // Tokens: each speaking agent burns 150-400 tokens per turn
        self.drift_seed = self
            .drift_seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(tick);
        let tokens_per_speaker = ((self.drift_seed >> 33) % 250) + 150;
        let tick_tokens = speakers_this_tick as u64 * tokens_per_speaker;
        self.cumulative_tokens += tick_tokens;

        // Revenue: each token costs ~$0.000142 (blended local/cloud rate)
        let tick_revenue = tick_tokens as f64 * 0.000142;
        self.cumulative_revenue += tick_revenue;

        // Sentiment drift — more speakers = more positive activity
        self.drift_seed = self
            .drift_seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(3);
        let sentiment_roll = (self.drift_seed >> 33) % 20;
        if speakers_this_tick > 3 {
            self.positive_sentiment = self
                .positive_sentiment
                .saturating_add(sentiment_roll as u32 % 8 + 1)
                .min(95);
            self.negative_sentiment = self
                .negative_sentiment
                .saturating_sub(sentiment_roll as u32 % 3)
                .max(5);
        } else {
            self.positive_sentiment = self
                .positive_sentiment
                .saturating_sub(sentiment_roll as u32 % 4)
                .max(10);
            self.negative_sentiment = self
                .negative_sentiment
                .saturating_add(sentiment_roll as u32 % 5 + 1)
                .min(80);
        }

        // Adoption: slowly increases as agents interact, capped at 100
        self.drift_seed = self
            .drift_seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(7);
        let adoption_delta = ((self.drift_seed >> 33) % 3) as u32;
        let awake_pct = if awake_agents > 0 {
            (awake_agents * 100) / 150
        } else {
            0
        };
        self.adoption_rate =
            ((self.adoption_rate as u64 + adoption_delta as u64 + awake_pct as u64 / 10).min(100))
                as u32;

        AnalyticsPoint {
            tick,
            positive: self.positive_sentiment,
            negative: self.negative_sentiment,
            tokens: self.cumulative_tokens,
            adoption: self.adoption_rate,
            simulated_revenue: self.cumulative_revenue,
            tick_latency_ms,
            recall_latency_ms,
            ws_queue_depth,
        }
    }
}

impl Default for AnalyticsEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_engine_has_baseline_values() {
        let engine = AnalyticsEngine::new();
        assert_eq!(engine.cumulative_tokens, 0);
        assert_eq!(engine.positive_sentiment, 35);
        assert_eq!(engine.negative_sentiment, 15);
        assert_eq!(engine.adoption_rate, 12);
    }

    #[test]
    fn compute_tick_accumulates_tokens() {
        let mut engine = AnalyticsEngine::new();
        let p1 = engine.compute_tick(1, 100, 3, 0, 0, 0);
        assert!(p1.tokens > 0);
        let tokens_after_1 = p1.tokens;

        let p2 = engine.compute_tick(2, 100, 4, 0, 0, 0);
        assert!(p2.tokens > tokens_after_1);
    }

    #[test]
    fn reset_clears_all_counters() {
        let mut engine = AnalyticsEngine::new();
        engine.compute_tick(1, 100, 5, 0, 0, 0);
        engine.compute_tick(2, 100, 4, 0, 0, 0);
        assert!(engine.cumulative_tokens > 0);

        engine.reset();
        assert_eq!(engine.cumulative_tokens, 0);
        assert_eq!(engine.positive_sentiment, 35);
        assert_eq!(engine.adoption_rate, 12);
    }

    #[test]
    fn many_speakers_increases_positive_sentiment() {
        let mut engine = AnalyticsEngine::new();
        let initial = engine.positive_sentiment;
        for t in 1..=20 {
            engine.compute_tick(t, 140, 5, 0, 0, 0);
        }
        assert!(engine.positive_sentiment > initial);
    }

    #[test]
    fn adoption_rate_bounded_at_100() {
        let mut engine = AnalyticsEngine::new();
        for t in 1..=500 {
            engine.compute_tick(t, 150, 5, 0, 0, 0);
        }
        assert!(engine.adoption_rate <= 100);
    }
}
