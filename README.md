# 🧗 rezervo-alpine

Alpine.js frontend for [rezervo](https://github.com/mathiazom/rezervo)

## 🛠️ Stack

- **Alpine.js** — reactive UI
- **Vite** — multi-page build
- **TypeScript** + **Zod** — typed API responses
- **Biome** — formatting and linting
- **OAuth2 PKCE** — auth via FusionAuth (no tokens in storage)

## 📄 Pages

| Route | Description |
|---|---|
| `/chains` | Chain picker (root redirect) |
| `/schedule/<chain>` | Weekly schedule + auto-booking config |
| `/sessions` | Upcoming bookings |
| `/login` | Login entry point |
| `/callback` | OAuth2 callback (also used for silent renew) |

## 🚀 Local development

```sh
pnpm install
cp public/config.json.example public/config.json
# edit public/config.json with real values
pnpm dev
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

These are injected into `/config.json` at container start by `docker/docker-entrypoint.sh`.
