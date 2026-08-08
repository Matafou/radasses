import { expect, test } from '@playwright/test';
import { addParticipant, createTrip, disableAmountRounding, uniqueTripName } from './helpers';

// Correctif : un participant ajouté APRÈS le montage du formulaire de dépense
// (cas courant : on ajoute les participants, puis la 1re dépense) doit être
// bénéficiaire par défaut. Ce test NE coche PAS « Tout le monde » → il échoue
// tant que l'auto-sélection n'inclut pas le participant tardif.

test('un participant ajouté avant la 1re dépense est bénéficiaire par défaut', async ({ page }) => {
	await disableAmountRounding(page); // soldes en valeur exacte pour l'assertion
	await createTrip(page, uniqueTripName(), 'Alice');
	await addParticipant(page, 'Bob');

	await page.getByRole('link', { name: 'Dépenses' }).click();
	await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
	await page.getByPlaceholder('Montant €').fill('60');
	await page.getByPlaceholder('Description').fill('Auto');
	// volontairement : aucune interaction avec les cases à cocher
	await page.getByRole('button', { name: 'Créer', exact: true }).click();
	await expect(page.getByText('Auto')).toBeVisible();

	// Bob inclus par défaut → 60 partagé 30/30 → Alice +30, Bob -30
	await page.getByRole('link', { name: 'Soldes' }).click();
	await expect(page.getByText(/\+30,00/)).toBeVisible();
	await expect(page.getByText('doit', { exact: true })).toBeVisible();
});
