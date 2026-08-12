import { expect, test } from '@playwright/test';
import { addParticipant, addSimpleExpense, createTrip, uniqueTripName } from './helpers';

// Undo v1 : « Défaire » sur la dernière opération de dépense (page Journal) applique
// l'opération inverse via les RPC existants → la dépense disparaît ET une opération de
// COMPENSATION (suppression) est journalisée.
test('défaire l’ajout d’une dépense la retire et journalise la compensation', async ({ page }) => {
	page.on('dialog', (d) => d.accept()); // confirm « Défaire cette opération ? »

	await createTrip(page, uniqueTripName(), 'Alice');
	await addParticipant(page, 'Bob');
	await addSimpleExpense(page, { amount: '60', description: 'Courses' });
	await expect(page.getByText('Courses')).toBeVisible();
	const tripId = page.url().match(/\/t\/([0-9a-f-]+)/)![1];

	await page.goto(`/t/${tripId}/journal`);

	// déplier l'opération « ajout · Dépense « Courses » » puis Défaire
	await page.getByRole('button', { name: /ajout.*Courses/ }).click();
	await page.getByRole('button', { name: 'Défaire' }).click();

	// une opération de compensation (suppression) est apparue au journal
	await expect(page.getByRole('button', { name: /suppression.*Courses/ })).toBeVisible();

	// et la dépense a disparu de l'onglet Dépenses
	await page.getByRole('link', { name: 'Dépenses' }).click();
	await expect(page.getByText('Courses')).toHaveCount(0);
	await expect(page.getByText(/Aucune dépense/)).toBeVisible();
});
