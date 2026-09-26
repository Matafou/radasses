import { describe, expect, it } from 'vitest';
import { backend } from '$lib/backend';
import { asNewUser, rejectsWith, tripWithTwo } from './helpers';

// Port de supabase/tests/join.test.sql et participants.test.sql.
describe('rejoindre un séjour', () => {
	it('lien de séjour : candidats, réclamation, identité', async () => {
		const { trip_id, zoe } = await tripWithTwo();
		const joinToken = (await backend.getTrip(trip_id))!.join_token;

		await asNewUser();
		const cands = await backend.listJoinCandidates(joinToken);
		expect(cands.map((c) => [c.person_name, c.household_name, c.claimed])).toEqual([
			['Alice', 'Dupont', true],
			['Zoé', 'Zoé', false]
		]);
		await rejectsWith(backend.listJoinCandidates('nope'), 'validation');
		await rejectsWith(backend.claimParticipant(joinToken, crypto.randomUUID()), 'validation');

		expect(await backend.claimParticipant(joinToken, zoe.participant_id)).toBe(trip_id);
		expect(await backend.getMyPersonId(trip_id)).toBe(zoe.person_id);
		expect((await backend.listJoinCandidates(joinToken)).every((c) => c.claimed)).toBe(true);
		// désormais membre : lecture du séjour
		expect(await backend.listParticipants(trip_id)).toHaveLength(2);
	});

	it("jeton d'invitation (par participant)", async () => {
		const { trip_id, zoe } = await tripWithTwo();
		await asNewUser();
		await rejectsWith(backend.redeemToken('nope'), 'validation');
		expect(await backend.redeemToken(zoe.token)).toBe(trip_id);
		expect(await backend.redeemToken(zoe.token)).toBe(trip_id); // idempotent
		expect(await backend.getMyPersonId(trip_id)).toBe(zoe.person_id);
	});

	it('ajout dans un foyer existant, annuaire à jour après renommage', async () => {
		const { trip_id, alice } = await tripWithTwo();
		const bob = await backend.addParticipant({
			trip_id,
			person_name: 'Bob',
			household_id: alice.household_id
		});
		expect(bob.household_id).toBe(alice.household_id);
		await rejectsWith(
			backend.addParticipant({ trip_id, person_name: 'X', household_id: crypto.randomUUID() }),
			'validation'
		);
		await rejectsWith(backend.addParticipant({ trip_id, person_name: '  ' }), 'validation');

		await backend.updatePersonName(trip_id, bob.person_id, 'Robert');
		await backend.updateHouseholdName(trip_id, alice.household_id, 'Famille D');
		const joinToken = (await backend.getTrip(trip_id))!.join_token;
		const c = (await backend.listJoinCandidates(joinToken)).find(
			(x) => x.participant_id === bob.participant_id
		)!;
		expect([c.person_name, c.household_name]).toEqual(['Robert', 'Famille D']);
	});
});
