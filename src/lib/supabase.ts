import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
	// L'appli se charge quand même, mais toute requête échouera tant que
	// le `.env` n'est pas rempli (voir .env.example).
	console.warn(
		'[supabase] Non configuré : renseigne PUBLIC_SUPABASE_URL et PUBLIC_SUPABASE_ANON_KEY dans .env'
	);
}

// Client unique côté navigateur. `persistSession` garde la session (anonyme
// ou non) dans le localStorage → l'utilisateur reste identifié sur cet appareil.
export const supabase = createClient(
	PUBLIC_SUPABASE_URL || 'http://localhost:54321',
	PUBLIC_SUPABASE_ANON_KEY || 'anon-key-manquante',
	{
		auth: { persistSession: true, autoRefreshToken: true }
	}
);
