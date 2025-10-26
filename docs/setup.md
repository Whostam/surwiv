# Interactive setup & configuration reference

The `pnpm survev-setup` script guides you through creating `survev-config.hjson` and seeding required secrets. This document explains every prompt and describes how the generated file maps to runtime behavior.

## Running the setup script

```bash
pnpm survev-setup
```

The script performs the following steps:

1. **Loads an existing config (if present).** You can merge new answers into the current file or abort to keep the existing configuration.
2. **Asks whether you are targeting development or production.** Development skips region provisioning and assumes localhost services; production lets you describe API/game deployments in detail.
3. **Collects secrets and network settings** depending on the deployment type.
4. **Writes `survev-config.hjson`** to the repository root, echoing the resulting document so you can version it or store it securely.

`survev-config.hjson` is consumed by both the API server and the game server at startup. The configuration schema lives in [`configType.ts`](../configType.ts) and is summarized below.

## Prompt walkthrough

### Common prompts

| Prompt | What it configures | Notes |
| --- | --- | --- |
| "Would you like to import the API and loadout secret keys or use random ones?" | `secrets.SURVEV_API_KEY` and `secrets.SURVEV_LOADOUT_SECRET` | Choose **import** if you have existing keys for clustered deployments; otherwise the script generates cryptographically random values. |
| "Is the API/game server behind a proxy?" | `apiServer.proxyIPHeader` / `gameServer.proxyIPHeader` | Provide the header (e.g. `X-Real-IP`) only when requests are always forwarded through a trusted proxy. |
| "Would you like enabling SSL for the API/game server?" | `apiServer.ssl` / `gameServer.ssl` | Specify filesystem paths to PEM-encoded certificate and key files if you terminate TLS directly in the process. |
| "Would you like to enable proxycheck.io...?" | `secrets.PROXYCHECK_KEY` | Adds VPN/proxy detection for matchmaking and moderation. |

### Production-specific prompts

When you select **production** the wizard differentiates between three scenarios:

1. **Both API and game server** — you will configure every section below.
2. **API only** — focus on `/api` routing and global regions list.
3. **Game server region** — configure the region metadata, point to the main API server, and import existing secrets so the region can authenticate.

Key prompts include:

- **Region metadata** (`regions` object) — For each region you provide:
  - Identifier (e.g. `na`, `eu`)
  - Whether the client should connect over HTTPS
  - The public address and port
  - A localization key (e.g. `index-north-america`) used in the client selector
- **Game server API URL** (`gameServer.apiServerUrl`) — The full URL (including protocol) used by the region to report status, post match history, and fetch configuration from the API.
- **Database enablement** (`database.enabled`) — Accounts, session tracking, leaderboards, and moderation all rely on PostgreSQL. If you answer "yes" you will be guided through OAuth and moderation bot options.
- **OAuth redirect base URL** (`oauthRedirectURI`) — The canonical origin registered with Google/Discord.
- **Discord bot configuration** (`discordGuildId`, `discordRoleId`, and secret tokens) — Required for the moderation bot to manage roles.

### Development-specific prompts

Choosing **development** only asks whether you want database support. Declining sets `database.enabled` to `false` which allows you to run against in-memory or stubbed services. You can rerun the script later to opt in without rewriting the entire file.

## Configuration file structure

The most important sections you will edit manually are:

- `apiServer` — host, port, optional proxy header, and optional TLS paths for the Hono API server. You typically expose this service over HTTPS in production.
- `gameServer` — host/port for the WebSocket server, a `thisRegion` identifier, and `apiServerUrl` pointing to the API instance responsible for matchmaking.
- `vite` — dev server host/port used by the Vite client when running locally.
- `regions` — metadata for every public region. Each entry contains `{ https, address, l10n }`.
- `proxies` — definitions of proxy backends announced to clients. Populate this if you front game servers with reverse proxies.
- `modes` — an array of available playlists with map name, team size, and `enabled` flag. Limited to three entries in the current client UI.
- `clientTheme` — selects the splash art and music package at build time.
- `gameTps` and `netSyncTps` — tick rates for simulation and network updates.
- `processMode` — choose `single` during development or `multi` to spawn worker processes per match in production.
- `logging` — fine-grained log levels; useful when debugging or tuning noise in production.
- `errorLoggingWebhook` / `clientErrorLoggingWebhook` — optional webhook URLs for server and client error reporting.
- `secrets` — API keys and OAuth credentials referenced by the API server and moderation bot.

Refer to [`configType.ts`](../configType.ts) for inline documentation on every field, including validation expectations and examples.

## Editing and distributing the config

- Check the generated file into version control only if you strip secrets. Many operators maintain a public template alongside a private overrides repository.
- When you add or remove regions, restart both the API and the affected game servers so they reload matchmaking data.
- Rerun `pnpm survev-setup` whenever you need to rotate secrets or onboard a new environment; existing answers are merged instead of overwritten.
- Keep your `.env` values inside `server/` in sync with the configuration (database URLs, OAuth secrets, Redis connection strings, etc.). The Hono API will log descriptive errors if required environment variables are missing at boot.

For production hardening tips consult [HOSTING.md](../HOSTING.md).
