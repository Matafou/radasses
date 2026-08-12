// Préférences d'AFFICHAGE, propres à l'APPAREIL (localStorage, communes à tous les
// séjours) — pas de backend, pas de partage entre membres. Réactif (runes) : toute
// vue qui lit `prefs.xxx` se met à jour quand on change la valeur (ex. depuis Réglages).

const KEY = 'radasses.prefs';

type Stored = { roundAmounts: boolean; hideBelowCents: number };

const DEFAULTS: Stored = {
	// Arrondir soldes et remboursements à l'entier le plus proche (montant exact
	// révélé au survol / à l'appui). Activé par défaut.
	roundAmounts: true,
	// Masquer les soldes / remboursements dont |montant| est sous ce seuil (en
	// centimes ; 0 = tout afficher). Défaut : 1 €.
	hideBelowCents: 100
};

function read(): Stored {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		return {
			roundAmounts: raw.roundAmounts ?? DEFAULTS.roundAmounts,
			hideBelowCents:
				typeof raw.hideBelowCents === 'number' && raw.hideBelowCents >= 0
					? raw.hideBelowCents
					: DEFAULTS.hideBelowCents
		};
	} catch {
		return { ...DEFAULTS };
	}
}

class Prefs {
	roundAmounts = $state(read().roundAmounts);
	hideBelowCents = $state(read().hideBelowCents);

	setRoundAmounts(v: boolean) {
		this.roundAmounts = v;
		this.#persist();
	}

	setHideBelowCents(v: number) {
		this.hideBelowCents = Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
		this.#persist();
	}

	#persist() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(
			KEY,
			JSON.stringify({
				roundAmounts: this.roundAmounts,
				hideBelowCents: this.hideBelowCents
			} satisfies Stored)
		);
	}
}

/** Singleton partagé (préférences appareil). */
export const prefs = new Prefs();
