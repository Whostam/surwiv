# Developer quick-start

This guide mirrors the automation exposed in the root `package.json` so you can spin up a complete Survev.io workspace in minutes.

## Prerequisites

- **Node.js 20.12 or newer** (matches the required version in `package.json`). Use [`fnm`](https://github.com/Schniz/fnm) or [`nvm`](https://github.com/nvm-sh/nvm) to manage multiple versions.
- **pnpm 10** (installed globally with `corepack enable` or `npm i -g pnpm`).
- **PostgreSQL 15+** and **Redis 7+** if you plan to exercise account, stats, or moderation features locally. Ephemeral development is possible without them, but several routes will be no-ops.
- Optional: [`docker compose`](https://docs.docker.com/compose/) if you prefer containerized databases. A sample override is shown later in this document.

## First-time setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/surv-community/survev.git
   cd survev
   pnpm install
   ```

2. Run the interactive setup script. It installs workspace dependencies and writes `survev-config.hjson` at the repository root.

   ```bash
   pnpm survev-setup
   ```

   The script is described in detail in [Interactive setup & configuration](./setup.md).

3. Export environment variables expected by the API. The `.env.example` file inside `server/` lists the common keys (database credentials, Redis URL, OAuth client IDs, Cloudflare Turnstile tokens, etc.). Copy it into place and customize as needed:

   ```bash
   cd server
   cp .env.example .env
   # edit .env
   ```

4. Seed your database (optional but recommended if you want to populate default cosmetics and achievements):

   ```bash
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```

## Day-to-day workflows

From the repository root you can rely on the scripts provided by `package.json`:

| Command | Description |
| --- | --- |
| `pnpm dev` | Launches the API server, game server, and client dev server concurrently. Useful when iterating on end-to-end flows. |
| `pnpm dev:api` | Runs only the API server (`server/src/api/index.ts`) with hot reloading. |
| `pnpm dev:game` | Runs only the game server (`server/src/gameServer.ts`) with hot reloading. |
| `pnpm dev:client` | Runs the Vite client dev server. |
| `pnpm build` | Builds the API and game server bundles followed by a client production build. |
| `pnpm lint` | Formats and lints the entire monorepo with Biome. |
| `pnpm stressTest` | Executes the synthetic load generator that connects bots to a running game server. |

When working inside a workspace (for example `server/` or `client/`) you can execute the same script names prefixed with `pnpm`. The scripts are delegated through workspace manifest inheritance.

### Running with docker compose (optional)

Many contributors prefer to bootstrap PostgreSQL and Redis through docker compose:

```yaml
# docker-compose.override.yml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: survev
      POSTGRES_PASSWORD: survev
      POSTGRES_DB: survev
  redis:
    image: redis:7
    restart: unless-stopped
    ports:
      - "6379:6379"
```

With the override in place you can run `docker compose up -d` before invoking the Survev dev scripts. Update your `.env` to match the connection strings.

## Debugging tips

- Enable verbose logging by toggling the `logging` block in `survev-config.hjson`. The game server respects these flags at runtime.
- Use the `debugLogs` option during local development to inspect matchmaking, loadout assignment, and damage calculations.
- The API server exposes health information through `/api/site_info`. When you run `pnpm dev` the endpoint is served on `http://localhost:<apiPort>/api/site_info` where `apiPort` comes from your config file.
- For integration tests, rely on the shared Vitest workspace under `tests/`. A new suite covering the API bootstrap is provided in [`tests/src/api/bootstrap.test.ts`](../tests/src/api/bootstrap.test.ts).

## Next steps

- Review [Interactive setup & configuration](./setup.md) to understand every prompt in the guided installer.
- Familiarize yourself with the [API routing & moderation reference](./api.md) if you plan to build dashboards or automation.
- Check out [HOSTING.md](../HOSTING.md) for production deployment notes once you are ready to go beyond localhost.
