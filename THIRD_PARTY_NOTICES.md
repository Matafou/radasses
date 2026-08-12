# Third-party notices

This project bundles third-party code (served to users) under permissive licenses. The full
license text of each package remains available in `node_modules/<pkg>/` after `npm install`,
and pinned versions are recorded in `package-lock.json`.

## Svelte / SvelteKit

- Project: https://svelte.dev
- Packages: `svelte`, `@sveltejs/kit`
- License: MIT

## @supabase/supabase-js

Client for the Supabase backend (auth, PostgREST).

- Project: https://supabase.com
- Package: https://www.npmjs.com/package/@supabase/supabase-js
- License: MIT

## Lucide

SVG icons (`@lucide/svelte`).

- Project: https://lucide.dev
- Package: https://www.npmjs.com/package/@lucide/svelte
- License: ISC

---

Build/dev tooling only (not shipped in the delivered app): Tailwind CSS (MIT), Vite (MIT),
Vitest (MIT), Playwright (Apache-2.0), ESLint (MIT), Prettier (MIT), TypeScript
(Apache-2.0). These keep their respective licenses.
