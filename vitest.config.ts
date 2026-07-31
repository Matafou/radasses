import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Config Vitest volontairement indépendante du plugin SvelteKit : nos tests
// unitaires portent sur de la logique TS pure (répartition), sans `$app`/`$env`.
// On résout juste l'alias `$lib` pour les imports.
export default defineConfig({
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		include: ['src/**/*.test.ts']
	}
});
