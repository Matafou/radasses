import { expect, type Page } from '@playwright/test';

/** Crée un séjour depuis l'accueil et attend l'arrivée sur l'onglet Dépenses. */
export async function createTrip(page: Page, tripName: string, myName: string) {
	await page.goto('/');
	await page.getByPlaceholder('Été à la mer').fill(tripName);
	await page.getByPlaceholder('Alice').fill(myName);
	await page.getByRole('button', { name: 'Créer le séjour' }).click();
	await page.waitForURL(/\/t\/[0-9a-f-]+/);
	await expect(page.getByRole('link', { name: 'Dépenses' })).toBeVisible();
}

/**
 * Ligne de liste (`ListRow` = `<li class="list-row">`) contenant un texte.
 * Le formulaire de dépense reste monté (caché) dans le layout et contient les
 * noms des participants (options du payeur, cases à cocher) → on cible les
 * `li.list-row`, que le formulaire n'utilise pas, pour éviter les faux positifs.
 */
export const listRow = (page: Page, text: string | RegExp) =>
	page.locator('li.list-row').filter({ hasText: text });

/** Onglet Participants → ajoute un participant dans un NOUVEAU foyer. */
export async function addParticipant(page: Page, name: string) {
	await page.getByRole('link', { name: 'Participants' }).click();
	await page.getByRole('button', { name: 'Ajouter un participant' }).click();
	await page.getByPlaceholder('Prénom').fill(name);
	await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
	await expect(listRow(page, name)).toBeVisible();
}

/**
 * Onglet Dépenses → ouvre le formulaire, saisit montant + libellé (bénéficiaires
 * cochés par défaut = tous les participants actifs, payeur = moi) et valide.
 */
export async function addSimpleExpense(page: Page, opts: { amount: string; description: string }) {
	await page.getByRole('link', { name: 'Dépenses' }).click();
	await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
	await page.getByPlaceholder('Montant €').fill(opts.amount);
	await page.getByPlaceholder('Description').fill(opts.description);
	// S'assure que tous les participants actifs sont bénéficiaires (l'auto-sélection
	// par défaut peut manquer un participant ajouté après le montage du formulaire).
	await page.getByRole('checkbox', { name: 'Tout le monde' }).check();
	await page.getByRole('button', { name: 'Créer', exact: true }).click();
	await expect(page.getByText(opts.description)).toBeVisible();
}

/** Nom de séjour unique (les tests partagent la même base locale). */
export const uniqueTripName = (prefix = 'E2E') =>
	`${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
