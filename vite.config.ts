import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: '404.html' }),
			// Chemin de base : vide en dev/local, '/radasses' en prod (GitHub Pages,
			// servi sous https://matafou.github.io/radasses/). Injecté par le workflow.
			paths: { base: process.env.BASE_PATH ?? '' }
		})
	]
});
