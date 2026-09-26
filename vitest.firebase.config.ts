import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests d'INTÉGRATION Firebase (remplacent pgTAP) : l'adaptateur réel + les règles de
// sécurité, contre les ÉMULATEURS (auth + firestore). Lancés via `npm run test:firebase`
// (qui démarre puis arrête les émulateurs). `$env/static/public` pointe vers un projet
// `demo-…` → l'adaptateur se branche sur les émulateurs.
export default defineConfig({
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
			'$env/static/public': fileURLToPath(new URL('./tests/firebase/env.ts', import.meta.url))
		}
	},
	test: {
		include: ['tests/firebase/**/*.test.ts'],
		environment: 'node',
		// une session Auth par process : les fichiers ne doivent pas s'entrelacer
		fileParallelism: false,
		testTimeout: 20_000
	}
});
