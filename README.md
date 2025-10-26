# Survev.io

Survev.io is a community-driven recreation of the original surviv.io battle royale. The goal of the project is to preserve the "classic" experience by rebuilding the final pre-acquisition version of the game with modern, open-source tooling and an active community of contributors.

<p align="center">
  <img src="client/public/favicon.svg" alt="Survev logo" width="96" />
</p>

## What you'll find in this repository

- **Monorepo layout.** The top-level workspace is managed with [`pnpm`](https://pnpm.io/) and contains the production game server (`server/`), the browser client (`client/`), shared definitions (`shared/`), and a standalone test runner (`tests/`).
- **Battle-tested networking stack.** The server wraps a Hono-based API layer with a high-frequency WebSocket game loop capable of scaling to multi-process deployments.
- **Configurable content pipeline.** Maps, cosmetics, loot tables, and playlists live under `shared/` and are hot-reloadable through the development scripts.
- **Community moderation tools.** Account, ban, and match logging endpoints power dashboards and automation for public deployments.

If you are evaluating Survev.io for the first time, start with the guides below:

- [Developer quick-start](./docs/development.md) — install prerequisites, launch the full stack, and understand the dev scripts.
- [Interactive setup & configuration](./docs/setup.md) — learn how the guided `pnpm survev-setup` flow works and how to manage the resulting configuration.
- [API routing & moderation reference](./docs/api.md) — explore the HTTP endpoints exposed by the API service.
- [Hosting considerations](./HOSTING.md) — production tips, reverse proxy configuration, and TLS guidance.

## Architectural overview

Survev.io is composed of three cooperating services:

1. **API server (`server/src/api`)** — Handles authentication, account management, matchmaking, moderation tooling, and game discovery. Built on top of [Hono](https://hono.dev/) with PostgreSQL/Redis persistence.
2. **Game server (`server/src/gameServer.ts`)** — Runs the authoritative battle royale simulation. The server can operate in single-process mode for development or spin games out to isolated workers in production.
3. **Client (`client/`)** — A Vite-powered web client that speaks the same networking protocol as the legacy surviv.io client while embracing modern TypeScript and asset tooling.

Shared TypeScript packages under `shared/` supply deterministic map data, item definitions, cosmetics, and protocol schemas to both the server and the client.

## Contribution expectations

We welcome contributions ranging from bug fixes to feature work. Before opening a pull request:

1. Review [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) and [COMMIT_FORMAT.md](./COMMIT_FORMAT.md).
2. Follow the quick-start guide to reproduce the issue or run the feature locally.
3. Run the relevant checks (`pnpm lint`, workspace-specific `pnpm test`, etc.) so CI and reviewers have a clean signal.

Discussions, feature proposals, and roadmap ideas are best filed as GitHub issues so they can be triaged publicly.

## Useful links

- [Balance notes](./balance.txt)
- [Production nginx example](./nginx.conf)
- [Client assets](./client/public)
- [Shared definitions](./shared)

If you maintain a public Survev.io server, consider contributing documentation or automation scripts back to the repository to help the next wave of operators.
