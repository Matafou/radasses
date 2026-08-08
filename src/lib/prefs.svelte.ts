// Préférences d'AFFICHAGE, propres à l'APPAREIL (localStorage, communes à tous les
// séjours) — pas de backend, pas de partage entre membres. Réactif (runes) : toute
// vue qui lit `prefs.xxx` se met à jour quand on change la valeur (ex. depuis Réglages).

const KEY = 'radasses.prefs';

type Stored = { roundAmounts: boolean };

const DEFAULTS: Stored = {
	// Arrondir soldes et remboursements à l'entier le plus proche (montant exact
	// révélé au survol / à l'appui). Activé par défaut.
	roundAmounts: true
};

function read(): Stored {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		return { roundAmounts: raw.roundAmounts ?? DEFAULTS.roundAmounts };
	} catch {
		return { ...DEFAULTS };
	}
}

class Prefs {
	roundAmounts = $state(read().roundAmounts);

	setRoundAmounts(v: boolean) {
		this.roundAmounts = v;
		this.#persist();
	}

	#persist() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(KEY, JSON.stringify({ roundAmounts: this.roundAmounts } satisfies Stored));
	}
}

/** Singleton partagé (préférences appareil). */
export const prefs = new Prefs();
