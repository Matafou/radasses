# radasses — guide du projet

Partage des dépenses d'un séjour, sans prise de tête. SPA SvelteKit (statique) + Firebase.
Ce fichier est chargé automatiquement par les assistants (Claude Code) ; il rassemble
l'essentiel pour travailler sur le repo. **Feuille de route détaillée : `docs/BACKLOG.md`.**

> **Source de vérité.** Ce guide (`CLAUDE.md`) et `docs/BACKLOG.md` sont **canoniques** et
> maintenus **ICI, dans le dépôt** — pas dans une mémoire externe. Toute évolution du backlog
> ou des conventions se fait dans ces fichiers (elle est ainsi versionnée et voyage avec le
> dossier). Ne pas dupliquer/diverger ailleurs.

## Stack

- **Frontend** : SvelteKit en **SPA statique** (`ssr = false`, `prerender = false`),
  **Svelte 5 (runes)**, Tailwind v4. `adapter-static` (fallback `404.html`), base path
  `/radasses` en prod (GitHub Pages), vide en local. La config SvelteKit est dans
  `vite.config.ts` (pas de `svelte.config.js` séparé).
- **Backend** : Firebase, plan gratuit Spark (Firestore + **auth anonyme**), **sans code
  serveur** (pas de Cloud Functions). Accès isolé derrière **ports & adapters** : interface
  `src/lib/backend/` + adaptateur `backend/firebase/` (seul à connaître le SDK `firebase`).
  La logique métier (répartition `resolveSplit` de `src/lib/split.ts`, verrou de version,
  journal) vit dans l'adaptateur, en **transactions Firestore** ; l'accès est gardé par les
  **règles** `firestore.rules` (seuls les membres `trips/{t}/members/{uid}` lisent/écrivent ;
  les jetons de lien sont des annuaires `inviteTokens/`, `joinTokens/` lisibles un par un).
  Modèle de données : en-tête de `backend/firebase/model.ts`. Erreurs normalisées en
  `BackendError`. L'ancien adaptateur `backend/supabase/` et `supabase/` (migrations SQL)
  restent pour mémoire jusqu'au nettoyage post-bascule.
- **Journal / event sourcing** : sous-collection `trips/{t}/ops/{n}` append-only
  (`before`/`after`, ordre total **par séjour** via le compteur `trips/{t}.op_seq`) qui
  journalise **toutes** les mutations (chaque transaction écrit l'entité + son op ; les règles
  refusent une écriture non journalisée). Fold TS pur `src/lib/fold.ts` reconstruit l'état
  (validé identique aux collections). « Défaire » = opération de compensation
  (`src/lib/undo.ts`).
- **Offline** : PWA (service worker qui précache l'app-shell), cache IndexedDB des données et
  outbox (écritures offline rejouées à la reconnexion). Soldes recalculés en TS
  (`computeBalances`). Préférences d'**appareil** (arrondi, seuil de masquage) en localStorage.

## Commandes

- `npm run dev` · `npm run build` · `npm run preview`
- `npm run check` (svelte-check) · `npm run lint` (prettier + eslint) · `npm run format`
- `npm run test` (Vitest, logique pure) · `npm run test:e2e` (Playwright) ·
  `npm run test:firebase` (adaptateur + règles contre les émulateurs, qu'il démarre lui-même)
- `npm run emulators` (Firestore + Auth locaux, UI http://localhost:4000) · règles/index
  cloud : `npx firebase deploy --only firestore --project <id>`
- Reprise Supabase → Firestore (et seed démo local) : `scripts/migrate-supabase-to-firestore.ts`

## Façon de travailler

- **Questions « comment » → proposer puis ATTENDRE le feu vert**, ne pas implémenter d'office.
  Une consigne directe (« fais X », « mets-le en vert ») s'exécute ; une question exploratoire
  (« comment… ? », « est-ce possible… ? », « peux-tu… ? ») se discute d'abord.
- **Commits sur `main`** (tronc). Déploiement : `git push origin main` puis
  `git push origin main:production` (GitHub Pages). Si la branche modifie **`firestore.rules`
  ou `firestore.indexes.json`**, les **déployer AVANT** le frontend
  (`npx firebase deploy --only firestore`).
- **Ne jamais `git add -A`** : les **sources d'images** (`src/lib/assets/*.xcf`,
  `favicon-1254.png`, `favicon-256.png`) sont volontairement **hors git**. Stager les fichiers
  précisément (ou `git add -u` pour ne prendre que le suivi).
- Tester au navigateur puis committer ; committer quand c'est demandé.

## Cadence des tests

- **Vitest** (quasi instantané) : à tout moment.
- **`test:firebase` + Playwright E2E** (plus longs) : **avant chaque commit**, et **plus
  souvent si l'UI est touchée**. Prérequis : **Java** (émulateurs) ; Playwright démarre les
  émulateurs et le serveur dev, ou les réutilise s'ils tournent. ⚠️ Un `vite preview` périmé sur le **port du dev**
  serait réutilisé par Playwright (code obsolète) → le tuer avant l'E2E.

## Conventions

- **Nommer un foyer** : toujours « le foyer {nom} » via `foyerLabel(name)` (`src/lib/format.ts`).
  Un foyer d'une seule personne porte son prénom → le préfixe évite la confusion. Exceptions :
  champ de **renommage** (nom brut), libellés de champ « Foyer », `ExpenseForm`.
- **Styles centralisés** (anti-dérive) : primitives `$lib/components/ui` + classes du
  `@layer components` de `src/routes/layout.css` (`.trip-tab`, `.tag`, `.meta-text`,
  `.form-label`, `.link-inline`, `.panel-surface`, `.list-row`). L'état grisé
  « indisponible hors-ligne » = prop **`muted`** + helper **`offlineWrite`** (grisé mais
  cliquable, signale au tap). Ne pas classifier les utilitaires de layout génériques
  (`flex items-center …`) — n'extraire que les motifs qui ont un **nom/sens**.
- **Base path** : `$page.url.pathname` **inclut** le base → comparer via `base`
  (`path.slice(base.length)`) ou `resolve()`, **jamais** un littéral de chemin sans base.
- Helpers utiles : `errMessage` (`$lib/util`), `parseDecimalFr`/`centsFromEuros` (`$lib/format`),
  `createFlash` (`$lib/flash.svelte`), `ShareSheet` (canaux de partage mutualisés).

- **Langue** : le **README et les fichiers de licence** (`LICENSE`, `THIRD_PARTY_NOTICES.md`)
  sont en **anglais** ; le reste (ce guide, `docs/BACKLOG.md`, l'UI, les commentaires) en
  **français**.

## Gotchas dev

- **Dev local = émulateurs** : un `PUBLIC_FIREBASE_PROJECT_ID` en `demo-…` (voir
  `.env.example`) branche l'app sur les émulateurs (convention Firebase), sinon sur le cloud.
  Les données des émulateurs **ne survivent pas** à leur arrêt : pour retrouver les séjours
  démo (`?token=demo-ete`, `?token=demo-we`), relancer le script de reprise depuis une base
  Supabase locale seedée (`npx supabase start`), avec `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`.
- **Émulateur orphelin** : si le port 8080 (Firestore) est pris sans que 9099 (Auth) réponde,
  un process Java d'un run précédent traîne → le tuer avant `npm run emulators`.
- **Quota gratuit Firestore** : 50 000 documents lus / jour. Chaque ouverture de séjour lit
  toutes ses dépenses (une fois : `listExpenses`/`listBeneficiaries` partagent la lecture) →
  ne pas multiplier les rechargements complets ; préférer `load([...sections])`.
