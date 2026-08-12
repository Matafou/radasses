-- =====================================================================
--  Radasses — 0010 : retirer la capacité DELETE sur trip_participants
--
--  Audit du 2026-08-12 : 0002 accordait `grant ... delete on trip_participants`
--  + une policy `tp_delete` permissive (`using (is_trip_member(trip_id))`) —
--  n'importe quel membre d'un séjour pouvait donc supprimer la ligne
--  trip_participants d'un AUTRE membre (tant qu'aucune dépense ne le
--  référençait encore, à cause du FK `on delete restrict`), révoquant son
--  accès via la cascade sur `participant_access`. Rien dans l'app n'utilise
--  cette capacité (seul `setParticipantActive`, un UPDATE, existe côté
--  produit) ; `docs/BACKLOG.md` supposait même qu'elle n'existait pas
--  (section « SUPPRESSION DE PARTICIPANT »). On la retire : « supprimer un
--  participant » reste un chantier à part, avec la garde « jamais référencé,
--  même par une dépense supprimée du journal » déjà réfléchie dans le backlog.
-- =====================================================================

drop policy if exists tp_delete on trip_participants;
revoke delete on trip_participants from authenticated;
