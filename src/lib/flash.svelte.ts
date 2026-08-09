// Petit état booléen « éphémère » : passe à `true` puis revient à `false` après un délai.
// Factorise le motif répété `x = true; setTimeout(() => (x = false), ms)` (ex. « Copié ✓ »,
// « Enregistré ✓ »). Usage :
//   const saved = createFlash();
//   saved.trigger();            // dans le handler
//   {saved.on ? 'Enregistré ✓' : 'Enregistrer'}
export function createFlash(ms = 1500) {
	let on = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	return {
		get on() {
			return on;
		},
		trigger() {
			on = true;
			clearTimeout(timer);
			timer = setTimeout(() => (on = false), ms);
		}
	};
}
