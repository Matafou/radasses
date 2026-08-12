#!/usr/bin/env bash
# Régénère src/lib/backend/supabase/database.types.ts depuis le schéma de la
# Supabase LOCALE (prérequis : `npx supabase start`, migrations à jour via
# `npx supabase migration up`). À relancer après toute migration touchant le
# schéma public (tables/vues/fonctions).
#
#   npm run gen:db-types
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
OUT="src/lib/backend/supabase/database.types.ts"

{
	echo "// Généré par \`npm run gen:db-types\` (supabase gen types typescript --local) — NE PAS ÉDITER À LA MAIN."
	echo "// Regénérer après chaque migration touchant le schéma public (tables/vues/fonctions)."
	echo
	npx supabase gen types typescript --local
} > "$OUT"

npx prettier --write "$OUT"
