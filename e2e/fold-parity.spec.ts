import { expect, test } from '@playwright/test';
import { addParticipant, addSimpleExpense, createTrip, uniqueTripName } from './helpers';
import { foldTrip } from '../src/lib/fold';

// Parité event-sourcing : l'état reconstruit en REPLIANT le journal (`foldTrip`) doit
// être IDENTIQUE à l'état chargé depuis les tables — sur données RÉELLES. On crée un
// séjour (donc un log complet, post-0009), on récupère le journal + les tables via le
// backend (exposé en dev sur `window.__backend`), on folde côté Node, et on compare.
test('le fold du journal reconstruit le même état que les tables', async ({ page }) => {
	const name = uniqueTripName();
	await createTrip(page, name, 'Alice');
	await addParticipant(page, 'Bob');
	await addSimpleExpense(page, { amount: '60', description: 'Courses' });
	await expect(page.getByText('Courses')).toBeVisible();

	const tripId = page.url().match(/\/t\/([0-9a-f-]+)/)![1];

	const data = await page.evaluate(async (id) => {
		const b = (window as unknown as { __backend: Record<string, (t: string) => Promise<unknown>> })
			.__backend;
		const [ops, trip, participants, expenses, beneficiaries] = await Promise.all([
			b.listOperations(id),
			b.getTrip(id),
			b.listParticipants(id),
			b.listExpenses(id),
			b.listBeneficiaries(id)
		]);
		return { ops, trip, participants, expenses, beneficiaries };
	}, tripId);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const folded = foldTrip(data.ops as any);

	const sortBy = <T>(a: T[], key: (x: T) => string) =>
		[...a].sort((x, y) => (key(x) < key(y) ? -1 : 1));

	// trip : on compare les champs sémantiques (created_at peut différer de format)
	const t = data.trip as { id: string; name: string; currency: string; join_token: string };
	expect({
		id: folded.trip!.id,
		name: folded.trip!.name,
		currency: folded.trip!.currency,
		join_token: folded.trip!.join_token
	}).toEqual({ id: t.id, name: t.name, currency: t.currency, join_token: t.join_token });

	expect(sortBy(folded.participants, (p) => p.participant_id)).toEqual(
		sortBy(data.participants as typeof folded.participants, (p) => p.participant_id)
	);
	expect(sortBy(folded.expenses, (e) => e.id)).toEqual(
		sortBy(data.expenses as typeof folded.expenses, (e) => e.id)
	);
	expect(sortBy(folded.beneficiaries, (b) => b.expense_id + b.person_id)).toEqual(
		sortBy(data.beneficiaries as typeof folded.beneficiaries, (b) => b.expense_id + b.person_id)
	);
});
