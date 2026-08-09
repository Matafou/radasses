import { online } from './online.svelte';
import { toast } from './toast.svelte';

/**
 * Props communes d'un contrôle d'ÉCRITURE indisponible hors-ligne : **grisé** mais
 * **toujours cliquable** — un tap hors-ligne affiche un message (toast) au lieu d'exécuter
 * l'action (contrairement à un `disabled` muet). À étaler sur un Button/IconButton/Fab/Switch :
 *
 * ```svelte
 * <IconButton icon={Pencil} label="Modifier" {...offlineWrite(() => startEdit(p))} />
 * ```
 *
 * `muted` est réévalué à chaque rendu (lecture réactive de `online.current`).
 */
export function offlineWrite(action: () => void, message = 'Action indisponible hors-ligne.') {
	return {
		muted: !online.current,
		onclick: () => (online.current ? action() : toast.show(message))
	};
}
