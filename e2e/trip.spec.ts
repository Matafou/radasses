import { expect, test } from '@playwright/test';
import { addParticipant, addSimpleExpense, createTrip, listRow, uniqueTripName } from './helpers';

// Ces tests valident surtout le RECHARGEMENT SÉLECTIF (point 4) : après une
// mutation, on ne recharge qu'un sous-ensemble des données — il faut vérifier
// que tous les écrans concernés reflètent bien le changement, sans donnée périmée.

test('crée un séjour et arrive sur l’onglet Dépenses (vide)', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');
	await expect(page.getByText(/Aucune dépense pour l'instant/)).toBeVisible();
});

test('une dépense partagée met à jour la liste ET les soldes', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');
	await addParticipant(page, 'Bob');
	await addSimpleExpense(page, { amount: '60', description: 'Courses' });

	// liste Dépenses à jour (reload expenses + beneficiaries)
	await expect(page.getByText('Courses')).toBeVisible();
	await expect(page.getByTitle(/payé par Alice/)).toBeVisible();

	// Soldes recalculés par le vrai SQL (reload balances) : Alice +30, Bob -30
	await page.getByRole('link', { name: 'Soldes' }).click();
	await expect(page.getByText(/\+30,00/)).toBeVisible(); // Alice, positif
	await expect(page.getByText('on lui doit')).toBeVisible();
	await expect(page.getByText('doit', { exact: true })).toBeVisible(); // Bob, négatif
});

test('ajouter un participant dans un nouveau foyer ajoute une ligne de solde', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');

	await page.getByRole('link', { name: 'Soldes' }).click();
	await expect(listRow(page, 'Alice')).toBeVisible();
	await expect(listRow(page, 'Bob')).toHaveCount(0);

	await addParticipant(page, 'Bob'); // reload participants + balances

	await page.getByRole('link', { name: 'Soldes' }).click();
	await expect(listRow(page, 'Bob')).toBeVisible(); // nouvelle ligne (solde 0)
});

test('renommer un participant se reflète comme payeur dans les dépenses', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');
	await addSimpleExpense(page, { amount: '20', description: 'Café' });
	await expect(page.getByTitle(/payé par Alice/)).toBeVisible();

	// renommer Alice -> Alicia (un seul participant → un seul bouton « Modifier »)
	await page.getByRole('link', { name: 'Participants' }).click();
	await page.getByRole('button', { name: 'Modifier' }).click();
	await page.getByLabel('Prénom').fill('Alicia');
	await page.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(listRow(page, 'Alicia')).toBeVisible();

	// reload participants → la map personName se met à jour → carte dépense aussi
	await page.getByRole('link', { name: 'Dépenses' }).click();
	await expect(page.getByTitle(/payé par Alicia/)).toBeVisible();
});

test('valider une dépense sans bénéficiaire est refusé', async ({ page }) => {
	// NB : les erreurs de RÉPARTITION (tampon manquant, poids incohérents, fixes >
	// total) sont couvertes par les tests unitaires Vitest ; l'UI en empêche
	// certaines (le dernier non-verrouillé reste forcé comme tampon). Ici on
	// vérifie la validation atteignable du formulaire.
	await createTrip(page, uniqueTripName(), 'Alice');

	await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
	await page.getByPlaceholder('Montant €').fill('30');
	await page.getByRole('checkbox', { name: 'Tout le monde' }).uncheck();
	await page.getByRole('button', { name: 'Créer', exact: true }).click();

	await expect(page.getByText('Sélectionne au moins un bénéficiaire.')).toBeVisible();
});
