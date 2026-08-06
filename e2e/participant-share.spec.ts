import { expect, test } from '@playwright/test';
import { addParticipant, createTrip, listRow, uniqueTripName } from './helpers';

// Partage du lien d'invitation : le bouton « Partager » de la ligne ouvre une feuille
// proposant les canaux (partage natif, e-mail, SMS, copier). On stube navigator.share
// pour capturer la charge utile, et on vérifie que le message pré-rédigé porte bien le
// prénom + le nom du séjour + le lien à jeton.
test('la feuille de partage propose les canaux avec un message pré-rédigé', async ({ page }) => {
	// Stub AVANT chargement : rend navigator.share dispo (→ bouton natif visible) et
	// enregistre le dernier appel pour l'inspecter.
	await page.addInitScript(() => {
		(window as unknown as { __lastShare?: unknown }).__lastShare = null;
		(navigator as unknown as { share: (d: unknown) => Promise<void> }).share = async (d) => {
			(window as unknown as { __lastShare?: unknown }).__lastShare = d;
		};
	});

	const tripName = uniqueTripName();
	await createTrip(page, tripName, 'Alice');
	await addParticipant(page, 'Bob');

	// Ouvre la feuille de partage de Bob.
	await listRow(page, 'Bob').getByRole('button', { name: "Partager le lien d'invitation" }).click();
	const sheet = page.getByRole('dialog', { name: /Partager le lien de Bob/ });
	await expect(sheet).toBeVisible();

	// --- E-mail : vrai lien mailto: avec sujet + corps (lien à jeton) ---
	const mailto = sheet.getByRole('link', { name: 'E-mail' });
	const mailtoHref = await mailto.getAttribute('href');
	expect(mailtoHref).toMatch(/^mailto:\?subject=/);
	expect(mailtoHref).toContain('token%3D'); // le lien d'invitation, encodé
	const mailtoDecoded = decodeURIComponent(mailtoHref!);
	expect(mailtoDecoded).toContain('Bob');
	expect(mailtoDecoded).toContain(tripName);

	// --- SMS : vrai lien sms: avec le corps (compatible iOS + Android) ---
	const sms = sheet.getByRole('link', { name: 'SMS' });
	const smsHref = await sms.getAttribute('href');
	expect(smsHref).toMatch(/^sms:\?&body=/);
	expect(decodeURIComponent(smsHref!)).toContain('Bob');

	// --- Partage natif : capture la charge utile ---
	await sheet.getByRole('button', { name: 'Partager…', exact: true }).click();
	const shared = await page.evaluate(
		() => (window as unknown as { __lastShare: { title: string; text: string; url: string } }).__lastShare
	);
	expect(shared.url).toContain('?token=');
	expect(shared.text).toContain('Bob');
	expect(shared.text).toContain(tripName);
	expect(shared.title).toContain(tripName);

	// La feuille se referme après un partage natif réussi.
	await expect(sheet).toBeHidden();
});
