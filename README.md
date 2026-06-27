# MC Manager Client

The web frontend for [mc-manager](https://github.com/lomokwa/mc-manager) — start/stop the Minecraft server, watch a live console, browse players, and edit server properties.

Built with **React + TypeScript + Vite** (React Router, lucide-react icons).

## Setup

```bash
npm install
cp .env.example .env   # then edit .env
npm run dev
```

The dev server runs on <http://localhost:5173>.

## Configuration

The client talks directly to the mc-manager API, configured via `VITE_*` environment variables (see [`.env.example`](.env.example)). Vite only exposes variables prefixed with `VITE_`.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE` | `http://localhost:8080/api` | Base URL of the REST API (no trailing slash). |
| `VITE_WS_URL` | `ws://localhost:8080/api/console` | WebSocket URL for the live console. |
| `VITE_API_KEY` | _(empty)_ | API key, sent as `X-API-Key` (and `?key=` on the WebSocket). Must match the server's `API_KEY`. |

> ⚠️ `VITE_API_KEY` is bundled into the built client and is readable by anyone who loads the page. Keep this app behind your own network/auth and don't ship a privileged key to an untrusted audience.

Make sure the API's CORS allow-list includes this app's origin — the mc-manager server allows `http://localhost:5173` by default.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR. |
| `npm run build` | Type-check, then build to `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint. |

## Build

```bash
npm run build      # outputs static files to dist/
```

Serve `dist/` from any static host — or from the mc-manager server itself.
