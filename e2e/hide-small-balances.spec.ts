import { expect, test } from '@playwright/test';
import { addParticipant, addSimpleExpense, createTrip, uniqueTripName } from './helpers';

// Masquage des soldes/remboursements sous le seuil (préférence appareil, défaut 1 €) :
// une dépense de 1 € partagée entre 3 → tous les nets valent < 1 € → masqués ; un lien
// permet de les révéler, puis de les re-masquer.
test('masquer les petits soldes (< seuil) et les révéler par le lien', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');
	await addParticipant(page, 'Bob');
	await addParticipant(page, 'Chloé');
	await addSimpleExpense(page, { amount: '1', description: 'Broutille' }); // 1 € / 3 → nets < 1 €

	await page.getByRole('link', { name: 'Soldes' }).click();

	// tout est sous le seuil → soldes masqués + suggestions masquées
	await expect(page.getByText('Tous les soldes sont négligeables.')).toBeVisible();
	await expect(page.getByText('le foyer Alice')).toHaveCount(0);

	// lien de révélation
	const reveal = page.getByRole('button', { name: /Afficher .* négligeable/ });
	await expect(reveal).toBeVisible();
	await reveal.click();

	// révélés
	await expect(page.getByText('le foyer Alice')).not.toHaveCount(0);

	// re-masquer
	await page.getByRole('button', { name: 'Masquer les soldes négligeables' }).click();
	await expect(page.getByText('le foyer Alice')).toHaveCount(0);
});
