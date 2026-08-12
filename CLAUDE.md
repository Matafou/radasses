# radasses — guide du projet

Partage des dépenses d'un séjour, sans prise de tête. SPA SvelteKit (statique) + Supabase.
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
- **Backend** : Supabase (Postgres + PostgREST + **auth anonyme**). Accès isolé derrière
  **ports & adapters** : interface `src/lib/backend/` + adaptateur `backend/supabase/`
  (seul à connaître `supabase-js`). Erreurs normalisées en `BackendError`.
- **Journal / event sourcing** : table `operations` append-only (`before`/`after` jsonb,
  ordre total par `id`) qui journalise **toutes** les mutations (triggers + RPC). Fold TS
  pur `src/lib/fold.ts` reconstruit l'état (validé identique aux tables). « Défaire » =
  opération de compensation (`src/lib/undo.ts`).
- **Offline** : PWA (service worker qui précache l'app-shell), cache IndexedDB des données et
  outbox (écritures offline rejouées à la reconnexion). Soldes recalculés en TS
  (`computeBalances`). Préférences d'**appareil** (arrondi, seuil de masquage) en localStorage.

## Commandes

- `npm run dev` · `npm run build` · `npm run preview`
- `npm run check` (svelte-check) · `npm run lint` (prettier + eslint) · `npm run format`
- `npm run test` (Vitest) · `npm run test:e2e` (Playwright) · `npx supabase test db` (pgTAP)
- SQL local : `npx supabase migration up` (**préférer** au reset) · cloud : `npx supabase db push`

## Façon de travailler

- **Questions « comment » → proposer puis ATTENDRE le feu vert**, ne pas implémenter d'office.
  Une consigne directe (« fais X », « mets-le en vert ») s'exécute ; une question exploratoire
  (« comment… ? », « est-ce possible… ? », « peux-tu… ? ») se discute d'abord.
- **Commits sur `main`** (tronc). Déploiement : `git push origin main` puis
  `git push origin main:production` (GitHub Pages). Si la branche contient une **migration**,
  faire **`supabase db push` AVANT** le déploiement prod (le frontend en a besoin côté cloud).
- **Ne jamais `git add -A`** : les **sources d'images** (`src/lib/assets/*.xcf`,
  `favicon-1254.png`, `favicon-256.png`) sont volontairement **hors git**. Stager les fichiers
  précisément (ou `git add -u` pour ne prendre que le suivi).
- Tester au navigateur puis committer ; committer quand c'est demandé.

## Cadence des tests

- **Vitest** (quasi instantané) : à tout moment.
- **pgTAP + Playwright E2E** (longs) : **avant chaque commit**, et **plus souvent si l'UI est
  touchée**. Prérequis E2E : stack Supabase locale démarrée (`npx supabase start`) ; Playwright
  réutilise le serveur dev s'il tourne. ⚠️ Un `vite preview` périmé sur le **port du dev**
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

## Gotchas dev

- **Après `supabase db reset`** : dans la console sur `localhost:5173`,
  `localStorage.clear(); location.reload()` (sinon session anonyme orpheline → FK `23503`),
  puis rouvrir les liens démo (`?token=demo-ete`, `?token=demo-we`). **Préférer `migration up`**
  pour ne pas effacer les séjours de test.
- **« JWT issued at future »** : micro-désynchro d'horloge côté Supabase (GoTrue↔PostgREST),
  **intermittent**, pas un bug du code. Paré par `ensureSession` (attente préventive de l'`iat`)
  **et** un **retry réactif** sur le code `clock-skew` dans le filet `withSessionRepair`
  (`backend/supabase/`). Si ça persiste, capturer le message d'erreur exact pour caler le matcher.
