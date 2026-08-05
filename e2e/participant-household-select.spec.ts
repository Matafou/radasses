import { expect, test } from '@playwright/test';
import { addParticipant, createTrip, listRow, uniqueTripName } from './helpers';

// Le champ « Foyer » doit être un menu DÉROULANT aussi bien à la création qu'à
// l'édition d'un participant (composant mutualisé `HouseholdSelect`). Avant, seule
// la création avait le déroulant ; l'édition avait un champ texte (qui renommait).
// On identifie un `HouseholdSelect` par son option « Nouveau foyer… » (unique :
// le select du payeur, monté caché dans le layout, ne liste que des prénoms).
const foyerSelect = (page: import('@playwright/test').Page) =>
	page.locator('select', {
		has: page.locator('option', { hasText: 'Nouveau foyer (cette personne seule)' })
	});

test('le champ Foyer est un déroulant à la création ET à l’édition', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');

	// --- Création : le formulaire d'ajout expose un <select> Foyer ---
	await page.getByRole('link', { name: 'Participants' }).click();
	await page.getByRole('button', { name: 'Ajouter un participant' }).click();
	await expect(foyerSelect(page)).toBeVisible();
	await page.getByRole('button', { name: 'Annuler l’ajout' }).click();

	// 2e participant → un foyer cible pour le déroulant d'édition
	await addParticipant(page, 'Bob');

	// --- Édition d'Alice : le champ Foyer est AUSSI un <select> ---
	await listRow(page, 'Alice').getByRole('button', { name: 'Modifier' }).click();
	const editFoyer = foyerSelect(page);
	await expect(editFoyer).toBeVisible();
	// et il propose bien de déplacer vers le foyer de Bob
	await expect(editFoyer.locator('option', { hasText: 'Bob' })).toBeAttached();
});
