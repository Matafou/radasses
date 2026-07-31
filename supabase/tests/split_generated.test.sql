-- FICHIER GÉNÉRÉ — ne pas éditer à la main.
-- Source : src/lib/split.cases.ts · Régénérer : npm run gen:split-sql
-- Vérifie que compute_split (SQL) donne les mêmes résultats que previewSplit (TS).

begin;
create extension if not exists pgtap;
select plan(9);

-- parts égales 10c / 3 → plus grands restes (4,3,3)
select is(
  (select jsonb_object_agg(v->>'person_id', (v->>'amount_cents')::int)
   from jsonb_array_elements(compute_split(10, '[{"person_id":"00000000-0000-0000-0000-00000000000a"},{"person_id":"00000000-0000-0000-0000-00000000000b"},{"person_id":"00000000-0000-0000-0000-00000000000c"}]'::jsonb)) v),
  '{"00000000-0000-0000-0000-00000000000a":4,"00000000-0000-0000-0000-00000000000b":3,"00000000-0000-0000-0000-00000000000c":3}'::jsonb,
  'parts égales 10c / 3 → plus grands restes (4,3,3)'
);

-- parts égales 100c / 3 → (34,33,33)
select is(
  (select jsonb_object_agg(v->>'person_id', (v->>'amount_cents')::int)
   from jsonb_array_elements(compute_split(100, '[{"person_id":"00000000-0000-0000-0000-00000000000a"},{"person_id":"00000000-0000-0000-0000-00000000000b"},{"person_id":"00000000-0000-0000-0000-00000000000c"}]'::jsonb)) v),
  '{"00000000-0000-0000-0000-00000000000a":34,"00000000-0000-0000-0000-00000000000b":33,"00000000-0000-0000-0000-00000000000c":33}'::jsonb,
  'parts égales 100c / 3 → (34,33,33)'
);

-- parts égales 1001c / 2 → départage par person_id (501,500)
select is(
  (select jsonb_object_agg(v->>'person_id', (v->>'amount_cents')::int)
   from jsonb_array_elements(compute_split(1001, '[{"person_id":"00000000-0000-0000-0000-00000000000a"},{"person_id":"00000000-0000-0000-0000-00000000000b"}]'::jsonb)) v),
  '{"00000000-0000-0000-0000-00000000000a":501,"00000000-0000-0000-0000-00000000000b":500}'::jsonb,
  'parts égales 1001c / 2 → départage par person_id (501,500)'
);

-- poids 50/30/20 sur 100,00 €
select is(
  (select jsonb_object_agg(v->>'person_id', (v->>'amount_cents')::int)
   from jsonb_array_elements(compute_split(10000, '[{"person_id":"00000000-0000-0000-0000-00000000000a","weight":50},{"person_id":"00000000-0000-0000-0000-00000000000b","weight":30},{"person_id":"00000000-0000-0000-0000-00000000000c","weight":20}]'::jsonb)) v),
  '{"00000000-0000-0000-0000-00000000000a":5000,"00000000-0000-0000-0000-00000000000b":3000,"00000000-0000-0000-0000-00000000000c":2000}'::jsonb,
  'poids 50/30/20 sur 100,00 €'
);

-- montant verrouillé conservé + reste partagé
select is(
  (select jsonb_object_agg(v->>'person_id', (v->>'amount_cents')::int)
   from jsonb_array_elements(compute_split(5000, '[{"person_id":"00000000-0000-0000-0000-00000000000a","is_locked":true,"amount_cents":2000},{"person_id":"00000000-0000-0000-0000-00000000000b"},{"person_id":"00000000-0000-0000-0000-00000000000c"}]'::jsonb)) v),
  '{"00000000-0000-0000-0000-00000000000a":2000,"00000000-0000-0000-0000-00000000000b":1500,"00000000-0000-0000-0000-00000000000c":1500}'::jsonb,
  'montant verrouillé conservé + reste partagé'
);

-- un seul bénéficiaire reçoit tout (remboursement)
select is(
  (select jsonb_object_agg(v->>'person_id', (v->>'amount_cents')::int)
   from jsonb_array_elements(compute_split(3000, '[{"person_id":"00000000-0000-0000-0000-00000000000c"}]'::jsonb)) v),
  '{"00000000-0000-0000-0000-00000000000c":3000}'::jsonb,
  'un seul bénéficiaire reçoit tout (remboursement)'
);

-- rejet : tout verrouillé (aucun tampon)
select throws_ok(
  $$ select compute_split(10000, '[{"person_id":"00000000-0000-0000-0000-00000000000a","is_locked":true,"amount_cents":5000},{"person_id":"00000000-0000-0000-0000-00000000000b","is_locked":true,"amount_cents":5000}]'::jsonb) $$,
  'P0001', NULL, 'rejet : tout verrouillé (aucun tampon)'
);

-- rejet : verrouillés > total
select throws_ok(
  $$ select compute_split(1000, '[{"person_id":"00000000-0000-0000-0000-00000000000a","is_locked":true,"amount_cents":5000},{"person_id":"00000000-0000-0000-0000-00000000000b"}]'::jsonb) $$,
  'P0001', NULL, 'rejet : verrouillés > total'
);

-- rejet : mélange de poids (un avec, un sans)
select throws_ok(
  $$ select compute_split(10000, '[{"person_id":"00000000-0000-0000-0000-00000000000a","weight":50},{"person_id":"00000000-0000-0000-0000-00000000000b"}]'::jsonb) $$,
  'P0001', NULL, 'rejet : mélange de poids (un avec, un sans)'
);

select * from finish();
rollback;
