import { expect, test } from '@playwright/test';
import { createTrip, uniqueTripName } from './helpers';

// Le bottom-sheet de dépense doit être une boîte de dialogue accessible :
// role=dialog + nom, focus déplacé dedans à l'ouverture, Échap pour fermer.
test('le formulaire de dépense est une boîte de dialogue accessible', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');
	await page.getByRole('button', { name: 'Ajouter une dépense' }).click();

	// rôle + nom accessible (annoncé par les lecteurs d'écran)
	await expect(page.getByRole('dialog', { name: 'Nouvelle dépense' })).toBeVisible();

	// focus déplacé dans le dialogue (desktop → champ Montant)
	await expect(page.getByPlaceholder('Montant €')).toBeFocused();

	// Échap ferme → le FAB « Ajouter une dépense » réapparaît
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Ajouter une dépense' })).toBeVisible();
});
