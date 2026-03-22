# ── Stage 1: Build auth proxy ─────────────────────────────────────────────────
FROM rust:alpine AS proxy-builder

RUN apk add --no-cache musl-dev

WORKDIR /app

# Cache dependencies
COPY auth-proxy/Cargo.toml auth-proxy/Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm src/main.rs

COPY auth-proxy/src ./src
RUN touch src/main.rs && cargo build --release

# ── Stage 2: Build frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ── Stage 3: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY docker/nginx.conf /etc/nginx/conf.d/app.conf
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=proxy-builder /app/target/release/auth-proxy /auth-proxy
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
