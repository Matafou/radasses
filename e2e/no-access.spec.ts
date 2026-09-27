import { expect, test } from '@playwright/test';
import { createTrip, uniqueTripName } from './helpers';

// Un appareil qui n'est pas membre du séjour (autre navigateur, session d'avant la
// bascule Firebase…) ne voit rien : on l'explique au lieu d'afficher un séjour vide.
test('séjour inaccessible : message explicite au lieu d’un séjour vide', async ({
	page,
	browser
}) => {
	await createTrip(page, uniqueTripName(), 'Alice');
	const tripUrl = page.url();

	// autre contexte = autre session anonyme, non membre
	const other = await browser.newContext();
	const stranger = await other.newPage();
	await stranger.goto(tripUrl);
	await expect(
		stranger.getByText('Cet appareil n’a pas (ou plus) accès à ce séjour.')
	).toBeVisible();
	await expect(stranger.getByRole('link', { name: 'Retour à l’accueil' })).toBeVisible();
	await other.close();

	// le membre, lui, voit toujours son séjour
	await expect(page.getByText('Cet appareil n’a pas (ou plus) accès')).toHaveCount(0);
});
