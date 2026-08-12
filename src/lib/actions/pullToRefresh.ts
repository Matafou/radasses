import type { Action } from 'svelte/action';

/**
 * Paramètre de l'action : la fonction de rafraîchissement + un interrupteur
 * (utile quand un onglet a son PROPRE scroller interne — ex. Soldes — et veut
 * désactiver le PTR du scroller parent pour éviter un double geste).
 */
export type PullToRefreshParam = {
	onRefresh: () => Promise<unknown> | void;
	disabled?: boolean;
};

const THRESHOLD = 70; // px de tirage (amorti) pour déclencher
const MAX = 110; // amplitude visuelle max
const RESIST = 0.5; // résistance (le contenu suit le doigt à moitié → effet élastique)

/**
 * « Pull-to-refresh » maison (recette standard, sans dépendance) : à poser sur le
 * CONTENEUR SCROLLABLE lui-même. Quand il est tout en haut (`scrollTop === 0`) et
 * qu'on tire vers le bas au-delà d'un seuil, on lance `onRefresh` (typiquement
 * `tripState.load()`). Tactile uniquement (`pointer: coarse`) → aucun effet, aucun
 * écouteur sur desktop. Respecte `prefers-reduced-motion` (pas de rotation continue).
 *
 * L'indicateur (petit rond + spinner) est créé et animé par l'action, positionné en
 * absolu en haut du conteneur ; il n'apparaît que pendant le geste (le scroll étant
 * à 0, `top: 0` correspond au bord visible).
 */
export const pullToRefresh: Action<HTMLElement, PullToRefreshParam> = (node, param) => {
	if (typeof window === 'undefined') return {}; // SSR : rien à faire

	// On n'essaie PAS de détecter « tactile » à l'avance (fragile, et évalué une seule
	// fois au montage → casse l'émulation DevTools). On pose toujours les écouteurs
	// TOUCH : sur souris pure ils ne se déclenchent jamais (desktop/E2E intacts) ; en
	// tactile réel OU émulé, ils fonctionnent.
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let onRefresh = param.onRefresh;
	let disabled = param.disabled ?? false;

	// L'indicateur est positionné par rapport au conteneur.
	if (getComputedStyle(node).position === 'static') node.style.position = 'relative';
	const indicator = document.createElement('div');
	indicator.setAttribute('aria-hidden', 'true');
	indicator.style.cssText =
		'position:absolute;top:0;left:50%;z-index:5;display:flex;align-items:center;justify-content:center;' +
		'width:32px;height:32px;margin-left:-16px;border-radius:9999px;background:#fff;' +
		'box-shadow:0 1px 3px rgba(0,0,0,.15);opacity:0;pointer-events:none;transform:translateY(0);';
	const spinner = document.createElement('div');
	spinner.style.cssText =
		'width:18px;height:18px;border:2px solid #cbd5e1;border-top-color:#0f172a;border-radius:9999px;';
	indicator.appendChild(spinner);
	node.appendChild(indicator);

	// Le contenu qu'on fait « suivre le doigt » (translaté vers le bas, rogné par le
	// scroller en bas → montre visuellement l'arrivée au bord haut). Optionnel.
	const content = node.querySelector<HTMLElement>('[data-ptr-content]');

	let startY = 0;
	let pulling = false;
	let dist = 0;
	let refreshing = false;

	function paint(d: number) {
		const t = Math.min(d, MAX);
		indicator.style.transform = `translateY(${t}px)`;
		indicator.style.opacity = String(Math.min(t / THRESHOLD, 1));
		spinner.style.transform = `rotate(${t * 3}deg)`;
		if (content) content.style.transform = `translateY(${t}px)`;
	}

	function reset() {
		dist = 0;
		indicator.style.transition = 'transform .2s ease, opacity .2s ease';
		indicator.style.transform = 'translateY(0)';
		indicator.style.opacity = '0';
		spinner.style.transform = '';
		if (content) {
			content.style.transition = 'transform .2s ease';
			content.style.transform = 'translateY(0)';
		}
		window.setTimeout(() => {
			indicator.style.transition = '';
			if (content) content.style.transition = '';
			refreshing = false;
		}, 220);
	}

	function onStart(e: TouchEvent) {
		if (disabled || refreshing || e.touches.length !== 1 || node.scrollTop > 0) return;
		startY = e.touches[0].clientY;
		pulling = true;
		dist = 0;
		// suivi 1:1 pendant le geste (on retire toute transition résiduelle)
		indicator.style.transition = '';
		if (content) content.style.transition = '';
	}

	function onMove(e: TouchEvent) {
		if (!pulling || refreshing) return;
		const dy = e.touches[0].clientY - startY;
		if (dy <= 0 || node.scrollTop > 0) {
			// remontée ou plus au sommet → on rend la main au scroll natif
			if (dist !== 0) reset();
			pulling = false;
			return;
		}
		e.preventDefault(); // on prend la main sur le scroll
		dist = dy * RESIST;
		paint(dist);
	}

	async function onEnd() {
		if (!pulling || refreshing) return;
		pulling = false;
		if (dist < THRESHOLD) {
			reset();
			return;
		}
		refreshing = true;
		indicator.style.transition = 'transform .2s ease, opacity .2s ease';
		indicator.style.transform = `translateY(${THRESHOLD}px)`;
		indicator.style.opacity = '1';
		if (content) {
			// on maintient le contenu descendu pendant le rechargement (place au spinner)
			content.style.transition = 'transform .2s ease';
			content.style.transform = `translateY(${THRESHOLD}px)`;
		}
		const anim = reduceMotion
			? undefined
			: spinner.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
					duration: 700,
					iterations: Infinity
				});
		try {
			await onRefresh();
		} catch {
			/* l'erreur est gérée par l'UI (TripState.error) */
		}
		anim?.cancel();
		reset();
	}

	node.addEventListener('touchstart', onStart, { passive: true });
	node.addEventListener('touchmove', onMove, { passive: false });
	node.addEventListener('touchend', onEnd, { passive: true });
	node.addEventListener('touchcancel', onEnd, { passive: true });

	return {
		update(next: PullToRefreshParam) {
			onRefresh = next.onRefresh;
			disabled = next.disabled ?? false;
		},
		destroy() {
			node.removeEventListener('touchstart', onStart);
			node.removeEventListener('touchmove', onMove);
			node.removeEventListener('touchend', onEnd);
			node.removeEventListener('touchcancel', onEnd);
			indicator.remove();
		}
	};
};
