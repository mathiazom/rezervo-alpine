# 🧗 rezervo-alpine

Alpine.js frontend for [rezervo](https://github.com/mathiazom/rezervo)

## 🛠️ Stack

- **Alpine.js** — reactive UI
- **Vite** — multi-page build
- **TypeScript** + **Zod** — typed API responses
- **Biome** — formatting and linting
- **OAuth2 PKCE** — auth via FusionAuth; access token in memory, refresh token in httpOnly cookie
- **Rust** (`axum` + `tokio` + `reqwest`) — thin auth proxy compiled into the Docker image

## 📄 Pages

| Route | Description |
|---|---|
| `/chains` | Chain picker (root redirect) |
| `/schedule/<chain>` | Weekly schedule + auto-booking config |
| `/sessions` | Upcoming bookings |
| `/login` | Login entry point |
| `/callback` | OAuth2 callback |

## 🚀 Local development

```sh
pnpm install
cp public/config.json.example public/config.json
cp template.env .env
# edit public/config.json and .env with real values

pnpm dev        # Vite dev server on :3000 (proxies /auth → :4000)
pnpm dev:auth   # auth proxy on :4000 (requires Rust / cargo)
```

## ✨ CI scripts

```sh
pnpm typecheck   # tsc --noEmit
pnpm check       # biome ci (format + lint)
pnpm build       # vite build → dist/
```

To auto-fix formatting locally:

```sh
pnpm format
```

## 🐳 Docker

### With Docker Compose

```sh
cp template.env .env
# edit .env with real values
docker compose up --build
```

### Manual

```sh
docker build -t rezervo-alpine .
docker run -p 8080:80 \
  -e FUSIONAUTH_URL=https://auth.example.com \
  -e FUSIONAUTH_CLIENT_ID=your-client-id \
  -e APP_URL=http://localhost:8080 \
  -e API_URL=https://api.example.com \
  rezervo-alpine
```

App is available at `http://localhost:8080`.

## ⚙️ Environment variables

| Variable | Description |
|---|---|
| `FUSIONAUTH_URL` | FusionAuth base URL |
| `FUSIONAUTH_CLIENT_ID` | OAuth2 client ID |
| `APP_URL` | Public URL of this app (used as OAuth2 redirect base) |
| `API_URL` | rezervo API base URL |

`FUSIONAUTH_URL`, `FUSIONAUTH_CLIENT_ID`, and `APP_URL` are also read by the auth proxy at startup. All four are injected into `/config.json` at container start by `docker/docker-entrypoint.sh`.
