// État de connexion partagé (réactif, runes). Singleton : lu par le layout (bannière,
// re-tentative de démarrage) et par les onglets pour désactiver les écritures hors-ligne.
// `navigator.onLine` = heuristique du navigateur (vrai = « peut-être en ligne ») ; le
// vrai juge d'un échec réseau reste `BackendError` code `network`, mais `onLine` suffit
// à griser l'UI de façon réactive.
class OnlineState {
	current = $state(true);

	constructor() {
		if (typeof navigator !== 'undefined') this.current = navigator.onLine;
		if (typeof window !== 'undefined') {
			window.addEventListener('online', () => (this.current = true));
			window.addEventListener('offline', () => (this.current = false));
		}
	}
}

export const online = new OnlineState();
