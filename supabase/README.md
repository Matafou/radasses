# Base de données (Supabase)

Le schéma vit dans `migrations/`, dans l'ordre :

1. `0001_schema.sql` — tables, contraintes, index
2. `0002_policies.sql` — fonctions d'accès, RPC, triggers de journalisation, RLS

## Appliquer les migrations

Quand le projet Supabase existera, deux façons :

**Option simple (interface web)** — copier/coller le contenu de chaque fichier,
dans l'ordre, dans le _SQL Editor_ du dashboard Supabase, et exécuter.

**Option CLI** (plus tard, si tu installes la CLI Supabase) :

```bash
supabase link --project-ref <ref>
supabase db push
```

## Réglage indispensable : autoriser les sessions anonymes

L'identification par lien repose sur les **sessions anonymes**. À activer une fois :

> Dashboard → **Authentication → Sign In / Providers → Anonymous sign-ins → Enable**

Sans ça, `signInAnonymously()` échoue et personne ne peut se connecter.

## Récupérer les clés pour le front

> Dashboard → **Settings → API**

- `Project URL`  → `PUBLIC_SUPABASE_URL` (dans `.env`)
- `anon public`  → `PUBLIC_SUPABASE_ANON_KEY` (dans `.env`)

Ces deux valeurs sont publiques par conception : la sécurité est assurée par les
Row Level Security policies, pas par le secret de la clé.

## Modèle d'accès en bref

- Un utilisateur (anonyme) a accès à un séjour s'il a une ligne
  `participant_access` vers un participant de ce séjour.
- On crée un séjour via la RPC `create_trip(...)` (renvoie un lien/jeton).
- On rejoint via `redeem_token(<jeton de l'URL>)`.
- Le journal `operations` est alimenté automatiquement par des triggers et
  n'accepte aucune écriture ni modification directe (append only).
