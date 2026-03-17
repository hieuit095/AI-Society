# ─────────────────────────────────────────────────────────────
# ZeroClaw AI Society — React/Vite Frontend (multi-stage)
# ─────────────────────────────────────────────────────────────

# ── Builder ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Install dependencies (cached layer)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# 2. Copy source and build
COPY index.html vite.config.ts tsconfig*.json tailwind.config.js postcss.config.js eslint.config.js ./
COPY src/ src/

RUN npm run build

# ── Runtime ──────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# Remove default Nginx site
RUN rm /etc/nginx/conf.d/default.conf

# SPA-aware Nginx configuration
COPY <<'EOF' /etc/nginx/conf.d/zeroclaw.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression for static assets
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
    gzip_min_length 256;

    # Cache static assets aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback — all non-file routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Copy built static files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
