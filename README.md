# radasses

Split trip expenses without the hassle. An **offline-first** web app (SvelteKit + Firebase):
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

Static SvelteKit SPA (Svelte 5 runes, Tailwind v4, `adapter-static`); Firebase backend
(Firestore + anonymous auth, free Spark plan, no server code) isolated behind a
**ports & adapters** layer; access is enforced by Firestore security rules
(`firestore.rules`).
Architecture and conventions: **[`CLAUDE.md`](./CLAUDE.md)**. Roadmap:
**[`docs/BACKLOG.md`](./docs/BACKLOG.md)**.

## Prerequisites

- **Node 22** (see `.nvmrc`: `nvm use`).
- **Java 11+** for the Firebase emulators (local backend; the CLI is a dev dependency).

## Getting started (local)

```sh
npm install
cp .env.example .env             # `demo-…` project = local emulators (fake key)
npm run emulators                # Firestore + Auth emulators (UI: http://localhost:4000)
npm run dev                      # http://localhost:5173
```

Emulator data is not persisted between runs. To load demo data (`?token=demo-ete`,
`?token=demo-we`), see `scripts/migrate-supabase-to-firestore.ts`.

## Commands

| Command                                | Purpose                           |
| -------------------------------------- | --------------------------------- |
| `npm run dev` / `build` / `preview`    | Develop / build / preview         |
| `npm run check`                        | `svelte-check` (types)            |
| `npm run lint` / `npm run format`      | Prettier + ESLint / format        |
| `npm run test`                         | Unit tests (Vitest)               |
| `npm run test:e2e`                     | End-to-end tests (Playwright)     |
| `npm run test:firebase`                | Adapter + rules tests (emulators) |
| `npm run emulators`                    | Start the Firebase emulators      |
| `npx firebase deploy --only firestore` | Deploy rules + indexes (cloud)    |

## Deployment

Deployed to **GitHub Pages** from the `production` branch (workflow under
`.github/workflows/`, `BASE_PATH=/radasses`, `PUBLIC_FIREBASE_*` secrets). Flow:

```sh
git push origin main             # trunk
# if firestore.rules / firestore.indexes.json changed, deploy them BEFORE the frontend:
npx firebase deploy --only firestore --project <project-id>
git push origin main:production  # deploy the frontend
```

## License

Distributed under the [MIT](./LICENSE) license © 2026 Pierre Courtieu. Third-party
dependencies keep their own permissive licenses (MIT, ISC, Apache-2.0) — see
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
