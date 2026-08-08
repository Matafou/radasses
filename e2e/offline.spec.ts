import { expect, test } from '@playwright/test';
import { addParticipant, addSimpleExpense, createTrip, uniqueTripName } from './helpers';

// Étape 3a de l'offlinisation : hors-ligne, un séjour déjà visité s'affiche depuis le
// cache local (IndexedDB) et les écritures sont désactivées.
//
// ⚠️ En E2E il n'y a PAS de service worker (dev) → les chunks de route ne sont dispo
// hors-ligne que s'ils ont déjà été chargés. On visite donc Dépenses ET Soldes EN LIGNE
// avant de couper le réseau, puis on teste par NAVIGATION SPA (pas de reload complet).
// En prod, le SW (étape 1) précache tous les chunks → offline complet.
test('hors-ligne : données du cache affichées, écritures désactivées', async ({ page }) => {
	const name = uniqueTripName();
	await createTrip(page, name, 'Alice');
	await addParticipant(page, 'Bob');
	await addSimpleExpense(page, { amount: '60', description: 'Courses' });
	await expect(page.getByText('Courses')).toBeVisible();

	// charge le chunk Soldes EN LIGNE (sinon indisponible hors-ligne en dev)
	await page.getByRole('link', { name: 'Soldes' }).click();
	await expect(page.getByText('on lui doit')).toBeVisible();

	// passe hors-ligne
	await page.context().setOffline(true);

	// retour accueil (SPA) puis réouverture du séjour → TripState sert le cache local
	await page.getByRole('link', { name: 'Retour aux séjours' }).click();
	await page.getByRole('link', { name }).click();
	await expect(page).toHaveURL(/\/t\/[0-9a-f-]+/);

	// données servies depuis le cache + bannière + écriture désactivée
	await expect(page.getByText('Courses')).toBeVisible();
	await expect(page.getByText(/Hors-ligne/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Ajouter une dépense' })).toBeDisabled();

	// soldes recalculés LOCALEMENT hors-ligne (Alice +30, Bob −30) + remboursement désactivé
	await page.getByRole('link', { name: 'Soldes' }).click();
	await expect(page.getByText('on lui doit')).toBeVisible();
	await expect(page.getByRole('button', { name: /signaler un remboursement/i })).toBeDisabled();

	await page.context().setOffline(false);
});
