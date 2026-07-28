-- =====================================================================
--  Statut « présent / parti » d'un participant (partagé).
--  active = true  : participe encore -> coché par « tout le foyer / tout le monde »
--  active = false : « parti » -> exclu de l'auto-sélection (badge « (parti) »),
--                   mais toujours assignable manuellement (dépenses passées).
--  N'affecte ni le calcul de répartition ni les soldes.
-- =====================================================================

alter table trip_participants
	add column if not exists active boolean not null default true;
