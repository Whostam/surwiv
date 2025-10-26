# API routing & moderation reference

The Survev API is implemented with [Hono](https://hono.dev/) in [`server/src/api`](../server/src/api). This document summarizes the top-level routes, expected authentication, rate limits, and the moderation surface exposed under `/private`.

## Base URLs

All endpoints are served from the API host configured in `survev-config.hjson` (`apiServer.host`/`apiServer.port`). In development the defaults are `http://127.0.0.1:8000`.

- **Public API root:** `http(s)://<api-host>/api`
- **Private API root:** `http(s)://<api-host>/private`

The API responds with JSON and expects JSON request bodies unless explicitly noted. Error payloads contain an `error` field describing the failure reason.

## Authentication & rate limits

| Route group | Authentication | Default rate limit |
| --- | --- | --- |
| `/api/site_info`, `/api/report_error`, `/api/find_game` | None | `find_game` is limited to 5 requests per 3 seconds per IP via `HTTPRateLimit`. |
| `/api/auth/*` | Session cookies issued by OAuth providers; database must be enabled. | 5 requests per minute per IP. |
| `/api/user/*` | Requires a valid `session` cookie. | 40 requests per minute per IP. |
| `/api/*` stats endpoints | Public read endpoints. Some responses require the database/cache to be populated. | None enforced in code. |
| `/private/*` | Must include the header `survev-api-key: <SURVEV_API_KEY>` using the key from `survev-config.hjson`. | Not rate limited; protect with network ACLs or proxies. |

Session cookies are validated by the middleware in [`server/src/api/auth/middleware.ts`](../server/src/api/auth/middleware.ts). Cookies are refreshed on every authenticated request to respect `session.expiresAt`.

## Public endpoints

### Site metadata

- `GET /api/site_info` — Returns current playlist configuration, captcha status, region metadata, and version strings used by the client to populate the landing page.
- `POST /api/find_game` — Accepts [`zFindGameBody`](../shared/types/api.ts) and returns matchmaking tokens or errors such as `rate_limited`, `behind_proxy`, or `invalid_captcha`. Handles bans and optional Turnstile verification.
- `POST /api/report_error` — Accepts a JSON payload describing client errors and forwards them to the configured webhook.

### Authentication

OAuth flows live under `/api/auth` and are enabled only when the database is configured.

- `GET /api/auth/google/*` — Google OAuth handshake implemented in [`routes/user/auth/google`](../server/src/api/routes/user/auth/google.ts).
- `GET /api/auth/discord/*` — Discord OAuth handshake implemented in [`routes/user/auth/discord`](../server/src/api/routes/user/auth/discord.ts).
- `GET /api/auth/mock/*` — Optional mock provider for local development controlled by `Config.debug.allowMockAccount`.

Each provider ultimately issues a `session` cookie and creates/upserts a user row in PostgreSQL.

### User profile & inventory

All endpoints under `/api/user` require an authenticated session and the database.

| Method & path | Description |
| --- | --- |
| `POST /api/user/profile` | Returns the player profile (username, cosmetics, unlocks). Logs a user out if their account is banned. |
| `POST /api/user/username` | Attempts to rename the user. Applies validation via `validateUserName` and enforces the cooldown computed in `getTimeUntilNextUsernameChange`. |
| `POST /api/user/loadout` | Validates and persists cosmetic loadouts using the shared `loadout` helper. |
| `POST /api/user/logout` | Revokes the current session token and clears cookies. |
| `POST /api/user/delete` | Deletes the user record and revokes the session. |
| `POST /api/user/pass` | Battle pass utilities (see [`zGetPassRequest`](../shared/types/user.ts)). |
| `POST /api/user/items/set_status` and related endpoints | Manage cosmetic unlock state. |

Refer to [`UserRouter`](../server/src/api/routes/user/UserRouter.ts) for the full list of item and quest helpers.

### Stats and leaderboards

The stats router mounts four sub-routes under `/api`:

- `GET /api/user_stats/*` — Player profile summaries, derived from `matchDataTable`.
- `GET /api/match_history/*` — Paginated match history suitable for external sites.
- `GET /api/match_data/*` — Raw match payloads captured from the game server.
- `GET /api/leaderboard/*` — Leaderboards backed by Redis caching (`leaderboardCache`).

The concrete endpoints are defined in [`server/src/api/routes/stats`](../server/src/api/routes/stats). Each request validates query parameters with Zod before hitting the database.

## Private moderation surface

Private routes require the `survev-api-key` header and are intended for the moderation bot or trusted dashboards. They are mounted under `/private` and reuse the `Context` object so session lookups are available where necessary.

### Region & playlist management

- `POST /private/update_region` — Updates region heartbeat data in memory. Typically called by game servers.
- `POST /private/set_game_mode` — Mutates the `modes` array and persists the change to `survev-config.hjson` via `saveConfig`.
- `POST /private/set_client_theme` — Persists a new `clientTheme` in the config file.
- `POST /private/toggle_captcha` — Enables or disables Cloudflare Turnstile enforcement.

### Match persistence

- `POST /private/save_game` — Persists match results sent by game servers. Deduplicates `gameId`, invalidates leaderboard cache entries, and logs player IPs for moderation.
- `POST /private/delete_game` — Removes match rows matching the provided `gameId`.

### Inventory management

- `POST /private/give_item` — Grants cosmetics to a user if they do not already own the item.
- `POST /private/remove_item` — Revokes cosmetics and cleans up dependent loadouts.

### Ban management

All ban endpoints live under `/private/moderation`.

| Endpoint | Purpose |
| --- | --- |
| `POST /private/moderation/ban_account` | Bans an account, optionally banning associated IPs and disconnecting current sessions. |
| `POST /private/moderation/unban_account` | Removes an account ban and updates match history rows. |
| `POST /private/moderation/ban_ip` | Stores encoded IP bans (optionally cascading to associated accounts). |
| `POST /private/moderation/unban_ip` | Deletes an IP ban by encoded hash. |
| `POST /private/moderation/is_ip_banned` | Legacy helper that reports whether an IP is currently banned. |
| `POST /private/moderation/clear_all_bans` | Purges the entire ban table. |

### Player lookup & auditing

| Endpoint | Purpose |
| --- | --- |
| `POST /private/moderation/get_player_ip` | Fetches recent IP log entries by username or account slug (optionally filtered by `game_id`). Results include map, region, and team metadata. |
| `POST /private/moderation/find_discord_user_slug` | Resolves a Discord auth ID to the associated account slug. |
| `POST /private/moderation/set_match_data_name` | Bulk-renames leaderboard entries in `matchDataTable`. |
| `POST /private/moderation/set_account_name` | Updates a user's username and slug, applying server-side validation. |

The moderation router lives in [`ModerationRouter.ts`](../server/src/api/routes/private/ModerationRouter.ts) and contains inline comments explaining edge cases such as VPN detection and username sanitization.

## Error handling & logging

- Unhandled exceptions in the API server trigger `logErrorToWebhook` and crash the process to avoid silent failure (`process.on('uncaughtException')` in [`index.ts`](../server/src/api/index.ts)).
- Each router uses `rateLimitMiddleware` and `databaseEnabledMiddleware` where applicable to return consistent `error` codes.
- Moderation actions call `server.teamMenu.disconnectPlayers` to remove affected users from active matches immediately.

## Building on top of the API

- **Dashboards:** Use the private moderation endpoints with the API key header and host the dashboard behind your own authentication. Consider rotating the API key regularly.
- **Bots:** The Discord moderation bot uses these routes exclusively. See `setup.ts` for the prompts that configure the necessary secrets.
- **Client mods:** Third-party clients can hit `/api/site_info` to discover matchmaking endpoints and should honor the rate limits enforced by the API.

For deeper details, explore the source files linked throughout this document. The combination of Zod schemas in `shared/types` and database models in `server/src/api/db/schema.ts` defines the exact request/response contracts.
