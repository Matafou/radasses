import { expect, test } from '@playwright/test';
import { addParticipant, createTrip, uniqueTripName } from './helpers';

// Montage paresseux du formulaire de dépense : il n'est monté que sheet ouvert OU
// tant qu'un brouillon est en cours (`state.formOpen || state.hasCreateDraft`).
// Le flux fragile est donc « Masquer (garder la saisie) → ajouter un participant
// → Reprendre » : le brouillon doit rester monté (saisie conservée) ET le
// participant apparu entre-temps doit être intégré (catch-up $effect, seul cas
// que la laziness fait encore reposer sur lui).
test('brouillon masqué : la saisie survit et intègre un participant ajouté avant « Reprendre »', async ({
	page
}) => {
	await createTrip(page, uniqueTripName(), 'Alice');

	// --- Saisie d'un brouillon, puis on masque (garder la saisie) ---
	await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
	await page.getByPlaceholder('Montant €').fill('60');
	await page.getByPlaceholder('Description').fill('Brouillon');
	await page.getByRole('button', { name: 'Masquer (garder la saisie)' }).click();

	// Le brouillon est signalé (FAB « Reprendre »), le formulaire reste monté.
	const resume = page.getByRole('button', { name: 'Reprendre la saisie en cours' });
	await expect(resume).toBeVisible();

	// --- Un participant apparaît PENDANT que le brouillon est masqué ---
	await addParticipant(page, 'Bob');

	// --- Reprendre : saisie conservée + Bob intégré comme bénéficiaire ---
	await page.getByRole('link', { name: 'Dépenses' }).click();
	await resume.click();

	await expect(page.getByPlaceholder('Montant €')).toHaveValue('60');
	await expect(page.getByPlaceholder('Description')).toHaveValue('Brouillon');
	await expect(page.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
});
