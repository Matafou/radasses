import { describe, expect, it } from 'vitest';
import { toBackendError } from './errors';
import { BackendError } from '../errors';

// Traduction des erreurs natives Supabase -> BackendError. On se concentre sur
// la détection de la SESSION ORPHELINE (FK 23503 vers auth.users, ou GoTrue
// user_not_found), tout en verrouillant quelques mappings voisins.
describe('toBackendError', () => {
	it('détecte une session orpheline : FK sur participant_access.auth_user_id (redeem)', () => {
		const err = toBackendError({
			code: '23503',
			message:
				'insert or update on table "participant_access" violates foreign key constraint "participant_access_auth_user_id_fkey"',
			details: 'Key (auth_user_id)=(…) is not present in table "users".'
		});
		expect(err.code).toBe('orphaned-session');
	});

	it('détecte une session orpheline : FK sur expenses.created_by', () => {
		const err = toBackendError({
			code: '23503',
			message: 'violates foreign key constraint "expenses_created_by_fkey"'
		});
		expect(err.code).toBe('orphaned-session');
	});

	it('détecte une session orpheline : GoTrue user_not_found', () => {
		expect(toBackendError({ code: 'user_not_found', message: 'User not found' }).code).toBe(
			'orphaned-session'
		);
	});

	it("n'assimile PAS une autre violation de FK (23503) à une session orpheline", () => {
		// Ex. : FK métier sans rapport avec auth.users -> reste non classée.
		const err = toBackendError({
			code: '23503',
			message: 'violates foreign key constraint "expenses_trip_id_fkey"'
		});
		expect(err.code).not.toBe('orphaned-session');
	});

	it('mappe le verrou optimiste (PT409) sur conflict', () => {
		expect(toBackendError({ code: 'PT409', message: 'conflit' }).code).toBe('conflict');
	});

	it('mappe un échec réseau (sans SQLSTATE) sur network', () => {
		expect(toBackendError({ message: 'TypeError: Failed to fetch' }).code).toBe('network');
	});

	it('détecte « JWT issued at future » (désynchro d’horloge) sur clock-skew', () => {
		expect(toBackendError({ message: 'JWT issued at future time' }).code).toBe('clock-skew');
		expect(toBackendError({ code: 'bad_jwt', message: 'token used before issued' }).code).toBe(
			'clock-skew'
		);
	});

	it('renvoie tel quel un BackendError déjà normalisé', () => {
		const original = new BackendError('forbidden', 'nope');
		expect(toBackendError(original)).toBe(original);
	});
});
