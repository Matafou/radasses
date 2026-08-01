import type { Action } from 'svelte/action';

/**
 * Vrai uniquement sur un appareil à pointeur fin (souris) : on n'autofocus PAS
 * sur tactile, car cela ferait surgir le clavier virtuel (mauvaise UX mobile).
 */
const isPointerFine = () =>
	typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Focalise le 1er descendant marqué `data-autofocus` du conteneur (desktop only).
 * Renvoie `true` si le focus a bien été déplacé, `false` sinon (tactile, ou aucune
 * cible) → l'appelant peut alors focaliser le conteneur du dialogue à la place.
 */
export function focusAutofocusTarget(container: HTMLElement): boolean {
	if (!isPointerFine()) return false;
	const el = container.querySelector<HTMLElement>('[data-autofocus]');
	if (!el) return false;
	el.focus();
	return true;
}

/**
 * Action : au montage du conteneur, place le focus dans son champ `data-autofocus`.
 * Pour les formulaires « en ligne » (qui se montent quand on les affiche).
 * Le bottom-sheet, lui, appelle `focusAutofocusTarget` à son ouverture.
 */
export const autofocusWithin: Action<HTMLElement> = (node) => {
	queueMicrotask(() => focusAutofocusTarget(node));
};
