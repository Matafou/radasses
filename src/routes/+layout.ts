// Application rendue entièrement côté navigateur (SPA) :
// tout le dynamique vient de Supabase via le client JS, pas d'un serveur.
// Nécessaire pour un hébergement 100 % statique (GitHub Pages).
export const ssr = false;
export const prerender = false;
