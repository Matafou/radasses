import { defineConfig, devices } from '@playwright/test';

/**
 * Tests E2E : un vrai navigateur pilote l'app (vite dev) branchée sur les
 * ÉMULATEURS Firebase (projet `demo-…` dans `.env`). Playwright démarre les
 * émulateurs et le serveur dev s'ils ne tournent pas déjà (sinon il les réutilise).
 * Chaque test crée son propre séjour → isolation.
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'npm run emulators',
			url: 'http://127.0.0.1:9099',
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			// arrêt propre : sinon le process Java de l'émulateur Firestore reste orphelin
			gracefulShutdown: { signal: 'SIGINT', timeout: 10_000 }
		},
		{
			command: 'npm run dev',
			url: 'http://localhost:5173',
			reuseExistingServer: !process.env.CI,
			timeout: 60_000
		}
	]
});
