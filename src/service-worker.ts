/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Service worker « shell » (étape 1 de l'offlinisation) : il met en cache l'app-shell
// (JS/CSS buildés + fichiers statiques) pour que l'appli DÉMARRE hors-ligne, et sert
// une navigation SPA depuis le cache quand le réseau manque. Il NE cache PAS encore les
// données Supabase (autre origine → laissées au réseau) : c'est l'étape suivante.
import { base, build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `radasses-cache-${version}`;
// Assets connus à précharger. `build` = chunks JS/CSS versionnés ; `files` = contenu de
// `static/` (icônes, manifest, favicon…).
const ASSETS = [...build, ...files];
// Coquille SPA : toutes les routes rendent le même document (SSR/prerender off) → on
// stocke la dernière navigation réussie sous cette clé pour la resservir hors-ligne.
const SHELL = `${base}/`;

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	// On ne gère que NOTRE origine : les API Supabase (autre origine) partent au réseau
	// tel quel (elles échoueront proprement hors-ligne, géré côté UI).
	if (url.origin !== location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Navigation (ouverture d'une route) : réseau d'abord (contenu frais), on garde
			// la coquille à jour ; hors-ligne → on ressert la coquille en cache.
			if (request.mode === 'navigate') {
				try {
					const res = await fetch(request);
					cache.put(SHELL, res.clone());
					return res;
				} catch {
					return (await cache.match(SHELL)) ?? (await cache.match(request)) ?? Response.error();
				}
			}

			// Assets buildés/statiques : cache d'abord (immuables, versionnés).
			if (ASSETS.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			// Autres GET même-origine : réseau, repli cache.
			try {
				const res = await fetch(request);
				if (res.ok && res.type === 'basic') cache.put(request, res.clone());
				return res;
			} catch {
				return (await cache.match(request)) ?? Response.error();
			}
		})()
	);
});
