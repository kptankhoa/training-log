# Training Log

A personal, mobile-first training log built with SvelteKit. Track workouts on a calendar (training-type color coding, splits, exercises/sets), body metrics and measurements, and progress photos — all scoped to a single Google-authenticated account per user.

## Stack

- SvelteKit 2, deployed as a static SPA (`ssr = false`) to Cloudflare Pages
- Svelte 5 (legacy component syntax)
- Firebase: Auth (Google Sign-In), Firestore (with offline persistence), Storage (progress photos)
- Tailwind CSS with a Gruvbox Dark/Light palette
- Chart.js for the Stats page, Vitest + @testing-library/svelte for tests

See `CLAUDE.md` for architecture notes and conventions.

## Developing

Install dependencies, then start the dev server:

```sh
npm install
npm run dev
# or: npm run dev -- --open
```

## Testing & type-checking

```sh
npm run test:run   # full test suite (or `npm test` to watch)
npm run check      # svelte-check type-checking; must be 0 errors before committing
```

## Building & deploying

```sh
npm run build     # production build (adapter-cloudflare)
npm run preview   # build, then serve via `wrangler pages dev`
npm run deploy    # build, then `wrangler pages deploy`
```
