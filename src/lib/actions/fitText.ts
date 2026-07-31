import type { Action } from 'svelte/action';

/**
 * Réduit la taille de police du nœud (jusqu'à un minimum) pour que son texte
 * tienne sur une ligne dans la largeur disponible. Le nœud doit être en
 * `truncate` (overflow caché) : si même au minimum ça déborde, l'ellipsis prend
 * le relais. Le paramètre (ex. le titre) déclenche un recalcul quand il change.
 *
 * On observe le PARENT (largeur disponible) et non le nœud lui-même, pour éviter
 * une boucle de rétroaction (changer la police change la taille du nœud).
 */
export const fitText: Action<HTMLElement, unknown> = (node) => {
	const min = 11; // px plancher

	function fit() {
		node.style.fontSize = ''; // repart de la taille définie par la classe (max)
		let size = parseFloat(getComputedStyle(node).fontSize) || 18;
		node.style.fontSize = `${size}px`;
		while (size > min && node.scrollWidth > node.clientWidth) {
			size -= 1;
			node.style.fontSize = `${size}px`;
		}
	}

	const ro = new ResizeObserver(() => fit());
	ro.observe(node.parentElement ?? node);
	fit();

	return {
		update: fit,
		destroy: () => ro.disconnect()
	};
};
