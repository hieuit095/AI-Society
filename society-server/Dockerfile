# ─────────────────────────────────────────────────────────────
# ZeroClaw AI Society — Rust Backend (multi-stage)
# ─────────────────────────────────────────────────────────────

# ── Builder ──────────────────────────────────────────────────
FROM rust:1.76-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# 1. Copy workspace manifests first for dependency caching
COPY Cargo.toml Cargo.lock ./
COPY society-core/Cargo.toml society-core/Cargo.toml
COPY society-server/Cargo.toml society-server/Cargo.toml

# 2. Create stub source files so `cargo build` can resolve the dep graph
RUN mkdir -p society-core/src && echo "// stub" > society-core/src/lib.rs \
    && mkdir -p society-server/src && echo "fn main() {}" > society-server/src/main.rs

# 3. Build dependencies only (cached layer)
RUN cargo build --release --package society-server 2>/dev/null || true

# 4. Copy real source and rebuild
COPY society-core/ society-core/
COPY society-server/ society-server/

# Touch main.rs to invalidate the stub binary, not the dep cache
RUN touch society-server/src/main.rs society-core/src/lib.rs

RUN cargo build --release --package society-server

# ── Runtime ──────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 zeroclaw \
    && useradd --uid 1000 --gid zeroclaw --create-home zeroclaw

WORKDIR /app

# Copy the compiled binary
COPY --from=builder /build/target/release/society-server /app/society-server

# Copy prompt templates used by agents at runtime
COPY --from=builder /build/society-server/prompts/ /app/prompts/

# Persistent data directory for SQLite memory store
RUN mkdir -p /app/data && chown -R zeroclaw:zeroclaw /app
VOLUME ["/app/data"]

USER zeroclaw

EXPOSE 4000

ENV RUST_LOG="society_server=info,society_core=info"

CMD ["./society-server"]
