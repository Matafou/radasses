import { browser } from '$app/environment';

/** Séjours connus de CE navigateur (commodité d'accueil ; la vérité est côté serveur). */
export type KnownTrip = { id: string; name: string };

const KEY = 'radasses.trips';

export function getKnownTrips(): KnownTrip[] {
	if (!browser) return [];
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '[]');
	} catch {
		return [];
	}
}

export function rememberTrip(t: KnownTrip): void {
	if (!browser) return;
	const all = getKnownTrips().filter((x) => x.id !== t.id);
	all.unshift(t);
	localStorage.setItem(KEY, JSON.stringify(all));
}

export function forgetTrip(id: string): void {
	if (!browser) return;
	localStorage.setItem(KEY, JSON.stringify(getKnownTrips().filter((x) => x.id !== id)));
}
