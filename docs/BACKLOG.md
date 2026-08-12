# Backlog radasses

> Miroir des notes de travail (chantiers finis et à venir), versionné pour qu'il voyage avec le dépôt.
> Tenu à la main au fil des sessions. Convention : commits sur `main`.

Backlog de **radasses** (`~/work/radasses`), à jour au **2026-07-30**. Contexte
technique complet dans [[radasses-project]]. Convention : Pierre commite sur `main` ;
demander avant d'agir sur les questions « comment » ([[ask-before-doing-how-questions]]).

**REPRISE (prochaine session)** : l'app est **en ligne et saine** (GitHub Pages
depuis `production`, Supabase cloud OK, keep-alive, favicon). Dette technique
**points 1, 3, 4 FAITS le 2026-07-31** (client.ts throw, tests partagés split +
Vitest, rechargement sélectif — cf. section « Dette technique » ci-dessous).
⚠️ **NON commité au 2026-07-31** (Pierre teste dans le navigateur d'abord, puis
commite lui-même). **Prochain chantier dette = points 2 + 5 dans UNE SEULE
migration** : (2) durcir la garde `auth.uid() is null` des RPC ; (5) étendre le
verrou optimiste aux participants/réglages. Commandes tests : `npm run test`
(Vitest) + `npx supabase test db` (pgTAP, nécessite Docker/stack locale).

**Chantiers « présentation » (prioritaires selon Pierre) :**

- **i18n / multi-langue (préparer)** : externaliser TOUS les messages, intitulés,
  labels, titres dans un **fichier séparé** (dictionnaire), en vue du multi-langue.
  Pour l'instant juste centraliser les chaînes FR, pas de vraie bascule de langue.
- **Thème sombre (préparer)** : **mutualiser et formaliser les couleurs, icônes**,
  etc. (tokens/variables) pour permettre un thème sombre plus tard. Aujourd'hui les
  couleurs Tailwind sont en dur partout.
  **Foyer des tokens établi le 2026-07-30** : bloc **`@theme` dans
  `src/routes/layout.css`** (Tailwind v4). Premiers tokens : largeurs
  `--container-app` (max-w-app) / `--container-sheet` (max-w-sheet). C'est LÀ que
  Pierre veut centraliser tout choix « arbitraire » (couleurs, rayons, z-index
  `z-20/30/40`, position FAB `left-[12.5%]`, `duration-200`, `max-h-[85vh]`…),
  à migrer progressivement.
- ~~**Mutualisation des icônes**~~ **FAIT** (hors session, avant le 2026-07-30) :
  migration vers `@lucide/svelte` (ISC) + couche de primitives `$lib/components/ui`
  - `THIRD_PARTY_NOTICES.md`. Reste lié au chantier « thème » (formaliser icônes).

**Accessibilité — passe FAITE le 2026-08-01** (commits `4a4edc7` + `81b7112`) :

