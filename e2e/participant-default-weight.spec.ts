import { expect, test } from '@playwright/test';
import { addParticipant, createTrip, listRow, uniqueTripName } from './helpers';

// Poids par défaut d'un participant : réglé à l'édition (onglet Participants), puis
// PROPOSÉ via un bouton en mode « Répartition détaillée » — à la place du
// remplissage initial « 1 pour tout le monde ». Bob à 0,5 + Alice à 1 → sur 60 €,
// Alice 40,00 / Bob 20,00 (au lieu de 30/30).
test('régler puis appliquer les poids par défaut dans une dépense détaillée', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');
	await addParticipant(page, 'Bob');

	// --- Édition de Bob : poids par défaut = 0,5 ---
	await listRow(page, 'Bob').getByRole('button', { name: 'Modifier' }).click();
	await page.getByPlaceholder('1', { exact: true }).fill('0.5');
	await page.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(listRow(page, 'Bob')).toBeVisible(); // édition refermée

	// --- Nouvelle dépense de 60 €, tout le monde bénéficiaire ---
	await page.getByRole('link', { name: 'Dépenses' }).click();
	await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
	await page.getByPlaceholder('Montant €').fill('60');
	await page.getByRole('checkbox', { name: 'Tout le monde' }).check();

	// Le bouton n'existe qu'en mode détaillé.
	const applyBtn = page.getByRole('button', { name: 'Appliquer les poids par défaut' });
	await expect(applyBtn).toHaveCount(0);

	await page.getByRole('switch', { name: 'Répartition détaillée' }).click();
	await expect(applyBtn).toBeVisible();

	// Sans appliquer : « 1 pour tout le monde » → 30,00 chacun.
	await expect(page.getByText(/30,00/)).toHaveCount(2);

	// Appliqué : Alice 40,00 / Bob 20,00.
	await applyBtn.click();
	await expect(page.getByText(/40,00/)).toBeVisible();
	await expect(page.getByText(/20,00/)).toBeVisible();
});
