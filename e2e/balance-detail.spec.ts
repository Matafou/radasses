import { expect, test } from '@playwright/test';
import { addParticipant, addSimpleExpense, createTrip, listRow, uniqueTripName } from './helpers';

// Détail crédit/débit : une page dédiée par personne (depuis Participants) et une
// page dédiée par foyer (depuis Soldes). Alice paie 60 partagé 30/30 avec Bob →
// Alice : payé 60, dû 30, net +30 ; « payé pour lui » vide (elle a payé elle-même).
test('détail par personne (page) et par foyer (page)', async ({ page }) => {
	await createTrip(page, uniqueTripName(), 'Alice');
	await addParticipant(page, 'Bob');
	await addSimpleExpense(page, { amount: '60', description: 'Courses' });

	// --- Page personne : cliquer le nom d'Alice dans l'onglet Participants ---
	await page.getByRole('link', { name: 'Participants' }).click();
	await listRow(page, 'Alice').getByRole('link', { name: 'Alice' }).click();
	await expect(page).toHaveURL(/\/personne\//);
	await expect(page.getByRole('heading', { name: 'Alice' })).toBeVisible();
	await expect(page.getByText('Payé par lui')).toBeVisible();
	await expect(page.getByText('Payé pour lui')).toBeVisible();
	await expect(page.getByText(/\+30,00/)).toBeVisible(); // net

	// --- Page foyer : depuis Soldes, cliquer le foyer d'Alice ---
	await page.getByRole('link', { name: 'Soldes' }).click();
	await page.getByRole('link', { name: /Alice/ }).click();
	await expect(page).toHaveURL(/\/foyer\//);
	await expect(page.getByRole('heading', { name: 'Alice' })).toBeVisible();
	await expect(page.getByText('Payé par lui')).toBeVisible();
	await expect(page.getByText('Payé pour lui')).toBeVisible();
});
