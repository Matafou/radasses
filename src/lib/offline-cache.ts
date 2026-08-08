import type { Trip, Participant, Expense, Beneficiary } from '$lib/backend';

// Cache local (IndexedDB) du dernier état connu d'un séjour, pour l'AFFICHER hors-ligne
// (lecture seule en étape 3a). Écrit en « write-through » après chaque chargement réseau
// réussi, relu quand le réseau manque. Sans dépendance ; toute erreur IndexedDB est
// avalée (le cache est un bonus, jamais un point de défaillance).

/** Instantané complet d'un séjour (les soldes ne sont pas stockés : re-dérivés en TS). */
export type TripSnapshot = {
	trip: Trip | null;
	participants: Participant[];
	expenses: Expense[];
	beneficiaries: Beneficiary[];
	myPersonId: string | null;
	cachedAt: number;
};

const DB_NAME = 'radasses';
const STORE = 'trips';
const VERSION = 1;

function hasIDB(): boolean {
	return typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/** Persiste l'instantané d'un séjour (clé = tripId). No-op silencieux en cas d'échec. */
export async function saveTripSnapshot(
	tripId: string,
	snapshot: Omit<TripSnapshot, 'cachedAt'>
): Promise<void> {
	if (!hasIDB()) return;
	try {
		const db = await openDB();
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, 'readwrite');
			tx.objectStore(STORE).put({ ...snapshot, cachedAt: Date.now() }, tripId);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		});
		db.close();
	} catch {
		// cache best-effort : on ignore
	}
}

/** Lit l'instantané d'un séjour, ou `null` s'il n'y en a pas (ou en cas d'échec). */
export async function loadTripSnapshot(tripId: string): Promise<TripSnapshot | null> {
	if (!hasIDB()) return null;
	try {
		const db = await openDB();
		const snap = await new Promise<TripSnapshot | null>((resolve, reject) => {
			const tx = db.transaction(STORE, 'readonly');
			const req = tx.objectStore(STORE).get(tripId);
			req.onsuccess = () => resolve((req.result as TripSnapshot) ?? null);
			req.onerror = () => reject(req.error);
		});
		db.close();
		return snap;
	} catch {
		return null;
	}
}
