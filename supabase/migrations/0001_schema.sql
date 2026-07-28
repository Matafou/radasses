-- =====================================================================
--  Radasses — Schéma initial
--  Suivi de dépenses entre amis, par séjour, avec règlements foyer-à-foyer
--  et journal d'opérations append-only.
-- =====================================================================

create extension if not exists pgcrypto;  -- gen_random_bytes / gen_random_uuid

-- ---------------------------------------------------------------------
--  Identité globale (réutilisable d'un séjour à l'autre)
-- ---------------------------------------------------------------------

-- Un « foyer » = unité économique qui partage un compte commun.
-- C'est à ce niveau que se calculent les remboursements.
-- Une personne seule est un foyer d'une personne.
create table households (
	id         uuid primary key default gen_random_uuid(),
	name       text not null,
	created_at timestamptz not null default now()
);

-- Une personne = un participant distinct (enfants compris).
-- Peut avoir une session de connexion... ou pas (les enfants n'en ont pas).
create table persons (
	id         uuid primary key default gen_random_uuid(),
	name       text not null,
	created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Séjours
-- ---------------------------------------------------------------------

create table trips (
	id         uuid primary key default gen_random_uuid(),
	name       text not null,
	currency   text not null default 'EUR',
	created_at timestamptz not null default now()
);

-- Participation d'une personne à un séjour.
-- C'est ici que se joue le rattachement à un foyer POUR CE séjour
-- (la composition d'un foyer peut donc varier d'un séjour à l'autre).
-- `invite_token` : secret présent dans l'URL, identifie ce participant.
-- `default_percent` : part par défaut de ce participant dans les dépenses.
create table trip_participants (
	id              uuid primary key default gen_random_uuid(),
	trip_id         uuid not null references trips(id) on delete cascade,
	person_id       uuid not null references persons(id) on delete restrict,
	household_id    uuid not null references households(id) on delete restrict,
	default_percent numeric(6,3) not null default 0 check (default_percent >= 0),
	invite_token    text not null unique default encode(gen_random_bytes(16), 'hex'),
	created_at      timestamptz not null default now(),
	unique (trip_id, person_id)
);

-- Rattachement d'une session (utilisateur d'auth, éventuellement anonyme)
-- à un participant. Plusieurs sessions -> un même participant (tél + PC).
create table participant_access (
	trip_participant_id uuid not null references trip_participants(id) on delete cascade,
	auth_user_id        uuid not null references auth.users(id) on delete cascade,
	created_at          timestamptz not null default now(),
	primary key (trip_participant_id, auth_user_id)
);

-- ---------------------------------------------------------------------
--  Dépenses
-- ---------------------------------------------------------------------

-- Montants TOUJOURS en centimes entiers (jamais de flottant).
-- Le payeur doit être un participant du séjour (FK composite ci-dessous).
create table expenses (
	id                uuid primary key default gen_random_uuid(),
	trip_id           uuid not null references trips(id) on delete cascade,
	description       text not null default '',
	category          text,
	amount_cents      bigint not null check (amount_cents >= 0),
	spent_on          date not null default current_date,
	paid_by_person_id uuid not null,
	created_at        timestamptz not null default now(),
	created_by        uuid references auth.users(id),
	deleted_at        timestamptz,
	-- garantit que le payeur participe bien à ce séjour
	foreign key (trip_id, paid_by_person_id)
		references trip_participants (trip_id, person_id) on delete restrict
);

-- Répartition d'une dépense entre bénéficiaires (des participants).
--  - is_locked = true  : montant fixé manuellement, invariable tant qu'on
--                        ne le « relâche » pas ;
--  - is_locked = false : part proportionnelle (`percent`), absorbe le reste.
-- Règle applicative : il doit toujours rester >= 1 bénéficiaire non verrouillé
-- (le « tampon » qui garantit que la somme fait le total de la dépense).
-- `trip_id` est rempli automatiquement (trigger) pour la FK composite + RLS.
create table expense_beneficiaries (
	id           uuid primary key default gen_random_uuid(),
	expense_id   uuid not null references expenses(id) on delete cascade,
	trip_id      uuid not null,
	person_id    uuid not null,
	is_locked    boolean not null default false,
	percent      numeric(6,3) check (percent is null or percent >= 0),
	amount_cents bigint not null default 0 check (amount_cents >= 0),
	unique (expense_id, person_id),
	-- garantit que le bénéficiaire participe bien à ce séjour
	foreign key (trip_id, person_id)
		references trip_participants (trip_id, person_id) on delete restrict
);

-- ---------------------------------------------------------------------
--  Règlements (remboursements de foyer à foyer)
-- ---------------------------------------------------------------------

create table settlements (
	id                uuid primary key default gen_random_uuid(),
	trip_id           uuid references trips(id) on delete cascade, -- null = inter-séjours (futur)
	from_household_id uuid not null references households(id) on delete restrict,
	to_household_id   uuid not null references households(id) on delete restrict,
	amount_cents      bigint not null check (amount_cents > 0),
	settled_on        date not null default current_date,
	note              text,
	created_at        timestamptz not null default now(),
	created_by        uuid references auth.users(id),
	deleted_at        timestamptz,
	check (from_household_id <> to_household_id)
);

-- ---------------------------------------------------------------------
--  Journal d'opérations — APPEND ONLY (aucun update/delete autorisé)
-- ---------------------------------------------------------------------

create table operations (
	id                 bigint generated always as identity primary key,
	trip_id            uuid not null references trips(id) on delete cascade,
	actor_auth_user_id uuid references auth.users(id),
	entity_type        text not null,   -- 'expense' | 'settlement' | 'participant'
	entity_id          uuid,
	action             text not null check (action in ('create', 'update', 'delete')),
	before             jsonb,
	after              jsonb,
	created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Index utiles
-- ---------------------------------------------------------------------

create index on trip_participants (trip_id);
create index on trip_participants (person_id);
create index on trip_participants (household_id);
create index on participant_access (auth_user_id);
create index on expenses (trip_id);
create index on expense_beneficiaries (expense_id);
create index on expense_beneficiaries (trip_id);
create index on settlements (trip_id);
create index on operations (trip_id, created_at);
