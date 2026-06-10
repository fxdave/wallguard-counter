# Wallguard Counter

A small, auth-gated **counter** web app for a household-style group. Count items
(name, icon, price, category), save batches ("checkouts"), review a monthly
overview, and export transactions to CSV. Fully client-side — no backend.

See [`spec.md`](./spec.md) for the product spec and design decisions, and
[`CLAUDE.md`](./CLAUDE.md) for an architecture summary.

## Stack

Vite · React + TypeScript · React Router · Firebase (Auth + Firestore) ·
TanStack Query · Tailwind CSS v4 · Motion · Vitest + Testing Library.

All logic lives in the client plus Firestore Security Rules. Hosting is the
free Firebase Spark plan; access is restricted by an email allowlist in
[`firestore.rules`](./firestore.rules).

## Local development (podman)

```bash
podman compose up
```

- App (Vite dev server): http://localhost:5173 — wired to the emulators
- Firebase Emulator Suite UI: http://localhost:4000

The `emulators` service runs Auth + Firestore offline (demo project, no real
Firebase credentials needed); the `web` service installs deps and runs the dev
server against them.

## Local development (without podman)

```bash
cp .env.example .env      # fill in your Firebase web config, or set VITE_USE_EMULATORS=true
npm install
npm run emulators         # terminal 1 — needs a JRE installed
npm run dev               # terminal 2
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Vitest (run once) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:emulators` | Run tests against the Firebase emulators |

Run a single test file: `npm run test -- src/lib/csv.test.ts`

## Access control & adding members

Access is a **dynamic allowlist** stored in the Firestore `members` collection
and enforced by [`firestore.rules`](./firestore.rules) (every read/write checks
`exists(/members/<your-email>)`). Anyone can sign in with Google, but a
signed-in user who isn't on the allowlist sees an "Access pending" screen — they
can't read or write anything.

- **Bootstrap owner:** because the collection starts empty, one owner email is
  hardcoded in `firestore.rules` (`ownerEmail()`). Set it to your Google email
  before deploying. The owner always has access and can never be locked out.
- **Managing members:** the owner (and any existing member) adds/removes people
  from **Settings → Members** in the app — no redeploy needed. This is a flat
  model: every member can manage the list.

The local emulator uses open dev rules (`firestore.dev.rules`), so the access
gate passes for any signed-in account during development.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) runs on push to `main`: install
→ lint → typecheck → test (against the emulators) → build → deploy Hosting +
Firestore rules.

Required repository secrets:

- `FIREBASE_SERVICE_ACCOUNT` — JSON key for a service account with deploy rights
- `VITE_FIREBASE_*` — the production web app config (see `.env.example`)

## License

Copyright © 2026 David Biró.

Licensed under the **European Union Public Licence v. 1.2** (EUPL-1.2). See
[`LICENSE`](./LICENSE) for the full text. The EUPL is a copyleft licence whose
share-alike obligation also covers making the software available over a network,
and it is compatible with the (A)GPL and other licences listed in its appendix.
