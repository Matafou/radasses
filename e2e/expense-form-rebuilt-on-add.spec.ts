import { expect, test } from '@playwright/test';
import { addParticipant, createTrip, uniqueTripName } from './helpers';

// Montage paresseux : après une création de dépense, le formulaire est démonté
// (closeExpenseForm → formSeq++ et plus de brouillon). La création SUIVANTE remonte
// donc un formulaire neuf, avec un instantané à jour des participants. Vérifie qu'un
// participant ajouté ENTRE deux créations est bénéficiaire coché par défaut dans la
// seconde — ce qui ne tient que si le formulaire est bien refait (pas réutilisé).
test('le formulaire est refait entre deux créations : un participant ajouté est coché par défaut', async ({
	page
}) => {
	await createTrip(page, uniqueTripName(), 'Alice');

	// --- Première création (Alice seule) : monte puis démonte le formulaire ---
	await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
	await page.getByPlaceholder('Montant €').fill('10');
	await page.getByPlaceholder('Description').fill('Première');
	await page.getByRole('button', { name: 'Créer', exact: true }).click();
	await expect(page.getByText('Première')).toBeVisible();

	// --- Un participant apparaît APRÈS la première dépense ---
	await addParticipant(page, 'Bob');

	// --- Seconde création : formulaire neuf → Bob présent et coché par défaut ---
	await page.getByRole('link', { name: 'Dépenses' }).click();
	await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
	await expect(page.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
});