- ~~`lang="fr"`~~ ✅ (était `en`).
- ~~**Autofocus 1er champ, DESKTOP-ONLY**~~ ✅ : action `src/lib/actions/autofocus.ts`
  gardée par `matchMedia('(hover:hover) and (pointer:fine)')` (pas d'autofocus tactile
  → n'ouvre pas le clavier). Mécanisme : `autofocusWithin` sur les formulaires en
  ligne (accueil, réglages, participant ajout/édition) + le `BottomSheet` focalise
  `[data-autofocus]` à l'ouverture (dépense/remboursement → Montant). Vérifié en E2E.
- ~~`prefers-reduced-motion`~~ ✅ (`--sheet-duration: 0ms` → sheet sans glissement).
- ~~`aria-live` erreurs~~ ✅ (`FieldError` role=alert, `Alert` role selon le ton).
- ~~**Carte de dépense adaptative en « mode agrandi »**~~ ✅ : container query en `em`
  (seuil **17em**, calibré/mesuré, très commenté dans `t/[tripId]/+page.svelte`).
  Réagit au réglage TAILLE DU TEXTE (Android/desktop), PAS au zoom ; pas d'effet sur
  iOS (Dynamic Type ne scale pas le rem des pages web). Titre pleine largeur (reste
  grand), payeur→bénéf. sur sa ligne, boutons à droite. Test `e2e/expense-reflow.spec.ts`.
  Tout est en **rem** (Tailwind) → l'UI grossit déjà avec le réglage de police.
- ~~**Cibles tactiles**~~ **CLOS le 2026-08-01** : on garde `IconButton`=28px (`h-7`,
  conforme WCAG 2.2 AA) — c'est en rem donc ça grossit avec le réglage police + le
  zoom couvre iOS. Bonus fait (commit `4561dd0`) : **icônes des boutons en `em`**
  (IconButton/Fab, `size/16em`) → l'icône suit le bouton en mode agrandi.
- ~~**`:focus-visible`**~~ **FAIT le 2026-08-01** (commit `0527b25`) : anneau sobre
  (contour `slate-900`, offset 2px) global via `:focus-visible` dans `@layer base`
  de `layout.css` → visible au clavier seulement. Variante « A (sobre) » choisie
  par Pierre parmi 3.
- ~~**dialogue accessible** du `BottomSheet`~~ **FAIT le 2026-08-01** (commit `54254cb`) :
  `role="dialog"` + `aria-modal` + nom accessible (`aria-labelledby` → titre affiché
  en en-tête, fourni par le layout : « Nouvelle dépense »/« Modifier la dépense »/
  « Signaler un remboursement »). Focus déplacé dedans à l'ouverture (champ Montant
  sur desktop ; conteneur `role=dialog` sur tactile → annonce le dialogue SANS ouvrir
  le clavier), focus **piégé** (Tab), **Échap** ferme, focus **restauré** au
  déclencheur (best-effort : le FAB « + » disparaît → pas de restauration dans ce cas).
  Sheet `inert` quand fermé. Gardé par `e2e/dialog-a11y.spec.ts`. ⚠️ En tactile/
  émulation, le focus va sur le conteneur (div, pas d'anneau visible) → normal.
  **→ Chantier accessibilité COMPLET** (lang, autofocus, reduced-motion, aria-live,
  carte adaptative mode agrandi, icônes em, :focus-visible, dialogue accessible).

**Isolation du backend :**

- ~~**Isoler l'accès aux données** (portabilité provider)~~ **FAIT le 2026-07-30** :
  couche `$lib/backend` (ports & adapters) = interface `Backend` + adaptateur
  `backend/supabase/` (seul à connaître supabase-js). Types de domaine dans
  `backend/types.ts`. Changer de provider = un dossier `backend/<x>/` + 1 ligne.
- ~~**Normaliser les erreurs**~~ **FAIT le 2026-07-30** : `BackendError` (code
  stable) + `toBackendError()` ; reload auto sur conflit. **Gotcha corrigé** : le
  verrou optimiste levait `errcode 40001` (serialization_failure) que PostgREST
  RÉESSAIE en boucle → 504/bouton bloqué ; passé en `PT409` (→ HTTP 409 immédiat).
- **Abstraire l'auth** [DIFFÉRÉ VOLONTAIREMENT] : sessions anonymes + identité
  (`getMyPersonId`) + RLS sont très spécifiques Supabase. À faire quand un 2e
  provider concret sera choisi (Pierre cherche surtout une garantie de sauvegarde
  des données), sinon on abstrait à l'aveugle.
- **Login / compte (récupérer tous ses séjours cross-appareil)** [DIFFÉRÉ le
  2026-07-30]. Discuté : login = obtenir un `auth.uid()` DURABLE (Supabase
  `updateUser` convertit l'anonyme en gardant le même uid → séjours préservés) ;
  aval (participant_access/RLS) inchangé, zéro changement de schéma. À construire
  le jour venu : (1) `listMyTrips()` côté serveur (≈ `select * from trips`, déjà
  filtré par la RLS `is_trip_member` — marche même en anonyme, rend « Mes séjours »
  indépendant du localStorage) ; (2) UI créer-compte/connexion/déconnexion ;
  (3) reset mdp, cas de fusion. **Décidé** : le repli « re-cliquer les liens
  d'invitation pour récupérer ses séjours » est **jugé acceptable** → pas d'urgence.
- **Lien de récupération d'accès (sans compte) — IDÉE JUGÉE BONNE par Pierre le
  2026-08-02, « à réfléchir »**. Problème : sur iOS, `localStorage` (donc la
  session anonyme ET `radasses.trips`) est évincible (ITP 7 j, navigateurs in-app
  isolés…) → l'utilisateur peut perdre l'accès à ses séjours. L'app ne peut PAS
  garder les accès durablement elle-même. **Idée** : le **jeton d'invitation EST
  la crédential** (idempotent, re-redeemable). Au lieu de stocker mieux, l'app
  **pousse les jetons DEHORS** vers un coffre que l'utilisateur possède déjà et
  qu'iOS n'efface pas : sa **messagerie/Mail** (« m'envoyer mes accès »), ses
  **Photos** (QR code), un **fichier** (Fichiers/Drive), ou une **icône d'écran
  d'accueil** (URL contenant le jeton). Mécanisme = « recovery bundle » :
  `{tripId, token, name}[]` encodé en lien `…/radasses/#restore=<base64>` (le
  fragment `#` n'est jamais envoyé au serveur), ou QR, ou JSON — 3 rendus du même
  bundle ; l'ouvrir re-redeem chaque jeton → restaure tous les séjours, sans
  compte ni mot de passe. **Prérequis** : stocker le `invite_token` dans
  `radasses.trips` (aujourd'hui id+name seulement — cf. `trips-store.ts`) ; ça
  débloque aussi l'auto-redeem/self-heal. **Réserves** : secret bearer agrégé
  (quiconque a le lien a tout) ; navigateurs in-app iOS (WKWebView) isolés.
  Reco de démarrage : (1) prérequis invite_token ; (2) « m'envoyer le lien » +
  QR ; (3) bonus « ajouter à l'écran d'accueil » par séjour. Complément du
  repli « re-cliquer les liens » déjà jugé acceptable (cf. bullet login ci-dessus).
- **Identités auto-gérées (table `users` maison)** : ÉCARTÉ pour l'instant.
  Impose un composant SERVEUR (edge function) pour signer un JWT compatible RLS
  (le SPA ne peut pas signer) → coût élevé, bénéfice faible (le graphe d'accès est
  déjà dans `public.participant_access` ; seules les creds vivent dans `auth.users`).
  Portabilité mieux servie par l'export de données.
- ~~**Unifier les remboursements**~~ **FAIT le 2026-07-30** (migration `0006`) :
  la table `settlements` et son mécanisme parallèle (recordSettlement /
  cancelSettlement / listSettlements) sont **supprimés**. Un remboursement est
  désormais UNIQUEMENT une dépense (payeur = débiteur, unique bénéficiaire =
  créancier). Annuler = supprimer la dépense. La vue `balances` = payé − dû.
  ⚠️ Ne pas réintroduire de table settlements.

**Dette technique (audit du 2026-07-30) — points 1, 3, 4 FAITS le 2026-07-31 :**

- ~~**`previewSplit` (TS) ↔ `compute_split` (SQL)**~~ **FAIT (point 3)** : source
  unique `src/lib/split.cases.ts` (9 cas) → `split.test.ts` (Vitest, `npm run test`)
  côté TS + `split_generated.test.sql` (pgTAP) généré par `npm run gen:split-sql`
  côté SQL. **Vitest introduit** (le projet n'avait aucun test JS/TS ; runner de
  l'écosystème Vite). Le générateur tourne via `node scripts/gen-split-sql.ts`
  (type-stripping natif Node 22 ; Vitest 4 ne fournit plus `vite-node`). **Dérive
  réelle corrigée** : `previewSplit` donnait 0 (au lieu de rejeter) sur un mélange
  de poids → aligné sur compute_split. **Bonus** : `expenses.test.sql` était cassé
  (référençait la table `settlements` supprimée + attendait errcode `40001` au lieu
  de `PT409`) → réparé, recentré sur l'intégration (balances, verrou, delete).
  Suite : 29 pgTAP + 9 Vitest verts.
- **Tests E2E Playwright ajoutés le 2026-07-31** (`e2e/`, `playwright.config.ts`,
  `npm run test:e2e`) : 5 tests Chromium contre la Supabase LOCALE, auto-seed via
  l'UI (un séjour neuf par test). Valident surtout le rechargement sélectif
  (point 4). Cadence de lancement : voir [[radasses-test-cadence]]. Gotchas E2E :
  le `BottomSheet` garde le `ExpenseForm` MONTÉ (hors écran) → noms des
  participants présents en double dans le DOM ⇒ scoper les assertions de noms aux
  `li.list-row` (helper `listRow`).
- **Correctif auto-sélection des bénéficiaires (2026-07-31, commit SÉPARÉ)** :
  `initSelected` ne tournait qu'au montage du formulaire (monté tôt via le
  BottomSheet, clé `{#key new-0}` figée) → un participant ajouté APRÈS n'était pas
  coché par défaut dans la 1ʳᵉ dépense (cas ultra-courant : on ajoute les
  participants puis on saisit). Corrigé dans `ExpenseForm.svelte` par un `$effect`
  (création seulement) qui coche les participants nouvellement apparus (s'ils sont
  actifs), sans toucher aux choix déjà faits ; suivi via un objet `seen` NON
  réactif (SvelteSet/Set boucleraient l'effet). Gardé par
  `e2e/expense-default-beneficiaries.spec.ts` (vérifié : rouge sans le correctif).
- ~~**`TripState.load()`**~~ **FAIT (point 4)** : `load(sections?)` recharge
  sélectivement (sentinelle `undefined`) ; chaque mutation ne recharge que ses
  sections ; partiel ne touche pas `loading` (pas de spinner). Full = setTrip +
  après conflit.
- ~~**`client.ts` fallback silencieux**~~ **FAIT (point 1)** : `throw` clair si
  l'env Supabase manque (plus de repli localhost).
- ~~(2) **Garde `auth.uid() is null`**~~ **FAIT le 2026-07-31** (migration
  `0007_harden_access_guard.sql`) : garde factorisée dans `assert_trip_access(trip_id)`.
  Un appel via l'API sans session est refusé ; l'accès direct de confiance
  (seed/tests) reste toléré, détecté par `session_user = 'authenticator'` (le rôle
  sous lequel PostgREST se connecte — inchangé par SET ROLE/SECURITY DEFINER).
  ⚠️ NB : `rolsuper` ne marche PAS comme discriminant (le rôle `postgres` de
  Supabase n'est pas superuser). `save_expense`/`delete_expense`/`add_participant`
  recréées à l'identique, garde → `perform assert_trip_access(...)`. 29 pgTAP OK.
  ⚠️ Pour prendre effet EN PROD : `supabase db push` (migration pas encore poussée
  au cloud au 2026-07-31).
- ~~(5) **Verrou optimiste** étendu aux participants/réglages~~ **ABANDONNÉ le
  2026-08-01 (option C)**. Décidé avec Pierre : le « dernier gagne » est **jugé
  acceptable** sur les updates directs restants (`updateTrip`, `updatePersonName`,
  `updateHouseholdName`, `setParticipantActive` dans `db.ts`) — éditions rares, à
  faible enjeu (renommages, actif/inactif), sans risque de conflit destructeur.
  Le verrou reste sur les **dépenses** (seul vrai risque), déjà couvert.
  → Ne PAS re-proposer d'ajouter `version` sur trips/participants/persons/households.

**Fonctionnalités :**

- ~~**Partage facile des liens d'invitation**~~ **FAIT le 2026-08-06 — COMMITÉ `c60e844`**
  (pas encore poussé). 100% frontend (aucun schéma/migration). Onglet Participants : le bouton-icône
  « Copier le lien » (icône `Link`) est devenu **« Partager »** (icône `Share2`) → ouvre
  une **feuille de partage** (`BottomSheet` local, état `sharing: Participant | null`)
  proposant les canaux en boutons explicites : **Partager…** (Web Share `navigator.share`,
  visible seulement si dispo — `canNativeShare` en `$derived` ; mobile surtout), **E-mail**
  (`<a href="mailto:?subject=…&body=…">`), **SMS** (`<a href="sms:?&body=…">`, forme
  compatible iOS+Android), **Copier le lien** (repli presse-papier, garde le check).
  **Message pré-rédigé nominatif** : « Salut {prénom}, voici ton lien pour rejoindre le
  séjour « {nom} » sur radasses : {lien} » (Web Share porte l'URL à part ; mailto/sms
  l'incluent dans le corps). **Avertissement** (Alert warning dans la feuille) : le lien
  = crédential bearer → partager par un canal individuel, éviter les groupes. mailto/sms
  sont de vrais `<a>` (testables ; `eslint-disable-next-line svelte/no-navigation-without-resolve`
  justifié — schémas externes, pas des routes → resolve() inapplicable). Test
  `e2e/participant-share.spec.ts` (stub `navigator.share` via addInitScript → inspecte la
  charge utile + asserte les href mailto/sms). Gates : svelte-check 0, eslint, Vitest 20/20,
  E2E 15/15. Complète (n'annule pas) l'idée « recovery bundle » ci-dessus (Web Share en
  serait aussi le véhicule pour « m'envoyer MES accès »).
- ~~**Lien de séjour partageable (« Qui es-tu ? » + auto-désignation)**~~ **FAIT le
  2026-08-07 — COMMITÉ `9071bad`** (pas encore poussé). Complément du lien par
  participant : UN lien de séjour (`?join=<join_token>`) diffusable à tous ; à
  l'ouverture, écran « Qui es-tu ? » (page d'accueil) → chacun choisit son nom →
  confirmation systématique « C'est bien toi ? » (+ mention si `claimed`) →
  `claim_participant` → entrée. **Migration `0008_join_link.sql`** : colonne
  `trips.join_token` (défaut auto) + RPC `list_join_candidates(join_token)` (liste +
  drapeau `claimed`) et `claim_participant(join_token, participant_id)` — `SECURITY
DEFINER`, **gardés par le secret du jeton**, PAS `assert_trip_access` (appelant pas
  encore membre, comme `redeem_token`). Backend : `Trip.join_token`, type
  `JoinCandidate`, `getTrip` lit `join_token`. Onglet Participants : bouton « Partager
  le lien du séjour » (feuille canaux natif/e-mail/SMS/copier) ; le partage
  **individuel par participant reste**. Tests : `join.test.sql` (pgTAP) +
  `e2e/trip-join-link.spec.ts`. Gates : svelte-check 0, eslint, Vitest 20/20, pgTAP
  36/36, E2E 16/16. **POUSSÉ + migration 0008 appliquée au cloud le 2026-08-07 (par
  Pierre)** → en ligne. **Au 2026-08-07 : TOUT est poussé sur main + production**
  (jusqu'à `e6cf967` inclus) ; migration 0008 sur le cloud. Aucun commit local en attente.
  **⚠️ MàJ 2026-08-08** : commit local **`0cd5d0e`** en attente de push (« Remboursement :
  montant prérempli = celui affiché (arrondi ou exact déplié) » — au clic « Remboursé ! »,
  montant = affichage de la suggestion : arrondi par défaut, exact si dépliée au clic ;
  `RoundableAmount.revealed` devient bindable, l'onglet Soldes suit l'état déplié par
  suggestion. Gates : svelte-check 0, eslint, Vitest 22/22, E2E 18/18).
  Compromis d'usurpation ASSUMÉ (quiconque a le lien peut choisir n'importe quel nom)
  → avertissement « réserver aux participants ». **Partie ABANDONNÉE (2026-08-07)** :
  « je ne suis pas dans la liste » → demande d'ajout validée (aurait exigé table
  `join_requests` + notion de créateur, absente du schéma). Synergie « recovery
  bundle » : la sauvegarde du lien perso après réclamation reste à faire (différée).
- **Faire des foyers des entités à part entière (IDÉE, Pierre 2026-08-05)** — pour
  « peut-être » plus tard. Aujourd'hui un foyer est rattaché à un séjour UNIQUEMENT
  via ses membres (`trip_participants.household_id`) : `households` n'a pas de
  `trip_id`, `TripState.households` est dérivé des participants, et
  `can_see_household` (0002) est faux sans membre. Conséquence : un **foyer vide est
  invisible et injoignable** (ni liste, ni soldes, ni `HouseholdSelect`, ni RLS ; +
  aucun grant/policy DELETE sur `households`). C'est pourquoi « bouton supprimer un
  foyer vide » a été **écarté le 2026-08-05** (rien à quoi l'accrocher, aucune gêne
  visible). Si on veut un jour lister/supprimer/gérer les foyers vides ou renommer
  hors membres : ajouter `households.trip_id` (migration + backfill via les membres),
  corriger `can_see_household`/l'énumération, ajouter une capacité DELETE (policy ou
  RPC). Débloquerait aussi une vraie gestion des foyers. Cf. plan
  `~/.claude/plans/frolicking-swimming-beacon.md`.
- **Améliorations « répartition détaillée » (signalées par Pierre le 2026-08-02) :**
  1. ~~**Bug perçu** (mode détaillé proposé seulement si tout le monde coché)~~
     **ABANDONNÉ le 2026-08-07** : n'apparaît plus (Pierre) → oublié.
  2. ~~**Poids par défaut par participant, appliqué via un BOUTON**~~ **FAIT le
     2026-08-06 (SANS migration — la colonne existait déjà) — COMMITÉ `7b263e1`**
     (pas encore poussé). La colonne
     `trip_participants.default_weight numeric(8,3) not null default 1 check (>= 0)`
     existait DÉJÀ (`0001_schema.sql`) et le chemin de lecture la portait déjà (type
     `Participant.default_weight`, `listParticipants`, `addParticipant`). Ajouté :
     - Backend setter `setParticipantDefaultWeight(participantId, weight)` (`db.ts` +
       interface `Backend` + raw map `supabase/index.ts`) — update direct « dernier
       gagne ». Store `updateParticipant` étendu d'un param `default_weight` (n'écrit
       que si changé).
     - UI réglage : champ « Poids par défaut » (chaîne, décimale FR/EN, validé > 0) à
       l'édition du participant (`participants/+page.svelte`, état `editWeight`).
     - `ExpenseForm` : bouton **« Appliquer les poids par défaut »** visible SEULEMENT
       en mode détaillé ET si au moins un bénéficiaire coché a un poids ≠ 1
       (`canApplyDefaultWeights`). Clic → chaque coché passe en mode _poids_ +
       `benefValue = String(default_weight)`. Le remplissage initial reste « 1 pour
       tout le monde » ; le bouton l'écrase (cadrage Pierre : « proposé quand on passe
       en détaillé, à la place du 1 partout »). NB : contrairement au design initial,
       le bouton n'allume PAS le détaillé (il n'apparaît qu'EN détaillé).
     - ⚠️ **Bug latent corrigé au passage** (`ExpenseForm.svelte`) : le formulaire est
       monté une seule fois (bottom-sheet du layout) → `initDetail` ne semait
       `benefMode`/`benefValue` que pour les participants présents au MONTAGE. Un
       participant ajouté APRÈS (cas courant) n'avait pas d'entrée détaillée → ses
       contrôles poids/€ ne s'affichaient pas en mode détaillé. Le `$effect` de
       rattrapage (qui ne réparait que `selected`) sème désormais aussi
       `benefMode='weight'`/`benefValue='1'`. Révélé par la nouvelle feature.
     - Test `e2e/participant-default-weight.spec.ts` (Bob 0,5 → sur 60 €, 40/20 au lieu
       de 30/30).
     - Piste (b) « se rappeler du dernier choix » reste un complément possible plus tard.
- ~~**Montage paresseux du formulaire de dépense**~~ **FAIT le 2026-08-06 — COMMITÉ
  `f0bc15c`** (pas encore poussé). `+layout.svelte` : le `<ExpenseForm>` n'est monté
  que `{#if state.formOpen || state.hasCreateDraft}` (avant : monté en permanence dans
  le bottom-sheet). L'instantané des participants (`initSelected`/`initDetail`) se fait
  donc à la 1re ouverture, liste à jour → cas courant correct par CONSTRUCTION, sans
  dépendre du catch-up `$effect` (qui ne sert plus qu'au flux rare « Masquer → ajouter
  un participant → Reprendre » : le formulaire reste alors monté grâce à la clause
  `hasCreateDraft`, ce qui préserve la saisie). ⚠️ La clause `|| state.hasCreateDraft`
  est ESSENTIELLE (sans elle, « Masquer » démonterait → saisie perdue au remontage).
  Tests : `e2e/expense-form-lazy-mount.spec.ts` (masquer→ajout→reprendre : saisie
  conservée + participant intégré, discriminant pour la clause) +
  `e2e/expense-form-rebuilt-on-add.spec.ts` (formulaire refait à neuf entre 2 créations).
  Gates : svelte-check 0, eslint, Vitest 20/20, E2E 14/14.
- ~~**Mutualiser les menus déroulants + déplacer un participant de foyer (B)**~~
  **FAIT le 2026-08-05 (sans migration)** — ⚠️ PAS encore commité (Pierre teste au
  navigateur puis commite). Créés : `ParticipantSelect.svelte` (3 menus : « Payé par »
  ExpenseForm, « Qui rembourse »/« Qui est remboursé » ReimbursementForm ; props
  `showInactiveTag`, `placeholder`) et `HouseholdSelect.svelte` (mutualisé création
  « Rejoindre : » / édition). Feature B : adapter `setParticipantHousehold` (PostgREST
  direct — `update trip_participants.household_id`, ou `insert households`+update pour
  un nouveau foyer ; RLS déjà permissive `tp_update`/`hh_insert` → PAS de RPC/migration),
  store `updateParticipant` (renomme et/ou déplace, n'écrit que ce qui a changé, 1 seul
  reload `participants`+`balances`). Édition participant : champ texte Foyer (qui
  RENOMMAIT) → menu déroulant qui DÉPLACE (rétroactif, assumé). `renameParticipant`
  supprimé du store ; `updateHouseholdName` gardé en réserve (renommage de foyer « ailleurs »
  plus tard). Foyers vides NON nettoyés. Test `e2e/participant-household-select.spec.ts`.
  Gates : svelte-check 0, eslint, Vitest 16/16, E2E 9/9 (1 flake de parallélisme sur
  `trip.spec.ts:42` → OK en isolé).
  **Aussi (2026-08-05) : `AmountInput.svelte`** — enveloppe fine (option « a ») qui bake
  `placeholder="Montant €"` + `inputmode="decimal"` ; valeur reste une CHAÎNE (parsing
  `centsFromEuros` laissé aux formulaires). Câblé dans ExpenseForm + ReimbursementForm
  (largeur via `class`, `data-autofocus` relayé). Placeholder conservé → E2E inchangés (9/9).
  **Reste NON mutualisé (jugé pas rentable le 2026-08-05)** : `DateInput` (markup trop
  mince — juste `type="date"` ; label/largeur diffèrent) ; `AmountInput` « riche » option
  « b » (posséder les centimes → refactor de la prévisualisation live, pas fait). Menus
  restants = 1 seule occurrence chacun (devise `reglages`, poids/€ fixe `ExpenseForm`)
  → rien à mutualiser. **Détail historique de l'analyse ci-dessous :**
- **Mutualiser les menus déroulants (signalé par Pierre le 2026-08-05)** :
  ⚠️ **DÉCOUVERTE** : le champ « Foyer » n'est PAS le même widget/opération en
  création et en édition de participant (`participants/+page.svelte`) :
  - **Création** (`onAdd`) : `<Select>` = choisir QUEL foyer rejoindre (existant, ou
    `__new__` = nouveau foyer pour cette personne seule) → fixe `household_id`.
  - **Édition** (`onSaveEdit`) : `<TextInput>` = RENOMMER le foyer courant (partagé,
    affecte tous ses membres) → garde `household_id`, change `household_name`.
    Donc « mettre un menu déroulant dans l'édition comme dans la création » CHANGERAIT
    la sémantique en « déplacer le participant vers un autre foyer » = la feature
    **différée** « Changer un participant de foyer » (rétroactivité sur dépenses
    nominatives figées, cf. bullet dédié). → décision produit AVANT tout refactor.
    **Tranché par Pierre le 2026-08-05** : on fait **B** (édition = déplacer vers un
    autre foyer ; le renommage de foyer sera proposé ailleurs). Rétroactivité ASSUMÉE :
    la vue `balances` (0006) agrège par `person_id` avec le `household_id` COURANT →
    déplacer = simple `UPDATE trip_participants.household_id`, tout l'historique
    payé/dû bascule au nouveau foyer (cohérent avec le renommage déjà rétroactif).
    **Foyers vides = PAS de nettoyage automatique** (on verra plus tard pour le permettre).
    Les menus VRAIMENT mutualisables (mêmes options = participants) sont les **3
    `<Select>` de participant** : « Payé par » (`ExpenseForm`), « Qui rembourse » +
    « Qui est remboursé » (`ReimbursementForm`) — quasi-dupliqués, variantes mineures
    (tag « (parti) » pour inactifs ; option vide « — » ; défaut payeur) → extraire un
    `ParticipantSelect` (`$lib/components/ui` ?). Le menu foyer de création → possible
    `HouseholdSelect` (nouveau/existant) à part.
- ~~**Crédit/débit détaillés par personne et par foyer**~~ **FAIT le 2026-08-05**
  (NON commité au moment de l'écriture). 100% frontend, aucun backend/schéma : les
  parts sont déjà stockées (`expense_beneficiaries.amount_cents`). Helper pur
  `src/lib/balance-detail.ts` `computeBalanceDetail(personIds, expenses, beneficiaries)`
  → `{paid_cents, owed_cents, net_cents, lines}` (foyer = union des `person_id` des
  membres ; net foyer == vue `balances`). Test `balance-detail.test.ts` (4 cas).
  Présentation (Pierre a changé d'avis en cours → **les DEUX sont des pages dédiées**) :
  `/t/[tripId]/personne/[personId]` et `/t/[tripId]/foyer/[householdId]`. Points
  d'entrée : nom de membre cliquable (onglet Participants + liste « Foyer · membres »
  de la page foyer) ; nom de foyer cliquable dans « Soldes par foyer » ET dans l'en-tête
  de foyer de l'onglet Participants.
  Composant `BalanceLedger.svelte` : Net en tête, puis DEUX sections
  **« Payé par lui »** (crédit) / **« Payé pour lui »** (débit) — subdivision voulue
  par Pierre. « Payé pour lui » EXCLUT les dépenses payées par le sujet (déjà dans
  « payé par lui »). Bandeaux colorés (vert crédit / rouge débit) pour séparer nettement
  les deux sections. ⚠️ **Sur demande de
  Pierre**, les dépenses du détail réutilisent la MÊME carte que l'onglet Dépenses →
  carte extraite en **`ExpenseCard.svelte`** (mutualisée : onglet Dépenses +
  BalanceLedger). `ExpenseCard` a un prop optionnel **`shareCents`** : dans « payé
  pour lui », la carte affiche la PART pour le sujet en gros (`text-lg`) + le total
  en petit (« sur X € ») ; sinon elle montre le total (onglet Dépenses, « payé par lui »).
  - **À FAIRE (Pierre, 2026-08-06)** : dans « payé par lui », afficher pour chaque
    dépense la part payée **pour les AUTRES** = `paid_cents − owed_cents` (montant payé
    − sa propre part ; les deux sont déjà dans `detail.lines`), en gros comme
    `shareCents` côté « payé pour lui ». Ainsi le **Net = Σ(part payée pour les autres)
    − Σ(part payée pour lui)** = exactement `detail.net_cents` (vérifié algébriquement).
    Total « payé par lui » à passer sur cette somme « pour les autres » plutôt que le
    total brut, pour que les deux bandeaux se soustraient visuellement au Net. Étendre
    `ExpenseCard` (ex. un 2e mode, ou réutiliser `shareCents` avec un libellé). Note sémantique affichée : le net par personne est indicatif (le
    règlement se fait par foyer). Test `e2e/balance-detail.spec.ts`. Gates : svelte-check
    0, eslint, Vitest 20/20, E2E 11/11.
- ~~**Onglets en icônes + Journal déplacé dans Réglages + affordances cliquables**~~
  **FAIT le 2026-08-07 — COMMITÉ `59358a6`** (pas encore poussé). Onglets `TripBottomNav`
  en **icône + mini-label** (0.8rem), séparateurs verticaux (`border-l` sur les 2e/3e) :
  **Receipt=Dépenses, Scale=Soldes, Users=Participants** ; **Journal retiré** (4→3
  onglets, `--fab-x` 12.5%→16.6667%) et accessible **via Réglages** (entrée dédiée
  `History` + chevron → `/t/[tripId]/journal`). Flèche « retour » (`showBack`) étendue à
  réglages + journal. **Convention « cliquable » visible au repos (donc au doigt)** :
  lignes navigables = **chevron `›` à droite** (Soldes, « Mes séjours », Réglages) ;
  liens texte en ligne = **soulignement discret permanent** via la classe **`.link-inline`**
  (`@layer components` de `layout.css`, `decoration-slate-300`) en remplacement des
  `hover:underline`. Gates : svelte-check 0, eslint, Vitest 20/20, E2E 16/16.
- **Barre du séjour — retour aux séjours / retour arrière (Pierre 2026-08-06)** : FAIT
  `b88a1eb` — favicon central = « Retour aux séjours », coin gauche = « Revenir en
  arrière » (`history.back()`) sur sous-pages seulement (foyer/personne/réglages/journal).
- ~~**Réglages — « Qui suis-je ? »**~~ **FAIT le 2026-08-07 — COMMITÉ `eca6311`** (pas
  encore poussé). Carte en tête de Réglages : nom + `le foyer {nom}` du participant
  rattaché à la session (`TripState.myPersonId`, déjà chargé via section `me`) ; repli
  « Identité inconnue sur cet appareil. ». Test `e2e/reglages-whoami.spec.ts`.
- **Identité : ambiguïté `getMyPersonId` + bascule d'utilisateur (Pierre 2026-08-07,
  « pour plus tard »)**. Constaté en testant le lien de séjour en LOCAL : un même
  navigateur = **une seule session anonyme persistante** (localStorage → `auth.uid`
  fixe). Ouvrir le lien d'un autre participant (perso `?token=` ou claim) fait un
  `insert participant_access on conflict do nothing` → le MÊME `auth.uid` cumule
  plusieurs identités, il n'y a PAS de bascule. (a) **`getMyPersonId` renvoie `limit 1`
  SANS tri** → « Qui suis-je ? » affiche une identité arbitraire quand il y en a
  plusieurs. Correctif possible : tri déterministe, ou notion d'« identité active ».
  (b) **Vraie bascule d'identité** (« changer d'utilisateur ») = chantier à part :
  `signOut({scope:'local'})` + `signInAnonymously()` puis claim, ou sélecteur quand
  plusieurs identités. Pour tester plusieurs users en local : navigation privée /
  autre profil / autre navigateur (session distincte).
- **Réglages — rubrique « liens d'accès » (Pierre 2026-08-07)** : une section expliquant
  le **lien de séjour** (partageable, « Qui es-tu ? ») ET le **lien personnel** (jeton
  par participant), + **comment les conserver** (les sauvegarder pour retrouver l'accès :
  e-mail à soi, favori, écran d'accueil…). Rejoint directement l'idée « recovery bundle »
  et le point différé « sauvegarder le lien perso après auto-désignation » (cf. bullet
  lien de séjour). Réutilise les helpers de partage (Web Share/mailto/sms/copier).
- ~~**Pull-to-refresh**~~ **FAIT le 2026-08-07 — COMMITÉ `3e7c266`** (pas encore poussé).
  Action réutilisable `src/lib/actions/pullToRefresh.ts` (recette standard, SANS dépendance,
  écouteurs _touch_, no-op à la souris → E2E/desktop intacts) : tirer vers le bas au sommet
  d'un scroller → `tripState.load()`. Le contenu (conteneur **`data-ptr-content`**) suit le
  doigt (rogné par le scroller → montre le bord haut) + spinner (créé/animé par l'action,
  WAAPI) ; respecte `prefers-reduced-motion`. Posé sur le scroller du layout
  (Dépenses/Participants/Journal/sous-pages) ; **désactivé sur Soldes** (double scroller) où
  il est sur la liste des soldes (option 2 : pas de refonte). ⚠️ **PAS gaté par matchMedia**
  (fragile, évalué au montage → cassait l'émulation DevTools). Test DevTools = **clic-glisser**
  (la molette/trackpad = `wheel`, pas `touch`) ; pas de rebond élastique sur desktop (normal).
  Pas d'E2E du geste (tactile trop fragile à automatiser). Gates : svelte-check 0, eslint,
  Vitest 20/20, E2E 17/17. Piste possible plus tard : support `wheel`/trackpad pour desktop.
- ~~**Arrondir les montants (Soldes) — option + exact au survol/appui**~~ **FAIT le
  2026-08-07 — COMMITÉ `e6cf967`** (pas encore poussé). Préférence d'AFFICHAGE **de
  l'appareil** (`src/lib/prefs.svelte.ts`, localStorage, singleton réactif runes, **ON
  par défaut**, non partagée). Onglet Soldes (soldes par foyer + suggestions) : montants
  **arrondis à l'euro** ; exact révélé au **survol** (`title`) et à l'**appui** (tap →
  bascule ; soulignement pointillé). `moneyRounded()` dans `format.ts`. Composant
  `RoundableAmount.svelte` (`pointer-events-auto` pour rester tappable dans la ligne de
  solde en **« stretched-link »** — la ligne navigue, le montant déplie). Toggle dans
  Réglages. « Remboursé ! » préremplit le montant **arrondi** quand ON (éditable).
  ⚠️ Purement AFFICHAGE (données en centimes intactes) — distinct du « moteur d'arrondi »
  (tampon par soustraction) évoqué pour l'export CSV. Tests : `format.test.ts`,
  `e2e/rounding.spec.ts` + helper `disableAmountRounding`. Gates : svelte-check 0, eslint,
  Vitest 22/22, E2E 18/18.
- **Dupliquer une dépense** : lien « dupliquer » → préremplit une nouvelle dépense
  avec la ventilation complète d'une autre (payeur+date source conservés, éditable).
- **Multi-payeur** [NON TRANCHÉ] : dépense payée par plusieurs. Soit rester sur
  « deux dépenses » (dispo, zéro code), soit vraie feature (table expense_payers,
  section « payé par » multi symétrique aux bénéficiaires). À décider.
- **Import CSV de dépenses** : fichier local → écran de mapping (colonnes
  bénéficiaires + payeur/date/libellé → participants) + interprétation des cellules
  (montant/poids/présence) + preview → merge via save_expense. Gotchas : format FR
  (`;`, décimale `,`), mapping des noms, doublons, invariant tampon.
- **Export/Import JSON** : round-trip fidèle du séjour entier (foyers+personnes+
  dépenses ; les remboursements SONT des dépenses désormais), format versionné,
  réf par clés locales (pas d'UUID).
  Import = nouveau séjour ; fusion plus tard.
- **Bilan / export CSV** : 1 ligne/dépense, colonnes foyers PUIS participants,
  cellule = part. Variante : export tableur avec **formules** → suppose peut-être de
  changer le **moteur d'arrondi** (plus-fort-reste → arrondi + tampon par
  soustraction, exprimable en formule) [NON TRANCHÉ].
- **Journal** : sauter d'une dépense à son dernier événement du journal.
- ~~**Changer un participant de foyer**~~ **FAIT le 2026-08-05** (feature B, via le
  menu déroulant Foyer de l'édition — cf. « Mutualiser les menus déroulants »). La
  « rétroactivité » redoutée n'en était pas une : les bénéficiaires sont stockés par
  `person_id`, la vue `balances` joint par foyer COURANT → déplacer re-bascule tout
  l'historique, cohérent avec le renommage déjà rétroactif.

**Décisions (ne pas re-proposer) :**

- **Mode remboursement alternatif : ABANDONNÉ le 2026-07-30.** Pas d'option
  « remboursements fidèles aux dépenses » vs minimum de virements — pas jugé
  intéressant. Le message qui compte est « un remboursement = une dépense » ;
  il est considéré **suffisamment communiqué** par le bouton « signaler un
  remboursement » présent sur l'onglet Soldes. Pas de texte explicatif à ajouter.

**Déploiement & robustesse :**

- ~~**Auto-réparer une session orpheline**~~ **FAIT le 2026-08-01 (approche
  RÉACTIVE, choisie par Pierre) — commit `8a4e2e1` (PAS encore poussé)**. Zéro
  coût sur le happy path : on détecte l'erreur quand elle
  survient plutôt que de sonder au démarrage. Mécanisme :
  (1) `supabase/errors.ts` → `isOrphanedSession()` détecte FK `23503` vers
  `auth.users` (`participant_access_auth_user_id_fkey` au redeem, `created_by_fkey`,
  `actor_auth_user_id`, ou `table "users"`) + GoTrue `user_not_found` → nouveau code
  domaine **`orphaned-session`** (dans `backend/errors.ts`) ;
  (2) `supabase/auth.ts` → `repairOrphanedSession()` : `signOut({scope:'local'})` +
  `signInAnonymously()` + `location.reload()`, **anti-boucle** via
  `sessionStorage['radasses:session-repaired']` (une réparation par chargement,
  sinon l'erreur remonte à l'UI) ;
  (3) `supabase/index.ts` → filet `withSessionRepair` appliqué à TOUTES les méthodes
  de l'adaptateur en un seul point (`Object.fromEntries` sur `raw`).
  Testé : `errors.test.ts` (Vitest, 7 cas sur la détection). NON couvert en E2E
  (supposerait de supprimer l'utilisateur `auth.users` via service_role tout en
  gardant la session navigateur — brittle). Cas expense mid-session : `assert_trip_access`
  lève `42501` (forbidden) AVANT la FK → pas soigné réactivement, mais le point
  d'entrée de récupération (rouvrir un lien → redeem) l'est. Cf. [[radasses-db-reset-gotcha]].
- **Vérification post-déploiement automatique** [IDÉE, pour « un jour » — souhait
  de Pierre le 2026-07-31]. Aujourd'hui la vérif post-déploiement est manuelle
  (voir smoke-test §3 du 2026-07-31). Ordre de faisabilité : (1) **health-check**
  dans le workflow après le déploiement Pages (`curl` URL en ligne = 200 +
  `/auth/v1/settings` = 200) — cheap, zéro risque ; (2) **garde-fou de dérive de
  migration** (`supabase migration list` : alerter si local pas poussé au cloud) —
  lecture seule, évite le « db push oublié » ; (3) **smoke E2E contre la prod**
  (Playwright sur l'URL en ligne) — délicat car écrit dans la VRAIE base → suppose
  d'abord un séjour jetable + un « supprimer un séjour » (n'existe pas encore).
  Reco : faire 1+2 d'abord, 3 seulement après un moyen de nettoyage.
- **PWA / hors-ligne** : manifest, icônes, shell offline niveau 1 (message clair
  hors-ligne). **État actuel (constaté le 2026-08-07) : l'app ne marche PAS hors-ligne.**
  Aucun service worker (`src/service-worker.*` absent), pas de manifest. Le démarrage
  est BLOQUANT sur le réseau : `+layout.svelte` `onMount` → `ensureSession()` appelle
  `signInAnonymously()` (réseau) si aucune session locale → sinon `error` et les
  `children` restent masqués (`{#if ready}`). SPA `ssr=false` : toutes les données
  viennent de Supabase, AUCUN cache local des dépenses/participants/soldes, AUCUNE file
  d'écriture. Seuls persistés en localStorage : la session anonyme + `radasses.trips`
  (id+name → « Mes séjours » peut s'afficher hors-ligne, mais ouvrir/éditer un séjour
  échoue). Cas « jamais venu + hors-ligne » = écran blanc (pas de SW pour servir le shell).
  - **Niveau 1** = service worker qui cache le shell + message « hors-ligne » propre.
  - **Offline-first RÉEL (cache des données + file d'écriture re-synchronisée)** :
    **PRÉVU par Pierre « un jour » (noté le 2026-08-07)** — gros chantier, à faire à terme.
  - **ANALYSE APPROFONDIE (Pierre 2026-08-08, « comment passer au vrai offline ? » +
    envisage un mode plus "appli")** — noté, rien démarré (question « comment » → attendre
    le feu vert, cf. [[ask-before-doing-how-questions]]) :
    - **DEUX objectifs SÉPARABLES et indépendants** : (1) **« Mode appli » / PWA** =
      installable, plein écran, app-shell en cache, se lance offline — **peu coûteux**,
      AUCUNE donnée offline requise, grosse valeur perçue ; c'est le **niveau 1** ci-dessus
      et un **prérequis technique** (service worker) du (2). (2) **Vrai offline-first des
      données** = consulter ET modifier ses séjours sans réseau puis resynchroniser — ordre
      de grandeur au-dessus (problème de systèmes distribués : réconciliation de conflits).
    - **Ce qui rend le vrai offline dur ICI** : l'app est un **client mince** — Postgres est
      la source de vérité, calcule le modèle de lecture (**`balances` est une VUE SQL**,
      cf. `db.ts:92`) ET applique les permissions (RLS / `SECURITY DEFINER`). Hors-ligne rien
      de tout ça. En plus les écritures utilisent une **concurrence optimiste par version**
      (`conflict` → reload) invérifiable sans réseau.
    - **Atouts déjà en place** : (a) **ports & adapters** (`$lib/backend`) = couture propre
      pour insérer cache/sync sans toucher aux écrans ; (b) **les settlements sont DÉJÀ
      calculés côté client** (`simplifyDebts` dans `settlements.ts`, `transfers` en `$derived`)
      → la moitié du modèle de lecture est déjà en TS ; (c) **rechargement sélectif**
      (`load(sections)`) se mappe sur une invalidation de cache.
    - **VERROU à traiter en 1er** : extraire le calcul de **`balances` en TS partagé et testé**
      (n'existe qu'en SQL aujourd'hui) — arithmétique pure (payé − dû par foyer, à partir de
      `expenses`+`expense_beneficiaries`). C'est le pivot commun au cache lecture ET à
      l'optimistic-write. Vérifiable en croisant la fonction TS avec la vue SQL (pgTAP).
      Refacto à faible risque à faire quoi qu'il arrive.
    - **PALIERS** (du moins cher au plus puissant) : **A — cache lecture seule**
      (cache-then-network : snapshot du séjour en IndexedDB, offline = lecture seule +
      mutations bloquées avec message clair + recalcul local des soldes ; zéro conflit).
      **B — offline + outbox** (mutations optimistes locales empilées comme opérations,
      rejouées à la reconnexion ; requiert le recalcul local (A) + journal d'ops + stratégie
      de réconciliation, base = reload-sur-conflit déjà là) = le « vrai » offline-first.
      **C — local-first / CRDT** (ElectricSQL, PowerSync, RxDB, Yjs) : robuste multi-appareils
      temps réel mais gros engagement, change le contrat backend.
    - **RECO de séquencement** : (1) PWA shell d'abord (indépendant, petit, prérequis) ;
      (2) extraire `balances` en TS testé (le verrou) ; (3) palier A ; (4) A→B seulement si
      le besoin se confirme (domaine clément : peu d'éditeurs concurrents/séjour, ops
      quasi-commutatives — mais le modèle de conflit se CONÇOIT avant de coder) ; (5) éviter C
      tant que le multi-appareils temps réel n'est pas un vrai besoin.
    - **À TRANCHER par Pierre avant de démarrer** : détailler le plan **PWA shell** (le plus
      rentable, livrable seul) OU le plan **extraction `balances` + palier A** ? Et : le
      multi-appareils temps réel est-il un besoin réel à moyen terme (→ pèse pour/contre C) ?
    - **RAFFINEMENT MAJEUR (Pierre 2026-08-08) — event sourcing + règle online/offline** :
      la cible idéale de Pierre = **une BD avec le journal comme SOURCE DE VÉRITÉ**, tous les
      calculs faits **localement** par le téléphone (repli du journal → dépenses/participants/
      soldes = projection). Offline = les opérations restent des **entrées de journal locales**
      (le tail non-synchronisé) jusqu'à reconnexion, où on les **appende** au journal partagé
      (« rallongé »). PAS besoin d'outbox séparé : la file de sortie = le tail non-synchronisé.
      **DÉCOUVERTE CLÉ (vérifiée dans le code)** : le journal `operations` (0001) est DÉJÀ un
      **event log fidèle et rejouable** — `before`/`after` en **jsonb = snapshots complets**
      (pour une dépense, `after = {expense, beneficiaries}` — la ventilation complète est
      dedans, cf. `save_expense` dans `0003_expenses_logic.sql`), `id bigint identity` =
      **ordre total attribué par le serveur** (« le serveur est le sérialiseur », le modèle
      d'ordonnancement le plus simple qui suffise), append-only garanti. Donc la vision n'est
      PAS une réécriture : c'est **inverser QUI fait autorité** (aujourd'hui le journal est un
      produit dérivé écrit APRÈS mutation des tables ; demain on appende l'événement PUIS on
      projette).
      • **RÈGLE ONLINE/OFFLINE (Pierre)** : seules les opérations **sans conflit possible**
      sont faisables **offline = ajouts + suppressions** ; toute **modification** (update)
      doit se faire **online** → le conflit est **immédiat** via le **verrou optimiste par
      version DÉJÀ en place** sur les dépenses. Insight fort : ce découpage isole exactement
      le **sous-ensemble sans conflit par construction** (log grow/tombstone, cas trivial des
      CRDT) → les ajouts commutent, les suppressions sont idempotentes → **ZÉRO machinerie de
      merge à écrire**. Classification : _offline OK_ = ajouter une dépense, ajouter un
      participant, supprimer une dépense ; _online obligatoire_ = éditer une dépense,
      renommer, déplacer un participant de foyer, activer/désactiver un participant, changer
      la devise (surtout celle-ci). **Nuance** : « supprimer » n'est pas 100 % sans conflit —
      A supprime X offline pendant que B édite X online → au merge la suppression gagne
      (edit-puis-delete = supprimé) : PAS une corruption (intention plus tardive, défendable),
      mais peut surprendre. Échappatoire gracieuse : éditer offline via supprimer+recréer
      (reste dans le sous-ensemble sans conflit, dégrade en LWW).
      • **UNDO = opération de compensation (Pierre 2026-08-08)** — chantier À PART, découplé de
      l'offline ET de la bascule event-sourcing, **livrable MAINTENANT** sur le schéma actuel.
      « Défaire » = **appendre l'opération inverse**, jamais muter l'historique. Comme
      `operations` stocke `before`/`after` complets, **tout est déjà inversible** : inverse de
      create=delete, de delete=re-create depuis `before`, d'update A→B = update B→A. Se marie
      avec la règle offline (défaire un ajout=suppression→offline ; défaire une
      modif=modif→online). Implémentable via un RPC `undo(operation_id)` qui lit l'op et
      applique l'inverse **via les RPC existants** (`save_expense`/`delete_expense`, qui
      journalisent déjà). Défaire un update = rappeler `save_expense` avec les valeurs de
      `before` + l'`expected_version` courant → récupère GRATIS le verrou (conflit immédiat).
      Redo = défaire le défaire. **Reco UX** : privilégier défaire la DERNIÈRE op (pile, zéro
      surprise) ; autoriser défaire une entrée quelconque mais MONTRER l'effet ; support
      naturel = la vue Journal (bouton « défaire » par entrée). **Nuance** : undo restaure le
      `before` de l'op (pas « l'état actuel moins cette op ») → sous concurrence peut écraser
      une modif intervenue (LWW), prédictible mais parfois surprenant.
      • **REPRENDRE LE MÊME `id` en restaurant** (pourquoi c'est important) : pour une dépense,
      ce n'est PAS une histoire de FK (rien d'externe ne référence l'id d'une dépense) mais
      d'**identité** — même id = vrai undo (idempotent : double-undo/rejeu du tail = UNE
      entité, pas des doublons ; redo propre ; journal cohérent « X créée/supprimée/restaurée » ;
      fold uniforme « dernier état par id gagne », pas de concept de tombstone permanent). Pour
      un **participant/foyer c'est OBLIGATOIRE** (correction, pas élégance) : `person_id`/
      `household_id` sont référencés partout (parts passées, `balances`) → un nouvel id
      **orphelinerait l'historique**. Coût : que `save_expense`/l'insert de restauration
      **accepte un id fourni** (Postgres OK). **Tombstone** ici = suppression exprimée comme un
      AJOUT au journal (`action='delete'`, `after=null`) : présent dans l'historique, absent de
      la projection ; pas permanent (un create même-id le fait revivre) → c'est ce qui rend
      l'undo possible.
      • **SUPPRESSION DE PARTICIPANT (Pierre 2026-08-08)** — n'existe PAS aujourd'hui (seulement
      actif/inactif = `setParticipantActive`, un update ; aucune policy/grant DELETE sur
      `trip_participants`). Si on l'ajoute : garde façon FK RESTRICT (supprimer seulement si
      aucune dépense ne le référence comme payeur/bénéficiaire). **Tension identifiée avec
      l'undo** : la règle « aucune dépense ACTUELLE » regarde le vivant, or l'undo ressuscite
      une dépense SUPPRIMÉE (tombstone) → on pourrait supprimer un participant plus référencé
      que par des dépenses supprimées, puis échouer à restaurer ces dépenses (référence
      pendante). **Deux postures** : (restrictive, RECO) ne supprimer que les participants
      référencés par AUCUNE dépense du journal (vivante OU supprimée) = jamais utilisés →
      invariant « toute entrée restaurable » préservé ; (permissive) garder « aucune vivante »
      et assumer que l'undo d'une vieille dépense la référençant est bloqué. **Division du
      travail qui rend la tension théorique** : _désactiver_ pour qui a participé (réversible,
      garde l'historique) ; _supprimer_ seulement pour une erreur de saisie jamais utilisée.
    - **CIBLE D'UX OFFLINE (Pierre 2026-08-08)** : le mode offline visé = _l'appli **signale**
      qu'elle est hors-ligne, **affiche quand même tout** (lecture), et **seules certaines
      opérations** (ajouts/suppressions) sont disponibles_. ⚠️ « afficher tout » n'est PAS livré
      par le shell seul → nécessite le **cache des données + reducer local** (étapes 2-3).
    - **ÉTAPE 1 — PWA shell — FAIT le 2026-08-08 sur la BRANCHE `offlinisation` (commit
      `9776323`, PAS poussé)**. Choix de Pierre : PWA shell d'abord. Rend l'appli installable
      (« mode appli ») et la fait DÉMARRER hors-ligne, SANS cache de données (le reste = étapes
      suivantes). Contenu : `static/manifest.webmanifest` (display standalone, theme_color
      `#b82819` = rouge du crabe, `start_url`/`scope`/icônes en **chemins relatifs** →
      agnostiques au base path `/radasses`) ; icônes générées dans `static/` via **ImageMagick**
      depuis `src/lib/assets/favicon-1254.png` (icon-192, icon-512, icon-512-maskable zone de
      sécurité 80 %, apple-touch-icon 180) ; `app.html` (lien manifest + apple-touch + meta
      theme-color/(apple-)mobile-web-app-capable) ; **service worker** `src/service-worker.ts`
      (support natif SvelteKit, auto-enregistré) : precache app-shell (`build`+`files`),
      navigation SPA servie du cache hors-ligne, **API Supabase (autre origine) laissées au
      réseau** (pas de cache données) ; **`base` dérivé au RUNTIME** par SvelteKit
      (`location.pathname`) → correct en local (`/`) comme en prod (`/radasses/`), sans dépendre
      de `BASE_PATH` au build ; `+layout.svelte` : `ensureSession` lit la session en cache SANS
      réseau → démarre hors-ligne ; « jamais venu + hors-ligne » → message dédié (au lieu de
      « Erreur ») ; **bannière « Hors-ligne »** (`navigator.onLine` + retente à la reconnexion).
      Gates : svelte-check 0, eslint, build OK (SW/manifest/icônes émis). Validé au navigateur
      (bannière + shell servi hors-ligne). ⚠️ **Gotchas TEST** : le SW/offline ne se teste PAS
      en `vite dev` → `npm run build && npm run preview` ; pour le preview LOCAL builder **sans**
      `BASE_PATH` (sinon servi sous `/radasses/` → « not found » à la racine). Firefox **desktop**
      n'installe pas les PWA (installabilité → Chrome) ; « Offline » dans Firefox = DevTools ▸
      **Réseau** ▸ menu de limitation ▸ Hors ligne (pas le « Work Offline » du menu).
    - **ÉTAPE 2 — soldes calculés en TS — FAIT le 2026-08-08 sur `offlinisation` (commit
      `3d5408a`, PAS poussé)**. ⚠️ Périmètre AJUSTÉ vs l'idée initiale « fold operations→état » :
      un fold pur avec les NOMS est impossible aujourd'hui (journal incomplet — voir ci-dessous),
      donc l'étape 2 = extraire le calcul des **soldes** en TS (le vrai verrou, additif). Constat
      utile : `computeBalanceDetail` (`balance-detail.ts`) existait déjà et son net foyer == vue
      SQL `balances`. Fait : `src/lib/balances.ts` `computeBalances(participants, expenses,
beneficiaries)` = réplique de la vue (0006 : payé−dû ; un foyer par `household_id` distinct
      même sans dépense = net 0 ; TOUS les participants actifs+inactifs ; dépenses supprimées
      exclues via la liste fournie), réutilise `computeBalanceDetail`. `TripState.balances` →
      **`$derived`** de (participants, expenses, beneficiaries) : plus d'appel `getBalances`,
      section `'balances'` retirée du rechargement sélectif, soldes cohérents par construction.
      `getBalances`/vue SQL gardés en base (filet + pgTAP), juste plus appelés côté client. Tests :
      `balances.test.ts` (fixtures) + parité SQL prouvée sur données réelles par les E2E soldes
      existants (passent désormais par le calcul TS). Gates : svelte-check 0, eslint, Vitest
      26/26, Playwright 18/18.
      • **RAPPEL couverture du journal `operations` (vérifié 2026-08-08)** : `trip_participants`
      entièrement journalisé (trigger `trg_log_participants`, 0002 : insert/update/delete,
      snapshot complet) ; `expenses` journalisé sémantiquement par `save_expense`/`delete_expense`
      (`after={expense,beneficiaries}`) ; `settlements` = trigger mort (table droppée en 0006).
      **PAS journalisés** : les NOMS (`persons`, `households`) ni les réglages (`trips`: devise,
      nom) — updates directs sans trigger. → un fold `operations→état COMPLET (avec noms)` exige
      d'abord « journaliser tout » (persons/households/trips), chantier ultérieur.
    - **ÉTAPE 3a — cache lecture + affichage offline (écritures BLOQUÉES) — FAIT le
      2026-08-09 sur `offlinisation` (commit `1f305b1`, PAS poussé)**. Découpage : 3a = lecture
      seule offline (livré) ; 3b = écritures offline (adds/deletes) en file + re-synchro (à
      venir, le gros morceau). Contenu 3a : `src/lib/online.svelte.ts` (singleton réactif
      `online` = navigator.onLine + listeners, partagé layout/onglets) ; `src/lib/offline-cache.ts`
      (IndexedDB **sans dépendance**, un snapshot par séjour `{trip,participants,expenses,
beneficiaries,myPersonId,cachedAt}`, best-effort = toute erreur avalée) ; `TripState` :
      **write-through** après chaque `load()` réussi (via **`$state.snapshot`** — ⚠️ GOTCHA : les
      proxies runes ne sont PAS clonables par IndexedDB → sinon `put` échoue en silence, cache
      vide), lecture hors-ligne servie **directement** du cache si `!online.current` (sans
      attendre l'échec réseau, qui peut hang), repli cache aussi sur `BackendError` code
      `network`, flag `fromCache` ; **gardes `assertOnline`** sur TOUTES les mutations
      (upsert/remove expense, newParticipant, updateParticipant, renameHousehold, setActive,
      updateSettings) → lèvent `BackendError('network','Action indisponible hors-ligne.')` ;
      `+layout.svelte` bannière « Hors-ligne — les modifications sont désactivées » + re-tentative
      de démarrage à la reconnexion (effet, 1re exéc sautée). UI grisée hors-ligne : FAB dépense
      (`TripBottomNav.fabDisabled`), remboursements (Soldes), ajout/édition/actif-inactif
      participant, renommer foyer, réglages du séjour ; **l'arrondi (préférence d'appareil) reste
      actif**. Support `disabled` + style (`disabled:opacity-… disabled:pointer-events-none`)
      ajouté à `Fab`/`IconButton`/`Switch` (ils relayaient déjà `{...rest}`). Test
      `e2e/offline.spec.ts` (via `context.setOffline`). Gates : svelte-check 0, eslint, Vitest
      26/26, Playwright 19/19. ⚠️ **GOTCHA E2E/dev** : pas de SW en dev → naviguer hors-ligne
      vers une route **jamais visitée** échoue (chunk chargé en réseau → « 500 Internal Error »).
      En PROD le SW (étape 1) précache **tous** les nodes de route (vérifié : 11/11) → tous les
      onglets s'ouvrent hors-ligne, **pas besoin de précharger les onglets au démarrage**. En
      E2E on charge donc les onglets EN LIGNE avant de couper le réseau. ⚠️ Autre gotcha test :
      « Mes séjours » + session anonyme sont **par ORIGINE** → un preview sur un autre port
      (4173) = utilisateur vierge ; servir le preview sur le **même port que le dev (5173)** pour
      réutiliser localStorage+session (`npm run preview -- --port 5173`) ; penser à
      **désenregistrer l'ancien SW de dev** (DevTools ▸ Application ▸ Service Workers).
    - **ÉTAPE 3b — écritures offline (dépenses) — FAIT le 2026-08-09 sur `offlinisation`
      (commit `8811316`, PAS poussé)**. Bornée aux **dépenses** (create + delete + remboursement) ;
      **ajout de participant offline DIFFÉRÉ** (ids temporaires personne+foyer). Hors-ligne on peut
      ajouter/supprimer une dépense : appliqué en local aussitôt (soldes re-dérivés), **mis en file**,
      **rejoué** au retour en ligne. Contenu : `src/lib/outbox.svelte.ts` (file `createExpense`/
      `deleteExpense`, persistée IDB, **collapse** create+delete = jamais envoyée, **flush FIFO** :
      delete `expected_version:null` = delete-wins + idempotent « déjà supprimée/introuvable = résolu »,
      réseau→retry, non-réseau→op abandonnée + `lastError`) ; `offline-cache.ts` store `outbox`
      (**IDB v2**, clé unique) + `onblocked` géré ; `TripState` create optimiste (`previewSplit` +
      id **`local-…`**), delete optimiste/collapse, `persistSnapshot` partagé, `syncPending()` au
      retour en ligne, édition reste online ; `+layout.svelte` racine : **outbox HORS du chemin
      critique** de démarrage (⚠️ correctif : `await outbox.init()` avant `bootstrap()` pouvait
      **figer le démarrage** si IDB v1→v2 bloqué → mis en `.then()` après bootstrap + `onblocked`),
      bannière compteur « N en attente »/« Synchronisation… » ; trip layout : effet de synchro +
      FAB réactivé offline ; `ExpenseCard` : suppression réactivée offline, édition désactivée
      offline ET sur `local-*`, **tag « à synchroniser »** ; Soldes : remboursement réactivé offline.
      Tests : `e2e/offline-write.spec.ts` (create→sync, delete→sync, collapse) ; `e2e/offline.spec.ts`
      mis à jour (offline = lecture + adds/deletes ; modifications désactivées). ⚠️ **`outbox.svelte.ts`
      non couvert en Vitest** (runes `$state`/`$state.snapshot` → la config Vitest n'a pas le plugin
      Svelte) mais **exercé en E2E** (vrai navigateur). Seul angle mort E2E (dev sans SW) : la
      **persistance au reload complet hors-ligne** → à vérifier à la main sur le preview. Gates :
      svelte-check 0, eslint, Vitest 26/26, Playwright 21/21. ⚠️ GOTCHA env : **`sleep` en avant-plan
      est bloqué** (exit 144) ; et `pkill -f "vite preview"` **se tue lui-même** (son cmdline contient
      le motif) → utiliser un motif plus précis ou tuer par tâche.
    - **À AMÉLIORER — signalement des boutons désactivés hors-ligne (retour Pierre 2026-08-09)** :
      (1) la mise en **transparence** (`disabled:opacity-…` sur Fab/IconButton/Switch, cf. étape 3a)
      « ne marche pas très bien » → préférer un vrai **grisé** (couleur atténuée, pas juste
      l'opacité). (2) Idéalement le **tap/clic reste actif** mais **signale la désactivation**
      (message « indisponible hors-ligne ») au lieu d'un bouton mort `disabled` (qui n'émet aucun
      événement). Piste : remplacer `disabled` par un état « désactivé » stylé grisé + un handler
      qui affiche un toast/tooltip explicatif. À faire sur les contrôles d'écriture désactivés
      offline (édition, renommage, déplacement, actif/inactif, réglages).
    - **PROPOSITION DE FACTORISATION (préparée 2026-08-09 pour retour de Pierre)** — revue faite
      dans l'esprit du helper `offlineWrite` (`src/lib/offline-guard.ts`). Candidats classés :
      • ~~**#1** + **#2**~~ **FAITS le 2026-08-09 (commit `7ad65bd`)** : `ShareSheet.svelte`
      (`{open,onClose,title,subject,text,url,warning?}`, câblé sur les 2 partages de l'onglet
      Participants — ~90 lignes dédupliquées) + `src/lib/flash.svelte.ts` `createFlash(ms)`
      (« Enregistré ✓ » Réglages ; « Lien copié » dans ShareSheet). Comportement inchangé,
      E2E partage OK. **#3 reste À DISCUTER** (voir ci-dessous).
      • **2e round FAIT le 2026-08-10 (commit `babb756`)** : `src/lib/util.ts` `errMessage(e)`
      (remplace `e instanceof Error ? e.message : String(e)`, 16 occurrences/10 fichiers) +
      `src/lib/format.ts` `parseDecimalFr(input)` (virgule FR ; `centsFromEuros` + les 2 parsings
      de poids ExpenseForm/participants l'utilisent). **Reste mineur non fait** : `appUrl(query)`
      pour `${origin}${base}/?…` (2 sites `inviteLink`/`tripInviteLink` dans participants — gain
      faible) ; gardes SSR `typeof location/navigator` (contextuelles). #3 (helper de soumission
      de formulaire) **ABANDONNÉ par Pierre**.
      • **#1 (FAIT, cf. ci-dessus) — `ShareSheet.svelte`** : dans
      `t/[tripId]/participants/+page.svelte`, le **partage participant** et le **partage
      séjour** DUPLIQUENT ~60 lignes de logique (`canNativeShare`, `inviteLink`/`tripInviteLink`,
      `shareText/Subject/Body` + variantes trip, `mailtoHref`/`smsHref`, `nativeShare`,
      `copyLink`+flag `copied`/`tripCopied`+setTimeout) ET deux markups BottomSheet quasi
      identiques (boutons canaux natif/e-mail/sms/copier, `channelClass`). Proposé : composant
      `ShareSheet.svelte` props `{ open, onClose, subject, text, url, warning? }` qui encapsule
      canNativeShare + les 4 canaux (Web Share / mailto / sms / copier avec check) + l'encodage.
      Les deux partages deviennent `<ShareSheet .../>` (la page ne fournit que subject/text/url).
      **Bonus** : réutilisable pour la future rubrique « liens d'accès » (Réglages) + recovery
      bundle. Effort moyen, risque faible (comportement identique ; couvert par
      `e2e/participant-share.spec.ts` + `e2e/trip-join-link.spec.ts`). Sous-helper possible :
      `buildLink(query)` pour `${origin}${base}/?…` (token/join).
      • **#2 (petit, à faire au passage) — flash d'état transitoire** : motif `x=true;
setTimeout(()=>x=false,1500)` (réglages « Enregistré ✓ », `copied`×2). Les deux `copied`
      disparaissent avec ShareSheet ; reste « Enregistré ✓ ». Éventuel util `flash()`.
      • **#3 (moyen, À DISCUTER, ne PAS faire en 1er) — soumission de formulaire** :
      ExpenseForm/ReimbursementForm/réglages/participants partagent `saving`/`error` +
      try/catch/finally autour d'une mutation `tripState`. Un helper `runSubmit(fn)` réduirait le
      boilerplate, MAIS les formulaires diffèrent (validation/champs) → risque d'abstraction
      fuyante. À évaluer, pas prioritaire.
      • **Écarté** : wrapper des mutations `TripState` (`await backend.X(); await load([...])`) —
      chaque appel a ses sections/args, peu de gain de clarté.
      **Reco de démarrage** : #1 (ShareSheet) + #2 au passage ; #3 à trancher avec Pierre.
    - **ROBUSTESSE 3b — FAIT le 2026-08-10 (commit `66028e9`)** : (a) échecs de synchro
      **NON-réseau** (validation/permission) → l'outbox affiche un **toast** « Une modification
      n'a pas pu être synchronisée : … » (avant : abandon silencieux). (b) **Suppression offline
      d'une dépense déjà synchronisée reste AFFICHÉE** (grisée + médaillon « supprimé · à
      synchroniser ») jusqu'à la synchro, puis disparaît vraiment. L'ensemble « en attente de
      suppression » se **DÉRIVE de l'outbox** (`pendingDeleteIds`, `SvelteSet`) → aucun nouvel
      état persisté ; ces dépenses sortent des soldes/détails via `TripState.liveExpenses`
      (balances + `BalanceLedger`) ; boutons édition/suppression masqués dessus. Une dépense
      créée PUIS supprimée offline reste un **collapse** (disparaît). Gates : svelte-check 0,
      eslint, Vitest 26/26, Playwright 21/21.
    - **« JOURNALISER TOUT » — FAIT le 2026-08-10 (commit `b2515b8`, migration `0009`)**.
      Le journal `operations` est désormais COMPLET (prérequis event-sourcing) : trips (nom/
      devise), persons + households (noms) journalisés, en plus des participants (déjà) et des
      dépenses. **Approche A retenue** : `persons.trip_id` + `households.trip_id` (backfill via
      trip_participants, purge des orphelins, NOT NULL) → journalisation UNIFORME par trigger
      (`log_operation` rendu « trip-aware » : entité `trip` → l'id EST le séjour, sinon
      `trip_id`), triggers `trg_log_trips`/`trg_log_persons`/`trg_log_households` ;
      `create_trip`/`add_participant` renseignent `trip_id` ; `setParticipantHousehold`
      (db.ts+interface+TripState) passe `trip_id` à l'insert direct de foyer. Fait aussi avancer
      **« foyers first-class »** (households a maintenant trip_id). Tests : `journal.test.sql` +
      4 pgTAP réordonnés (trips avant persons/households) + seed.sql. Gates : svelte-check 0,
      eslint, Vitest 26/26, pgTAP 43/43, Playwright 21/21. **« migration ok » confirmé par Pierre
      le 2026-08-10.** ⚠️ Déploiement : `supabase db push` AVANT le déploiement prod (le nouveau
      frontend a besoin de `trip_id` côté cloud) ; ne PAS db push tant que la prod tourne l'ancien
      frontend (l'insert de foyer sans trip_id casserait « déplacer vers un nouveau foyer »).
    - **EVENT SOURCING — FOLD (Degré 1) FAIT le 2026-08-10 (commit `b050c97`, sur main)** :
      `src/lib/fold.ts` `foldTrip(operations) → {trip,participants,expenses,beneficiaries}`, PUR,
      validé **identique aux tables** (E2E `fold-parity.spec.ts`, via `window.__backend` exposé en
      DEV) + Vitest `fold.test.ts`. Rejeu par `id` croissant, maps par entité (dernier gagne,
      delete=tombstone), participants enrichis des NOMS (grâce à 0009). **Modèle de lecture
      PARALLÈLE** : rien branché dans `TripState` (tables = vérité). **RESTE pour l'event sourcing
      complet** : (2) **bootstrap** des séjours pré-0009 (semer le log avec l'état courant, sinon
      fold incomplet) ; (3) **inverser la LECTURE** (dériver du fold : offline/undo) ; (4)
      **inverser l'ÉCRITURE** (append d'événements + projecteur = Degré 2, la vraie indépendance
      Postgres — le fold TS pur pourra tourner en edge function pour validation/snapshots). Undo
      par compensation devient trivial une fois (3) posé. Cf. discussion « indépendance Postgres /
      validation à l'append / snapshots » (2026-08-10).
    - **UNDO v1 — FAIT le 2026-08-10 (commit `80368e3`, sur main)** : « défaire » une opération
      de **dépense** = appliquer son inverse via les RPC existants (`save_expense`/`delete_expense`)
      → re-journalisé, **sans migration**. `src/lib/undo.ts` (pur) : `inverseExpenseOp`
      (create→delete ; update→restaure le before, même id + verrou ; delete→re-création nouvel id) ;
      `isUndoable` = op de dépense **ET dernière de son entité** (règle « pile par entité », décidée
      avec Pierre : on ne défait que le dernier changement d'une dépense → zéro écrasement ; pas de
      rembobinage global qui défairait des actions indépendantes). `TripState.undoOperation` (online
      only v1). UI = bouton « Défaire » dans le détail déplié d'une op (page Journal), grisé
      offline. Tests Vitest + E2E. **Suites v2** : renommages/réglages (inverse = setter+before,
      simple), restauration **même-id** (un-soft-delete), **redo**, undo **offline**
      (create-undo=delete & delete-undo=create sont compatibles offline).
    - **ÉTAT OFFLINISATION au 2026-08-10** : étapes 1→3b + polish boutons + factorisations +
      « journaliser tout »
      (ShareSheet/flash/offlineWrite/errMessage/parseDecimalFr) + robustesse 3b, sur la branche
      `offlinisation`. Commits : `9776323`(1) `3d5408a`(2) `1f305b1`(3a) `8811316`(3b)
      `7ea3e8d`(polish) `7ad65bd`(ShareSheet/flash) `babb756`(errMessage/parseDecimalFr)
      `66028e9`(robustesse 3b) `b2515b8`(journaliser tout / migration 0009) ; + `0cd5d0e`
      (remboursement). **DÉPLOYÉ le 2026-08-10** (Pierre) : branche `offlinisation` mergée sur
      `main` + `production`, **migration `0009` appliquée au cloud** (`supabase db push`). Tout le
      chantier offline (1→3b + polish + factorisations + « journaliser tout ») est **EN LIGNE**.
      **3c (ajout participant offline) ABANDONNÉ**. Reste possible côté offline/event-sourcing :
      **undo par compensation** (indépendant, livrable maintenant) ; **bascule event-sourcing**
      complète (le journal est désormais complet → fold `operations → état` possible).
- ~~**Déploiement GitHub Pages** + **Supabase cloud**~~ **FAIT le 2026-07-30** :
  en ligne sur **https://matafou.github.io/radasses/**. Déploiement depuis la
  branche **`production`** (`git push origin main:production` ; `main` = tronc de
  travail), workflow `.github/workflows/deploy.yml` (BASE_PATH=/radasses, secrets
  `PUBLIC_SUPABASE_*`, copie 404.html→index.html). Migrations poussées sur le
  cloud, anonymous sign-ins activés, CAPTCHA laissé OFF (incompatible avec le
  sign-in silencieux). Gotcha résolu : `gen_random_bytes` (pgcrypto) échouait sur
  le cloud → jeton via `gen_random_uuid()`.
- **Suivi post-déploiement (petits bugs à corriger)** :
  - **« JWT issued at future » après reload sur longue inactivité (signalé Pierre
    2026-08-09, PRÉEXISTANT au chantier offline)** : sur certaines pages, un `reload`
    après une longue inactivité déclenche un rejet du token (iat dans le futur) =
    **décalage d'horloge** client/serveur (GoTrue/PostgREST refusent un JWT dont `iat`
    est postérieur à l'heure du validateur ; le refresh régénère un token vu comme
    « émis dans le futur »). Piste : tolérance d'horloge / re-refresh, ou traiter ce cas
    comme une session à réparer (cf. `repairOrphanedSession` / `withSessionRepair`) —
    détecter le code d'erreur GoTrue correspondant et forcer un refresh/reload. À
    investiguer (reproduire : laisser l'onglet inactif longtemps puis recharger).
  - ~~**Favicon**~~ **FAIT le 2026-07-30** : favicon PNG 256px dans `static/`,
    `<link rel="icon" href="%sveltekit.assets%/favicon.png">` dans `app.html`
    (statique → présent au parsing → stoppe le sondage `/favicon.ico` ; URL
    `/radasses/favicon.png` base-correcte à toute profondeur). Original 1254px
    gardé en `src/lib/assets/favicon-source.png`.
  - **Workflow Actions** : avertissement « Node.js 20 déprécié » → bumper
    `actions/checkout`, `actions/setup-node`, `actions/upload-pages-artifact`
    vers leurs majeurs récents (v5) ciblant Node 24. Non bloquant.
- ~~**Cron keep-alive Supabase**~~ **FAIT le 2026-07-30** :
  `.github/workflows/keep-alive.yml` — 3 GET tous les 3 jours (`cron: '0 6 */3 * *'`)
  - `workflow_dispatch`, secrets `PUBLIC_SUPABASE_*`. Échoue (→ notif) si aucune
    requête n'aboutit. **Endpoint = `/auth/v1/settings`** (200 avec la SEULE clé
    anon, sans session). Gotchas rencontrés : côté cloud `/rest/v1/` exige une
    session (401 même avec `Authorization: Bearer <anon>`), et `/auth/v1/health`
    n'existe pas (404) ; seul `/auth/v1/settings` répond 200 sans session.
    ⚠️ Crons GitHub : uniquement depuis la branche par défaut (main), désactivés
    après 60 j sans activité sur le repo. ⚠️ Toujours « Run workflow » (pas
    « Re-run jobs » qui rejoue l'ancien commit).

**Fait dans la session du 2026-07-29 (sur `main`) :** bouton Créer(vert)/Modifier
(ambre) + repli ; **écran de dépense dédié** (FAB « + » au-dessus de l'onglet
Dépenses + bottom-sheet dans le layout, masquer=garder la saisie / « Reprendre ») ;
**mini-formulaire de remboursement** (suggestions + « + signaler un remboursement »)
= dépense à 1 bénéficiaire ; onglet **Soldes** en deux demi-sections scrollables ;
**refonte mise en page = shell flex pleine hauteur** (fin des `calc` magiques, nav
dans le flux) + **barre du haut du séjour** (retour ← / titre / roue crantée) ;
boutons à icônes (crayon/poubelle) ; Participants : statut en interrupteur + bouton
« + » vert rond.
