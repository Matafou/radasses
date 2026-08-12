# radasses

Split trip expenses without the hassle. An **offline-first** web app (SvelteKit + Supabase):
record who paid what and for whom, and the app computes **per-household** balances and
suggests reimbursements.

## Features

- **Per-household expenses**: beneficiaries per person, equal / weighted / fixed-amount
  splits, reimbursements (a reimbursement is just an expense).
- **Balances & suggestions**: reimbursement suggestions that minimise the number of
  transfers; hide small balances below a configurable threshold.
- **No account**: anonymous sessions; join a trip via a **link** (per participant, or a
  trip-wide "Who are you?" link).
- **Offline-first**: installable PWA that starts and works offline (cached data); adds and
  deletes made offline **sync** when the network is back.
- **Journal & Undo**: every action is journaled (event log); expense operations can be undone.

## Stack (overview)

Static SvelteKit SPA (Svelte 5 runes, Tailwind v4, `adapter-static`); Supabase backend
(Postgres + PostgREST + anonymous auth) isolated behind a **ports & adapters** layer.
Architecture and conventions: **[`CLAUDE.md`](./CLAUDE.md)**. Roadmap:
**[`docs/BACKLOG.md`](./docs/BACKLOG.md)**.

## Prerequisites

- **Node 22** (see `.nvmrc`: `nvm use`).
- **Docker** + **Supabase CLI** (`npx supabase …`) for the local backend.

## Getting started (local)

```sh
npm install
cp .env.example .env             # set PUBLIC_SUPABASE_URL / _ANON_KEY (public keys)
npx supabase start               # local Postgres + PostgREST + auth (Docker)
npm run dev                      # http://localhost:5173
```

Local keys are printed by `supabase start` (or `npx supabase status`). After a
`supabase db reset` in dev, see the gotchas in [`CLAUDE.md`](./CLAUDE.md).

## Commands

| Command                                 | Purpose                          |
| --------------------------------------- | -------------------------------- |
| `npm run dev` / `build` / `preview`     | Develop / build / preview        |
| `npm run check`                         | `svelte-check` (types)           |
| `npm run lint` / `npm run format`       | Prettier + ESLint / format       |
| `npm run test`                          | Unit tests (Vitest)              |
| `npm run test:e2e`                      | End-to-end tests (Playwright)    |
| `npx supabase test db`                  | SQL tests (pgTAP)                |
| `npx supabase migration up` / `db push` | Apply migrations (local / cloud) |

## Deployment

Deployed to **GitHub Pages** from the `production` branch (workflow under
`.github/workflows/`, `BASE_PATH=/radasses`, `PUBLIC_SUPABASE_*` secrets). Flow:

```sh
git push origin main             # trunk
# if the branch contains a migration, apply it BEFORE deploying:
npx supabase db push
git push origin main:production  # deploy the frontend
```

## License

Distributed under the [MIT](./LICENSE) license © 2026 Pierre Courtieu. Third-party
dependencies keep their own permissive licenses (MIT, ISC, Apache-2.0) — see
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
