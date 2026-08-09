// Petit message transitoire (toast), affiché en bas de l'écran. Sert notamment à
// signaler qu'une action est indisponible hors-ligne tout en gardant le bouton
// « cliquable » (contrairement à un `disabled` muet). Singleton réactif (runes).
class Toast {
	message = $state<string | null>(null);
	private timer: ReturnType<typeof setTimeout> | undefined;

	show(message: string, ms = 2500) {
		this.message = message;
		clearTimeout(this.timer);
		this.timer = setTimeout(() => (this.message = null), ms);
	}
}

export const toast = new Toast();
