import { expect, test } from '@playwright/test';
import { addParticipant, addSimpleExpense, createTrip, uniqueTripName } from './helpers';

// Étape 3b : écritures HORS-LIGNE (ajouts/suppressions) appliquées en local + mises en
// file, rejouées au retour en ligne. On coupe le réseau via context.setOffline ; les
// formulaires (bottom-sheet) sont déjà montés → pas de chunk de route à charger.

test('création hors-ligne puis synchronisation au retour', async ({ page }) => {
	const name = uniqueTripName();
	await createTrip(page, name, 'Alice');
	await addParticipant(page, 'Bob');
	await addSimpleExpense(page, { amount: '60', description: 'Courses' });
	await expect(page.getByText('Courses')).toBeVisible();

	await page.context().setOffline(true);

	// créer une dépense hors-ligne
	await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
	await page.getByPlaceholder('Montant €').fill('30');
	await page.getByPlaceholder('Description').fill('Taxi');
	await page.getByRole('checkbox', { name: 'Tout le monde' }).check();
	await page.getByRole('button', { name: 'Créer', exact: true }).click();

	// apparaît immédiatement, marquée « à synchroniser », et la file est signalée
	await expect(page.getByText('Taxi')).toBeVisible();
	await expect(page.getByText('à synchroniser')).toBeVisible();
	await expect(page.getByText(/en attente/)).toBeVisible();

	// retour en ligne → synchro auto (flush + reload) → tag disparu, dépense persistée
	await page.context().setOffline(false);
	await expect(page.getByText('à synchroniser')).toHaveCount(0);
	await expect(page.getByText('Taxi')).toBeVisible();
});

test('suppression hors-ligne synchronisée + collapse création/suppression', async ({ page }) => {
	page.on('dialog', (d) => d.accept()); // confirm() de suppression

	const name = uniqueTripName();
	await createTrip(page, name, 'Alice');
	await addParticipant(page, 'Bob');
	await addSimpleExpense(page, { amount: '60', description: 'Courses' }); // synchronisée
	await expect(page.getByText('Courses')).toBeVisible();

	await page.context().setOffline(true);

	// (a) collapse : créer puis supprimer hors-ligne la même dépense (jamais envoyée)
	await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
	await page.getByPlaceholder('Montant €').fill('10');
	await page.getByPlaceholder('Description').fill('Bidon');
	await page.getByRole('checkbox', { name: 'Tout le monde' }).check();
	await page.getByRole('button', { name: 'Créer', exact: true }).click();
	await expect(page.getByText('Bidon')).toBeVisible();
	// « Bidon » est la plus récente (préfixée en tête) → 1er bouton Supprimer
	await page.getByRole('button', { name: 'Supprimer' }).first().click();
	await expect(page.getByText('Bidon')).toHaveCount(0);

	// (b) supprimer « Courses » (déjà synchronisée) hors-ligne → reste AFFICHÉE avec le
	// médaillon « supprimé · à synchroniser » jusqu'à la synchro.
	await page.getByRole('button', { name: 'Supprimer' }).first().click();
	await expect(page.getByText('supprimé · à synchroniser')).toBeVisible();
	await expect(page.getByText('Courses')).toBeVisible();

	// retour en ligne + réouverture (charge l'état serveur) → tout est vide côté serveur :
	// la suppression a été rejouée, « Bidon » n'a jamais été créée (collapse).
	await page.context().setOffline(false);
	await page.getByRole('link', { name: 'Retour aux séjours' }).click();
	await page.getByRole('link', { name }).click();
	await expect(page.getByText(/Aucune dépense/)).toBeVisible();
	await expect(page.getByText('Bidon')).toHaveCount(0);
});
