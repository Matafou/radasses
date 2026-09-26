import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
	connectFirestoreEmulator,
	initializeFirestore,
	memoryLocalCache
} from 'firebase/firestore';
import { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_PROJECT_ID } from '$env/static/public';

if (!PUBLIC_FIREBASE_API_KEY || !PUBLIC_FIREBASE_PROJECT_ID) {
	// Échec bruyant : sans ces variables, TOUTE requête échouerait de toute façon.
	// En dev : remplir `.env` (voir .env.example) ; en CI : les secrets du workflow.
	throw new Error(
		'Configuration Firebase manquante : renseigne PUBLIC_FIREBASE_API_KEY et ' +
			'PUBLIC_FIREBASE_PROJECT_ID (.env en dev, secrets du workflow en CI). Voir .env.example.'
	);
}

/**
 * Un projet `demo-…` n'existe pas dans le cloud : par convention Firebase, il ne sert
 * qu'avec les ÉMULATEURS locaux (`npm run emulators`). C'est ce qui distingue le dev
 * local de la prod, sans variable supplémentaire.
 */
export const useEmulators = PUBLIC_FIREBASE_PROJECT_ID.startsWith('demo-');

const app = initializeApp({
	apiKey: PUBLIC_FIREBASE_API_KEY,
	projectId: PUBLIC_FIREBASE_PROJECT_ID,
	authDomain: `${PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`
});

// Auth : la session (anonyme ou non) est persistée par le SDK dans IndexedDB →
// l'utilisateur reste identifié sur cet appareil.
export const auth = getAuth(app);

// Firestore en cache MÉMOIRE : la couche hors-ligne reste celle de l'app (cache
// IndexedDB des séjours + outbox), indépendante du fournisseur.
// `ignoreUndefinedProperties` : les champs optionnels absents ne sont pas écrits.
export const db = initializeFirestore(app, {
	localCache: memoryLocalCache(),
	ignoreUndefinedProperties: true
});

if (useEmulators) {
	connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
	connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
