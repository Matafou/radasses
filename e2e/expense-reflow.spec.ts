import { expect, test } from '@playwright/test';
import { addParticipant, addSimpleExpense, createTrip, uniqueTripName } from './helpers';

// Accessibilité « mode agrandi » : sur la carte de dépense, la liste des
// bénéficiaires reste sur la ligne 2 en texte normal, mais passe sur une 3e ligne
// quand le texte est agrandi (container query en em, seuil 17em). Testé sur un
// viewport téléphone (la carte est alors contrainte en px → le ratio bascule).
test('la liste des bénéficiaires passe en 3e ligne quand le texte est agrandi', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 800 });
	await createTrip(page, uniqueTripName(), 'Alice');
	await addParticipant(page, 'Bob');
	await addSimpleExpense(page, { amount: '60', description: 'Courses' });

	const benef = page.locator('div.hide-scrollbar').first();
	const editBtn = page.getByRole('button', { name: 'Modifier' }).first();
	// « 3e ligne » = les bénéficiaires sont sous les boutons (et non à côté).
	const onThirdLine = async () => {
		const b = await benef.boundingBox();
		const a = await editBtn.boundingBox();
		return !!b && !!a && b.y >= a.y + a.height - 2;
	};

	// texte normal → 2 lignes
	expect(await onThirdLine()).toBe(false);

	// texte agrandi → 3 lignes
	await page.evaluate(() => (document.documentElement.style.fontSize = '28px'));
	await expect.poll(onThirdLine).toBe(true);
});
