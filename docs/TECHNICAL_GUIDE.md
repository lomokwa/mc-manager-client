# MC Manager — Frontend Technical Guide

> **Repo:** [`lomokwa/mc-manager-client`](https://github.com/lomokwa/mc-manager-client) · React 19 + TypeScript + [Vite](https://vite.dev/) · [React Router](https://reactrouter.com/) · plain CSS (no Tailwind/component library)
> **Sibling repo:** [`lomokwa/mc-manager-server`](https://github.com/lomokwa/mc-manager-server) — see its own [`docs/TECHNICAL_GUIDE.md`](https://github.com/lomokwa/mc-manager-server/blob/main/docs/TECHNICAL_GUIDE.md) for the backend.
> **Português:** [`docs/GUIA_TECNICO.md`](GUIA_TECNICO.md)
>
> This guide describes the code as of commit [`ce2a64c`](https://github.com/lomokwa/mc-manager-client/commit/ce2a64c). Line-number links can drift as the file changes; if a link lands a few lines off, search the file for the function/symbol name given next to it — those don't drift.

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Repository layout](#2-repository-layout)
3. [Routing](#3-routing)
4. [The API layer — `apiFetch`](#4-the-api-layer--apifetch)
5. [State management — contexts](#5-state-management--contexts)
6. [Pages reference](#6-pages-reference)
7. [Key components](#7-key-components)
8. [The console subsystem](#8-the-console-subsystem)
9. [Design system](#9-design-system)
10. [Testing](#10-testing)
11. [Build & deploy](#11-build--deploy)
12. [Backend, in brief](#12-backend-in-brief)
13. [Cookbook — "I want to…"](#13-cookbook--i-want-to)
14. [Glossary](#14-glossary)

---

## 1. Architecture overview

A single-page app talking to the [mc-manager-server](https://github.com/lomokwa/mc-manager-server) REST API and console WebSocket over HTTP(S)/WSS — no other backend coupling; no generated client, no shared types package. The entire contract is the `{success, data, error}` JSON envelope (see [§4](#4-the-api-layer--apifetch)) and the route table documented in the server repo's guide.

**The defining pattern in this codebase is graceful degradation.** Every feature that talks to the API is written to keep working — minus that one feature — against an *older* server build that doesn't have the endpoint yet, and to distinguish that from "the account isn't allowed" and from "the network is down." This isn't incidental: this client and the server ship from two separate repos on two separate deploy pipelines, so the client is routinely a version or two ahead of whatever server build is actually live. See [§4](#4-the-api-layer--apifetch) for the exact mechanism.

## 2. Repository layout

```
src/App.tsx                 Route table + provider nesting (see §3)
src/main.tsx                ReactDOM root

src/context/                Global state: auth, the managed server's live
                              state, the server registry, permissions.
src/pages/                   One folder per route. Page + its own .css.
src/components/              Reusable pieces used by more than one page
                              (or complex enough to warrant their own file).
src/lib/                     Pure, framework-free logic: API calls, parsers,
                              formatters. This is where the unit tests live
                              (paired 1:1 with tests/*.test.ts).
src/types/                   Small shared TS interfaces (Player, User,
                              server.properties shape).

tests/                       node:test files, one per src/lib/*.ts module
                              that has meaningful logic to test.
```

## 3. Routing

[`src/App.tsx`](../src/App.tsx) defines the whole route table. Two routes are public and outside the app shell entirely — `/legal/selton-mello-bot/privacy` and `/terms`, static pages for the Discord bot's own Discord-app-directory listing, not linked from any nav. Everything else sits behind `ProtectedRoute` (redirects to `/login` if `!isAuthenticated`) and a stack of four context providers, nested in an order that matters:

```tsx
<ServersProvider>       {/* the multi-server registry — ServerProvider reads currentServerId from this */}
  <ServerProvider>       {/* the CURRENTLY MANAGED server's live state + WebSocket */}
    <ToastProvider>
      <PermissionsProvider>   {/* Sidebar/Navbar both call usePermissions() */}
        <Sidebar /><Navbar /><Routes>...</Routes>
```

**Route table** (path → component → file → the permission(s) that show it in the sidebar — see [`src/components/sidebar/Sidebar.tsx`](../src/components/sidebar/Sidebar.tsx)'s `navItems`; a route is still directly reachable by URL even when the sidebar hides it, since gating is cosmetic-only, not a router guard):

| Path | Component | File | Sidebar needs |
|---|---|---|---|
| `/` | Console | [`pages/console/Console.tsx`](../src/pages/console/Console.tsx) | `console.read` |
| `/overview` | Overview | [`pages/overview/Overview.tsx`](../src/pages/overview/Overview.tsx) | `overview.view` |
| `/activity` | Activity | [`pages/activity/Activity.tsx`](../src/pages/activity/Activity.tsx) | `activity.view` |
| `/servers` | Servers | [`pages/servers/Servers.tsx`](../src/pages/servers/Servers.tsx) | none — gated on `useServers().supported` instead (see [§5.3](#53-serverscontext--the-multi-server-registry)) |
| `/players` | Players | [`pages/players/Players.tsx`](../src/pages/players/Players.tsx) | `players.view` |
| `/performance` | Performance | [`pages/performance/Performance.tsx`](../src/pages/performance/Performance.tsx) | `performance.view` |
| `/users` | Users | [`pages/users/Users.tsx`](../src/pages/users/Users.tsx) | `admin.manage_users` or `admin.manage_roles` |
| `/files` | Files | [`pages/files/Files.tsx`](../src/pages/files/Files.tsx) | `files.read` |
| `/backups` | Backups | [`pages/backups/Backups.tsx`](../src/pages/backups/Backups.tsx) | `backups.view` |
| `/server` | ServerSetup | [`pages/server/ServerSetup.tsx`](../src/pages/server/ServerSetup.tsx) | `server.start` |
| `/settings` | Settings | [`pages/settings/Settings.tsx`](../src/pages/settings/Settings.tsx) | none — browser-local prefs only |
| `/account` | Account | [`pages/account/Account.tsx`](../src/pages/account/Account.tsx) | not in the sidebar list; reached via the user chip |
| `/login`, `/register` | Login, Register | [`pages/auth/`](../src/pages/auth/) | public |

## 4. The API layer — `apiFetch`

**File:** [`src/lib/api.ts`](../src/lib/api.ts). Read it in full — it's short, and every data-fetching call site in the app depends on the contract it defines.

```ts
export type ApiResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'unsupported' }                // 404 — this server build doesn't have the endpoint
  | { kind: 'unauthorized' }               // 401 — token missing/expired
  | { kind: 'forbidden'; message: string } // 403 — signed in, but not allowed
  | { kind: 'error'; message: string }     // reachable, but failed (4xx/5xx or success:false)
  | { kind: 'network' }                    // fetch() threw — truly unreachable
```

`apiFetch<T>(path, init)` checks `res.status` **before** parsing the body — a 404 from Gin is `text/plain`, and calling `res.json()` on it throws, which used to be misread as a network failure (the actual bug that shipped once: Files/Backups pages showed "Could not reach the server" against a server build that simply didn't have those routes yet).

**Why `forbidden` is its own kind, not folded into `error`:** a 403 and a 404 look identical to any caller that only checks `kind !== 'ok'`. That ambiguity has a real, measured cost — it's exactly how the Discord bot's own service account losing its role got reported as "the Minecraft server is down" (see the backend guide's RBAC section) while the server was healthy the whole time. Distinguishing "you may not" from "this build can't" is the entire point of the type.

**`failureMessage(result, fallback)`** — the one place every call site should get its error string from: `result.kind === 'error' || result.kind === 'forbidden' ? result.message : fallback`. Adding `forbidden` after most call sites already existed would have silently downgraded every one of them from the server's real reason to a generic fallback if they'd kept spelling this out inline instead of calling the helper — that's exactly the regression this function exists to prevent.

**The convention every page follows:**

```tsx
const r = await apiFetch<Thing>('/things', { headers: authHeaders(token) })
if (r.kind === 'ok') setThings(r.data)
else if (r.kind === 'unauthorized') logout()
else if (r.kind === 'forbidden') /* show the real reason, e.g. r.message */
else if (r.kind === 'unsupported') /* "this server build doesn't support X yet" */
else toast(failureMessage(r, 'Could not load things'), 'error')
```

## 5. State management — contexts

### 5.1 `AuthContext`

**File:** [`src/context/AuthContext.tsx`](../src/context/AuthContext.tsx). Holds `token`/`username` (persisted to `localStorage`), `login`/`register`/`logout`. `username` is decoded **client-side from the JWT payload** (base64url), not fetched separately — the token already carries it (see the backend guide's JWT claims). This is the outermost provider, above the router's protected-route check.

### 5.2 `ServerContext`

**File:** [`src/context/ServerContext.tsx`](../src/context/ServerContext.tsx). The state of *whichever server is currently managed* (`currentServerId`, from `ServersContext`): `running`, `consoleConnected`, `serverInfo`, the live `logs`/`chatLog` buffers, and the actions — `handleStart`/`handleStop`/`createServer`/`deleteServer`/`updateProperties`/`fetchProperties`/`sendCommand`. Owns the console WebSocket connection itself (auto-reconnect with capped exponential backoff) and exposes `subscribe(listener)` for anything that wants a callback per incoming line rather than reading the accumulated buffer.

### 5.3 `ServersContext` — the multi-server registry

**File:** [`src/context/ServersContext.tsx`](../src/context/ServersContext.tsx). Fetches `GET /api/servers` and exposes `servers`, `currentServerId`, `setCurrentServer`, and two independent booleans that are easy to conflate but answer different questions:

- **`supported`** — did the backend even 200 on `/api/servers`? Defaults to `false` (the opposite default from `PermissionsContext` below, deliberately — see the code comment in the file for why: an old backend's 404 and a network hiccup must produce *identical* fallback behaviour, so `supported` can't be trusted true until a real 200 confirms the registry exists).
- **`forbidden`** — did it 403 specifically? Recorded so the Servers page can say *"ask an admin for `servers.view`"* instead of the misleading *"this build doesn't have multi-server support"* — same `forbidden`-vs-`unsupported` distinction as [§4](#4-the-api-layer--apifetch), applied one level up.

### 5.4 `PermissionsContext`

**File:** [`src/context/PermissionsContext.tsx`](../src/context/PermissionsContext.tsx). Fetches the permission schema and `GET /api/me/permissions`, exposes `role`, `can(perm)`, `supported`. **`supported` defaults to `true`** here — the opposite of `ServersContext` — because the *absence* of a permissions system on an old backend must mean "don't hide anything," not "hide everything": before this system existed, every logged-in user could do everything, and a client that assumed the opposite would silently lock people out of features an old server never gated to begin with.

### 5.5 `ToastContext`

**File:** [`src/components/toast/ToastContext.tsx`](../src/components/toast/ToastContext.tsx). `useToast().toast(message, type)`, `type` is `'info' | 'success' | 'error'`. Lives above `PermissionsContext` in the tree so the permissions system itself can toast.

## 6. Pages reference

| Page | Route | Reads | Writes | Notes |
|---|---|---|---|---|
| **Console** | `/` | `ServerContext.logs`/`chatLog` | `sendCommand` | The default landing page. Three switchable views (feed/terminal/raw, see [§8](#8-the-console-subsystem)); this is also where a plain chat message gets broadcast by default (see `lib/consoleInput.ts`). |
| **Overview** | `/overview` | `GET /players`, `GET /properties`, `GET /backups`, `ServerContext.logs`, the Performance page's `localStorage` sample history | `POST /backups`, restart flow | "Is the server OK, in five seconds." Every tile is sourced from data the app already fetches elsewhere — TPS/memory show `—` with a link to Performance rather than a fabricated number when no sample exists yet. Hosts [`RestartDialog`](../src/components/restart/RestartDialog.tsx). |
| **Activity** | `/activity` | `GET /activity` (paginated, keyset on `id`) | — | The audit trail — "who did what, when." Category chips filter client-side per page; "load more" pages backwards. An empty category says so explicitly rather than looking identical to "nothing has ever happened." |
| **Servers** | `/servers` | `GET /servers`, per-server `GET .../status` and `.../players` | `.../start`, `.../stop` | The multi-server picker. "Manage" switches `ServersContext.currentServerId`, which re-points every other page's API calls. "New server" is a disabled placeholder — there's no `POST /api/servers` yet (see the backend guide, §1). |
| **Players** | `/players` | `GET /players` | console commands (op/ban/kick/whitelist/teleport — never REST) | The roster. Clicking a player opens [`PlayerPanel`](../src/components/player/PlayerPanel.tsx) (see [§7](#7-key-components)). |
| **Performance** | `/performance` | `spark` output parsed live off the console stream (`lib/spark.ts`) | triggers `spark` commands via console | TPS/MSPT/CPU/memory tiles + a history chart, sampled into `localStorage` (`lib/sparkHistory.ts`) — this is *the* source Overview's tiles read from. No dedicated backend endpoint; everything comes from parsing spark's own console output. |
| **Users** | `/users` | `GET /users` | invitations, role/override changes via [`RolePanel`](../src/components/roles/RolePanel.tsx) | User management. The "Access" affordance that opens `RolePanel` is gated on **both** `can('admin.manage_roles')` *and* `PermissionsContext.supported` — on an old backend `can()` alone defaults to `true` (see [§5.4](#54-permissionscontext)), which would otherwise open a panel with an empty role list. |
| **Files** | `/files` | `GET /files`, `.../read`, `.../download` | `.../upload` (drag-and-drop), `PUT /files`, `DELETE /files` | Includes a from-scratch [`CodeEditor`](../src/components/editor/CodeEditor.tsx) with JSON syntax highlighting and validation; saving JSON that fails `checkJson` prompts a confirm rather than hard-blocking (plenty of real-world configs are JSON5-ish). |
| **Backups** | `/backups` | `GET /backups`, `.../config` | create/restore/delete/download, schedule config | Restore and delete both require a two-step inline confirm — restore is flagged as the single most destructive action the whole system exposes (see the backend guide's permission table). |
| **Server** (setup) | `/server` | `ServerContext.serverExists`/`serverInfo` | `createServer`, `deleteServer` | First-run server creation: version picker (vanilla release list, or Fabric with its own loader-version fetch straight from `meta.fabricmc.net`), initial `server.properties`. |
| **Settings** | `/settings` | `localStorage` only | `localStorage` only | Currently just the BlueMap live-map URL (`lib/settings.ts`) — browser-local, never sent to the API, never permission-gated. |
| **Account** | `/account` | `GET /me`, `GET /me/permissions`, `GET /me/mclink` | Minecraft account link/unlink flow | Self-service profile: shows your own effective permissions read-only, and the account-linking flow described in the backend guide (§7.6). |
| **Login / Register** | `/login`, `/register` | — | `POST /login`, `POST /register` | Register requires an invitation token in the URL (`?token=`), issued by an admin from the Users page. |

## 7. Key components

| Component | File | Purpose |
|---|---|---|
| `RolePanel` | [`components/roles/RolePanel.tsx`](../src/components/roles/RolePanel.tsx) | Slide-over role/permission editor for one user — role dropdown + a full permission checklist seeded from the role's defaults, diffed into per-user overrides on save. The Owner role is shown but its target is read-only (matches the backend's own refusal). |
| `RestartDialog` | [`components/restart/RestartDialog.tsx`](../src/components/restart/RestartDialog.tsx) | Multi-select warning-countdown restart flow (10m/5m/2m/1m/30s/15s/5s, any combination) used from Overview. **There is no backend restart endpoint** — this drives `stop` then `start` itself, timed client-side; the schedule math (which offset actually fires the restart when several are picked — the *longest* one, not the sum) lives in [`lib/restartPlan.ts`](../src/lib/restartPlan.ts), unit-tested on its own. |
| `PlayerPanel` | [`components/player/PlayerPanel.tsx`](../src/components/player/PlayerPanel.tsx) | Per-player slide-over: op/whitelist toggles, teleport (to player / coords / spawn), a live filtered DM/chat view, kick/ban/ip-ban with confirm. Every action is a **console command** (`lib/playerCommands.ts` builds the command strings) — there is no REST endpoint for any of these; this is also why the backend's audit trail records console commands separately from HTTP requests (see the backend guide, §7.2 of Activity). |
| `CodeEditor` | [`components/editor/CodeEditor.tsx`](../src/components/editor/CodeEditor.tsx) | A transparent `<textarea>` layered over a syntax-highlighted `<pre>`, no editor dependency. Highlighting is memoized and skipped above `jsonHighlight.ts`'s `HIGHLIGHT_LIMIT` for large files. |
| `TrendChart` | [`components/charts/TrendChart.tsx`](../src/components/charts/TrendChart.tsx) | Dependency-free inline SVG line chart (fixed coordinate space, `preserveAspectRatio="none"`, crisp stroke via `vector-effect`). Used by Performance's history view. |
| `Sidebar` / `Navbar` | [`components/sidebar/`](../src/components/sidebar/), [`components/navbar/`](../src/components/navbar/) | App chrome. Sidebar's `navItems` table is the single source of truth for "what's in the nav and what permission does it need" (see [§3](#3-routing)); Navbar hosts the Start/Stop button and the current-server chip. |
| Toast | [`components/toast/`](../src/components/toast/) | `useToast()` — see [§5.5](#55-toastcontext). |

## 8. The console subsystem

This is the most elaborate part of the client and worth understanding as one system, not four separate files.

- **[`lib/consoleLines.ts`](../src/lib/consoleLines.ts)** — `classifyLine(raw)` turns one raw console line into a typed `ConsoleLine` (`chat | join | leave | adv | death | warn | error | cmd | system`), extracting `who`/`text`/`time` with regexes matched against vanilla Minecraft's actual log format. Also home to `QUIET_RULES` (machine-query traffic — `mcm.*` scoreboard round-trips — folded from view by default) and the mention/waypoint/session-storage parsers Performance and the player panel both lean on.
- **[`lib/consoleInput.ts`](../src/lib/consoleInput.ts)** — `parseConsoleInput(raw, isCommandName)` decides what a typed line *means*: a leading `/` forces a command, a recognised command word runs slashless, plain text broadcasts as chat by default, and `say` (slash or not) gets special formatting.
- **[`lib/mcCommands.ts`](../src/lib/mcCommands.ts)** — the command-suggestion registry (`COMMANDS`, `getSuggestions`) powering the console input's Tab-complete popup. `spark` is deliberately in `COMMAND_NAMES`/`isCommandName` — without that, typing `spark tps` would broadcast to every player instead of running the command.
- **[`lib/spark.ts`](../src/lib/spark.ts)** — a full parser for the [spark](https://spark.lucko.me/) profiler's console output (TPS/MSPT/CPU/memory/GC/ping windows, report-link extraction, and `foldSparkBlocks` — a *stateful* sweep that folds spark's multi-line dumps, since no single-line regex can anchor a continuation line that carries no timestamp of its own). This is what feeds both the Console page's spark-fold toggles and the entire Performance page.
- **[`lib/chat.ts`](../src/lib/chat.ts)** — `parsePlayerChat` filters the shared log buffer down to one player's messages, for `PlayerPanel`'s DM view.
- **[`lib/consolePrefs.ts`](../src/lib/consolePrefs.ts)** — persisted view choice (feed/terminal/raw) and per-type visibility, `localStorage`-backed.

## 9. Design system

All theming is CSS custom properties defined once in [`src/index.css`](../src/index.css)'s `:root` — there is no CSS-in-JS, no Tailwind, no component library. Every page/component `.css` file consumes these tokens rather than hardcoding a colour or a duration.

| Token group | Examples | Notes |
|---|---|---|
| Brand | `--brand` (`#4ecca3`), `--brand-hover`, `--brand-dim`, `--brand-glow`, `--brand-ink` | Teal/green identity |
| Surfaces | `--bg-1`/`--bg-2`/`--bg-3`, `--surface`, `--surface-2` | Navy scale |
| Lines | `--line`, `--line-soft`, `--line-strong` | |
| Text | `--text`, `--text-dim`, `--text-mute` | |
| Status | `--danger`, `--warn`, `--ok`, `--info` | Semantic colour, kept separate from the brand accent |
| Shape/motion | `--radius`/`--radius-sm`/`--radius-lg`, `--shadow-1`/`--shadow-2`, `--ring`, `--ease` (out-quint), `--ease-expo` | |

**Motion conventions worth following, not reinventing per-component:** press feedback via a shared `--t-press` scale on `:active`; list entrance via a `.stagger-item` class + inline `style={{ '--i': index }}` reading a shared `rise` keyframe; every animation respects `prefers-reduced-motion`. Prefer animating `transform`/`opacity` over layout properties (`width`/`height`/`padding`/`margin`) — the latter forces layout thrash on every frame, which matters here specifically because the console streams new DOM nodes continuously, so the main thread is often already busy.

## 10. Testing

`npm test` runs Node's built-in test runner directly against `tests/*.test.ts` (`node --test`) — zero test-framework dependency, since Node 24 strips TypeScript types natively. `tests/` is deliberately **outside** `tsconfig`'s project (importing `.ts` files by their real extension trips `tsc -b`'s TS5097 otherwise).

The convention: one test file per `src/lib/*.ts` module that has non-trivial logic, asserting against **real captured examples** wherever the input comes from an external format — actual vanilla Minecraft log lines, actual `spark` output — rather than invented-looking fixtures, since the whole point of these parsers is matching what the game really prints.

`npm run lint` (ESLint) is strict: `react-hooks/set-state-in-effect` and `react-refresh/only-export-components` are **errors**, not warnings, in this repo's config — don't `setState` synchronously inside a bare `useEffect` body (do it inside a `.then()`/async callback, or seed the initial state via `useState(() => …)` instead).

## 11. Build & deploy

`npm run build` is `tsc -b && vite build` — type errors fail the build, not just lint. `npm run dev` starts the Vite dev server; a lone `VITE_API_BASE=/api` + a dev-only proxy in `vite.config.ts` is the usual way to point it at a locally-running server without CORS friction (never commit a proxy pointed at `localhost` — it's a per-developer convenience, not configuration).

**CI** ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)): `npm ci && npm run lint && npm run build && npm test` on every push/PR to `main`.

**Deploy** ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)): same build+test gate, then over SSH on the homelab host: `git pull && npm ci && npm run build` — this app is a static build, so "deploy" is just producing a fresh `dist/` on the host (served by whatever's in front of it there, outside this repo). No separate `workflow_run` gate like the server repo has; build failure and deploy failure are the same job here.

## 12. Backend, in brief

Everything this client talks to is documented in [`lomokwa/mc-manager-server`](https://github.com/lomokwa/mc-manager-server)'s own [`docs/TECHNICAL_GUIDE.md`](https://github.com/lomokwa/mc-manager-server/blob/main/docs/TECHNICAL_GUIDE.md) — the full route table, the RBAC/permission model `PermissionsContext` mirrors, the console WebSocket protocol `ServerContext` speaks, and the two-container deploy architecture behind why some backend changes (anything touching the `minecraft` container) can't auto-deploy the way this client's changes always do.

## 13. Cookbook — "I want to…"

| I want to… | Start here |
|---|---|
| Add a new page | Create `pages/<name>/<Name>.tsx` + `.css`, register the route in [`App.tsx`](../src/App.tsx), add a `navItems` entry in [`Sidebar.tsx`](../src/components/sidebar/Sidebar.tsx) with the right `need: Permission[]` |
| Call a new backend endpoint | Go through `apiFetch` (see [§4](#4-the-api-layer--apifetch)) — never a bare `fetch`; handle at minimum `ok`/`unauthorized`, and `forbidden`/`unsupported` if the endpoint is new or permission-gated |
| Show a permission-gated affordance | `usePermissions().can('zone.action')` — **and** check `.supported` too if the feature has no meaning at all on an old backend (see [§5.4](#54-permissionscontext) for why both) |
| React to which server is selected | `useServers().currentServerId`, and build request paths with `lib/servers.ts`'s `serverPath(id, suffix)` |
| Add a console-driven player action | `lib/playerCommands.ts` — build the command string as a pure function, send it via `ServerContext.sendCommand` |
| Parse a new kind of console line | `lib/consoleLines.ts`'s `classifyLine` (vanilla format) or `lib/spark.ts` (spark's own format) — add a real captured example to the matching test file first |
| Change the error message shown for a failed request | `failureMessage(result, fallback)` in [`lib/api.ts`](../src/lib/api.ts) — never re-derive it inline at the call site |
| Add a design token / change a colour | [`src/index.css`](../src/index.css)'s `:root` — never a hardcoded hex in a component `.css` file |
| Persist a small user preference | `localStorage`, following `lib/settings.ts` or `lib/consolePrefs.ts`'s pattern (a `load`/`save` pair, JSON, defensive `try/catch` around storage access) |
| Understand what changed for an account after a backend permission ships | Check the corresponding zone/permission in the backend guide's permission table, then `usePermissions().can(...)` in the affected component |

## 14. Glossary

- **Envelope** — the `{success, data, error}` JSON shape every backend response uses; `apiFetch` unwraps it.
- **`ApiResult` kind** — the classified outcome of an `apiFetch` call (`ok`/`unsupported`/`unauthorized`/`forbidden`/`error`/`network`); see [§4](#4-the-api-layer--apifetch).
- **Managed server** — whichever server `ServersContext.currentServerId` currently points at; `ServerContext` always describes *that* one.
- **Graceful degradation** — this codebase's central pattern: a feature the current server build lacks fails visibly and specifically (`unsupported`), never silently or as a generic error.
- **Fold** (console) — hiding a line/block from the default view without deleting it from the buffer; see `QUIET_RULES` and `foldSparkBlocks`.
