# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

The app is built and deploying; `spec.md` is gone, so the code is the source of truth. The sections below summarize the parts that span files so they don't have to be re-derived each session.

## What this is

A sold-item **Counter** web app, originally built for a climbing gym handling entry tickets, passes, and rental items. It counts items (name, icon, price, category) grouped into categories, records "checkouts" (batch counting sessions), and supports an overview grid, a stats page, and CSV export. Five pages: **Quick Add**, **Overview**, **Stats**, **Export**, **Settings**.

## Architecture (the parts that span multiple files)

- **Fully client-side SPA — there is no backend.** Free Firebase hosting (Spark plan) rules out Cloud Functions, so *all* business logic lives in the React client plus Firestore Security Rules. Treat `firestore.rules` as real application logic, not boilerplate.
- **Auth is the gate for everything.** Google sign-in; the whole app sits behind a login wall (`LoginGate`) and then a `MembershipGate`. Access control is a **dynamic email allowlist in the `members` collection**, enforced by `firestore.rules` via `exists(/members/$(email.lower()))`. One **owner email is hardcoded** in the rules (`ownerEmail()`) as the bootstrap superadmin (the collection starts empty). Members manage the allowlist from **Settings → Members** — flat model, any member can add/remove others. `MembershipGate` shows an "Access pending" screen to signed-in non-members (UX only; rules are the real enforcement). The local emulator uses open dev rules (`firestore.dev.rules`).
- **Prices are money in forints and only ever printed through `formatPrice`** (`src/lib/format.ts`), which appends a non-breaking space and `Ft`. The Overview footer uses `formatPriceCompact` (thousands as `k`, floored) because the day columns are narrow; its header carries the unit instead.
- **All collections are shared**, not per-user — every allowlisted user sees the same data.
- **Snapshot-on-write is the core data-integrity rule.** A checkout copies each line's `name` and `price` into the checkout document at save time. Past checkouts and exports must stay accurate even after an item is renamed, repriced, or deleted — which is why items can be hard-deleted freely. Never resolve historical checkout display/export values by looking up the current item.

### Data model (Firestore, shared top-level collections)

- `categories/{id}` → `{ name, icon }`
- `items/{id}` → `{ name, icon, price, categoryId, order, isPass?, canExpire?, expiryExpression? }`
- `discounts/{id}` → `{ name, percent, order }` — percentage discounts, stacked multiplicatively in `order`
- `passHolders/{id}` → `{ name, birthday, startedAt, passItemId, createdAt, usageCount }` — people holding one pass item
- `checkouts/{id}` → `{ createdAt: Timestamp, total, lines: [{ itemId, name, price, quantity, holderName?, holderBirthday?, percent? }] }` — a line with `percent` is a discount line: negative `price`, quantity 1
- `members/{emailLower}` → `{ addedBy, addedAt }` — the dynamic allowlist (doc id is the lowercased email so rules can `exists()`-check it).

### Page behaviors that aren't obvious from the UI

- **Quick Add**: counters are **local in-memory state** until Save. The bottom bar shows the running price total. Save writes **one** checkout document with the current `{item, quantity}` lines, then resets the counters. (Checkout CRUD in Settings edits/deletes these past batches.)
- **Overview**: shows the **current calendar month** — one column per day (weekday + date header), items grouped by category as rows. Each cell sums that item's `quantity` across all checkouts on that day. Has prev/next month navigation.
- **Stats**: month, year, or custom range over the same checkouts. All aggregation is a pure `computeRangeStats` in `src/lib/stats.ts` (unit-tested, no Firestore): income (net) vs gross vs discount amount, per-item and per-category totals, discount applications, income-over-time buckets (daily up to 62 days, monthly beyond), and weekday accumulation measured **per active day**. The headline compares against the same-length window immediately before the range. Category grouping is the one live lookup — `categoryId` isn't snapshotted on the line, so lines from deleted items land under "Other".
- **Export**: date range defaults to **Jan 1 of the current year → now**. CSV rows are `name;quantity;ISO-date` using the checkout date, one row per checkout line. Generated entirely in the browser.

## Tech stack

Vite + React + TypeScript (no create-react-app) · React Router (the 5 pages) · Firebase Web SDK (Auth + Firestore) behind a thin typed data layer · TanStack Query (caching + optimistic updates) · Tailwind CSS · Framer Motion (Quick Add increment animation) · Vitest + React Testing Library (run against the Firebase Emulator Suite).

## Development & tooling

- **Local dev runs under podman compose**: one service for the Vite dev server, another for the Firebase Emulator Suite (Auth + Firestore). Development is fully local — no production Firebase project is required.
- **Tests run against the Firebase Emulator**, not a live project.
- **CI/CD (GitHub Actions)**: on push to `main` → install, lint, test (against the emulator), build, then deploy **Hosting + Firestore rules** using the `FIREBASE_SERVICE_ACCOUNT` secret.

```bash
make install                       # build the podman images
make start                         # app on :5173, emulators on :8080/:9099, UI on :4000
node scripts/seed-demo-data.mjs    # a year of demo data + demo@wallguard.local / password123

npm run dev                        # Vite (without podman)
npm run emulators                  # Firebase emulators (needs a JRE)
npm run lint                       # ESLint
npm run typecheck                  # tsc --noEmit
npm run test                       # Vitest, once
npm run test -- src/lib/csv.test.ts   # a single test file
npm run test:emulators             # the emulator-backed tests
npm run build                      # tsc -b + vite build
```
