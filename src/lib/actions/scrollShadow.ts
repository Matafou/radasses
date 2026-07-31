import type { Action } from 'svelte/action';

/**
 * Signale la scrollabilité horizontale d'un conteneur : estompe (masque) le bord
 * gauche et/ou droit selon qu'il reste du contenu à faire défiler de ce côté.
 * Aucun estompage si tout tient (pas de faux signal). Le paramètre (ex. le
 * contenu) déclenche un recalcul quand il change.
 */
export const scrollShadow: Action<HTMLElement, unknown> = (node) => {
	const fade = '1.5rem';

	function update() {
		const atStart = node.scrollLeft <= 1;
		const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
		const left = atStart ? 'black 0' : `transparent 0, black ${fade}`;
		const right = atEnd ? 'black 100%' : `black calc(100% - ${fade}), transparent 100%`;
		const gradient = `linear-gradient(to right, ${left}, ${right})`;
		node.style.setProperty('mask-image', gradient);
		node.style.setProperty('-webkit-mask-image', gradient);
	}

	update();
	node.addEventListener('scroll', update, { passive: true });
	const ro = new ResizeObserver(update);
	ro.observe(node);

	return {
		update,
		destroy() {
			node.removeEventListener('scroll', update);
			ro.disconnect();
		}
	};
};
