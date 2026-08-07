import { expect, test } from '@playwright/test';
import { addParticipant, createTrip, uniqueTripName } from './helpers';

// Lien de séjour PARTAGEABLE (un pour tous) : « Partager le lien du séjour » ouvre une
// feuille, le lien porte `?join=`. À l'ouverture de ce lien (autre session), un écran
// « Qui es-tu ? » liste les participants ; on choisit son nom, on confirme, on entre.
test('lien de séjour : « Qui es-tu ? » puis auto-désignation', async ({ page }) => {
	// Stub navigator.share pour rendre le bouton natif visible et récupérer le lien.
	await page.addInitScript(() => {
		(window as unknown as { __lastShare?: unknown }).__lastShare = null;
		(navigator as unknown as { share: (d: unknown) => Promise<void> }).share = async (d) => {
			(window as unknown as { __lastShare?: unknown }).__lastShare = d;
		};
	});

	const tripName = uniqueTripName();
	await createTrip(page, tripName, 'Alice'); // le créateur réclame déjà « Alice »
	await addParticipant(page, 'Bob');

	// Récupère le lien de séjour via la feuille de partage (URL portée par le partage natif).
	await page.getByRole('button', { name: 'Partager le lien du séjour' }).click();
	const sheet = page.getByRole('dialog', { name: 'Partager le lien du séjour' });
	await expect(sheet).toBeVisible();
	await sheet.getByRole('button', { name: 'Partager…', exact: true }).click();
	const joinUrl = await page.evaluate(
		() => (window as unknown as { __lastShare: { url: string } }).__lastShare.url
	);
	expect(joinUrl).toContain('?join=');

	// Nouvelle personne : on repart d'un stockage vide (autre session anonyme).
	await page.evaluate(() => localStorage.clear());
	await page.goto(joinUrl);

	// Écran « Qui es-tu ? » : Alice (déjà réclamée par le créateur) + Bob (libre).
	await expect(page.getByRole('heading', { name: 'Qui es-tu ?' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Alice/ })).toContainText('déjà pris');

	// Choisir Bob → confirmation → on entre dans le séjour.
	await page.getByRole('button', { name: 'Bob', exact: true }).click();
	await expect(page.getByText(/C'est bien toi/)).toBeVisible();
	await page.getByRole('button', { name: "Oui, c'est moi" }).click();

	await page.waitForURL(/\/t\/[0-9a-f-]+/);
	await expect(page.getByRole('link', { name: 'Dépenses' })).toBeVisible();
});
