import { backend, BackendError, type SaveExpenseInput } from '$lib/backend';
import { loadOutbox, saveOutbox } from './offline-cache';
import { errMessage } from './util';
import { toast } from './toast.svelte';

// File d'écritures faites HORS-LIGNE (étape 3b), rejouées à la reconnexion. Ne contient
// que des opérations SANS CONFLIT possible (ajouts/suppressions) → concaténation FIFO,
// aucune résolution de merge. Persistée (IndexedDB) pour survivre à un rechargement.
export type PendingOp =
	| { kind: 'createExpense'; tripId: string; tempId: string; input: SaveExpenseInput }
	| { kind: 'deleteExpense'; tripId: string; expenseId: string };

class Outbox {
	ops = $state<PendingOp[]>([]);
	/** dernière erreur non-réseau rencontrée à la synchro (op abandonnée) */
	lastError = $state<string | null>(null);
	private loaded = false;
	private flushing: Promise<void> | null = null;

	/** nombre d'opérations en attente (réactif). */
	get count(): number {
		return this.ops.length;
	}

	/** Charge la file persistée (une seule fois). */
	async init(): Promise<void> {
		if (this.loaded) return;
		this.loaded = true;
		this.ops = await loadOutbox();
	}

	private async persist(): Promise<void> {
		await saveOutbox($state.snapshot(this.ops) as PendingOp[]);
	}

	async enqueueCreate(tripId: string, tempId: string, input: SaveExpenseInput): Promise<void> {
		this.ops.push({ kind: 'createExpense', tripId, tempId, input });
		await this.persist();
	}

	async enqueueDelete(tripId: string, expenseId: string): Promise<void> {
		this.ops.push({ kind: 'deleteExpense', tripId, expenseId });
		await this.persist();
	}

	/**
	 * Annule une création encore en attente (dépense créée puis supprimée hors-ligne
	 * avant synchro) → les deux ops s'annulent, rien n'est envoyé. Renvoie `true` si une
	 * création a été retirée (l'appelant n'a alors pas à empiler de suppression).
	 */
	async cancelPendingCreate(tempId: string): Promise<boolean> {
		const before = this.ops.length;
		this.ops = this.ops.filter((o) => !(o.kind === 'createExpense' && o.tempId === tempId));
		if (this.ops.length === before) return false;
		await this.persist();
		return true;
	}

	/** Rejoue la file FIFO contre le serveur. Concurrent-safe (une seule passe à la fois). */
	flush(): Promise<void> {
		if (this.flushing) return this.flushing;
		this.flushing = this.run().finally(() => (this.flushing = null));
		return this.flushing;
	}

	private async run(): Promise<void> {
		while (this.ops.length) {
			const op = this.ops[0];
			try {
				if (op.kind === 'createExpense') {
					await backend.saveExpense(op.input);
				} else {
					try {
						// delete-wins : pas de verrou de version ; « déjà supprimée / introuvable »
						// = résultat souhaité (idempotent).
						await backend.deleteExpense({
							trip_id: op.tripId,
							expense_id: op.expenseId,
							expected_version: null
						});
					} catch (e) {
						if (e instanceof BackendError && e.code === 'network') throw e;
						// autre erreur → la dépense est de toute façon absente/inaccessible : résolu
					}
				}
				this.ops.shift();
				await this.persist();
			} catch (e) {
				// Réseau retombé : on s'arrête, on retentera à la prochaine reconnexion.
				if (e instanceof BackendError && e.code === 'network') return;
				// Erreur non-réseau sur une création (validation/permission…) : on abandonne
				// l'op fautive pour ne pas bloquer la file, et on SIGNALE à l'utilisateur.
				this.lastError = errMessage(e);
				toast.show(`Une modification n'a pas pu être synchronisée : ${this.lastError}`, 5000);
				this.ops.shift();
				await this.persist();
			}
		}
	}
}

export const outbox = new Outbox();
