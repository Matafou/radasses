import { expect, test } from '@playwright/test';
import { addParticipant, addSimpleExpense, createTrip, uniqueTripName } from './helpers';

// Option « Arrondir les montants » (Réglages, ON par défaut, préférence appareil) :
// les soldes/suggestions s'affichent arrondis, l'exact se révèle au tap (bouton), et
// couper l'option affiche l'exact directement.
test('arrondi des montants : affichage, révélation au tap, bascule', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');
	await addParticipant(page, 'Bob');
	await addParticipant(page, 'Chloé');
	// 10 € payés par Alice pour 3 → soldes non entiers (≈ 6,67 / -3,33 / -3,34).
	await addSimpleExpense(page, { amount: '10', description: 'Courses' });

	await page.getByRole('link', { name: 'Soldes' }).click();

	// Option ON par défaut → montants dépliables (boutons « … montant exact … »).
	const amounts = page.getByRole('button', { name: /montant exact/ });
	const first = amounts.first();
	await expect(first).toBeVisible();
	await expect(first).not.toContainText(','); // arrondi : aucune décimale
	await first.click(); // tap → révèle l'exact
	await expect(first).toContainText(','); // décimales révélées

	// Couper l'arrondi dans les Réglages.
	await page.getByRole('link', { name: 'Réglages' }).click();
	await page.getByRole('switch', { name: 'Arrondir les montants' }).click();

	// Retour aux Soldes : plus de boutons dépliables (montants affichés exacts).
	await page.getByRole('link', { name: 'Soldes' }).click();
	await expect(page.getByRole('button', { name: /montant exact/ })).toHaveCount(0);
});
