import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from './database.types';

if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
	// Échec bruyant : sans ces variables, TOUTE requête échouerait de toute
	// façon. Mieux vaut planter tout de suite avec un message clair (config
	// oubliée) qu'un repli silencieux sur localhost qui masque le problème
	// en prod. En dev : remplir `.env` (voir .env.example) ; en CI : les
	// secrets `PUBLIC_SUPABASE_*` du workflow.
	throw new Error(
		'Configuration Supabase manquante : renseigne PUBLIC_SUPABASE_URL et ' +
			'PUBLIC_SUPABASE_ANON_KEY (.env en dev, secrets du workflow en CI). Voir .env.example.'
	);
}

// Client unique côté navigateur. `persistSession` garde la session (anonyme
// ou non) dans le localStorage → l'utilisateur reste identifié sur cet appareil.
// Interne à l'adaptateur : le reste de l'app passe par `$lib/backend`.
export const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
	auth: { persistSession: true, autoRefreshToken: true }
});
