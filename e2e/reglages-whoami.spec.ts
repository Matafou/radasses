import { expect, test } from '@playwright/test';
import { createTrip, uniqueTripName } from './helpers';

// Réglages → rubrique « Qui suis-je ? » : montre le participant auquel la session
// courante est rattachée (nom + foyer). Le créateur est rattaché à son propre nom.
test('Réglages affiche « Qui suis-je ? » avec l’identité courante', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');
	await page.getByRole('link', { name: 'Réglages' }).click();

	await expect(page.getByText('Qui suis-je ?')).toBeVisible();
	// Rattaché à « Alice », foyer par défaut « le foyer Alice » (nom = prénom).
	await expect(page.getByText('le foyer Alice')).toBeVisible();
});
