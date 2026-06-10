# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

The repository currently contains only `spec.md` — **no implementation exists yet**. `spec.md` is the authoritative source for intent and design decisions; build to match it. The sections below summarize the planned architecture so it doesn't have to be re-derived each session. Update this file with concrete commands once the tooling actually lands.

## What this is

A **Counter** web app for a household-style group of users. It counts items (name, icon, price, category) grouped into categories, records "checkouts" (batch counting sessions), and supports an overview grid and CSV export. Four pages: **Quick Add**, **Overview**, **Export**, **Settings**.

## Architecture (the parts that span multiple files)

- **Fully client-side SPA — there is no backend.** Free Firebase hosting (Spark plan) rules out Cloud Functions, so *all* business logic lives in the React client plus Firestore Security Rules. Treat `firestore.rules` as real application logic, not boilerplate.
- **Auth is the gate for everything.** Google sign-in; the whole app sits behind a login wall (`LoginGate`) and then a `MembershipGate`. Access control is a **dynamic email allowlist in the `members` collection**, enforced by `firestore.rules` via `exists(/members/$(email.lower()))`. One **owner email is hardcoded** in the rules (`ownerEmail()`) as the bootstrap superadmin (the collection starts empty). Members manage the allowlist from **Settings → Members** — flat model, any member can add/remove others. `MembershipGate` shows an "Access pending" screen to signed-in non-members (UX only; rules are the real enforcement). The local emulator uses open dev rules (`firestore.dev.rules`).
- **All collections are shared**, not per-user — every allowlisted user sees the same data.
- **Snapshot-on-write is the core data-integrity rule.** A checkout copies each line's `name` and `price` into the checkout document at save time. Past checkouts and exports must stay accurate even after an item is renamed, repriced, or deleted — which is why items can be hard-deleted freely. Never resolve historical checkout display/export values by looking up the current item.

### Data model (Firestore, shared top-level collections)

- `categories/{id}` → `{ name, icon }`
- `items/{id}` → `{ name, icon, price, categoryId }`
- `checkouts/{id}` → `{ createdAt: Timestamp, total, lines: [{ itemId, name, price, quantity }] }`
- `members/{emailLower}` → `{ addedBy, addedAt }` — the dynamic allowlist (doc id is the lowercased email so rules can `exists()`-check it).

### Page behaviors that aren't obvious from the UI

- **Quick Add**: counters are **local in-memory state** until Save. The bottom bar shows the running price total. Save writes **one** checkout document with the current `{item, quantity}` lines, then resets the counters. (Checkout CRUD in Settings edits/deletes these past batches.)
- **Overview**: shows the **current calendar month** — one column per day (weekday + date header), items grouped by category as rows. Each cell sums that item's `quantity` across all checkouts on that day. Has prev/next month navigation.
- **Export**: date range defaults to **Jan 1 of the current year → now**. CSV rows are `name;quantity;ISO-date` using the checkout date, one row per checkout line. Generated entirely in the browser.

## Planned tech stack

Vite + React + TypeScript (no create-react-app) · React Router (the 4 pages) · Firebase Web SDK (Auth + Firestore) behind a thin typed data layer · TanStack Query (caching + optimistic updates) · Tailwind CSS · Framer Motion (Quick Add increment animation) · Vitest + React Testing Library (run against the Firebase Emulator Suite).

## Development & tooling

- **Local dev runs under podman compose**: one service for the Vite dev server, another for the Firebase Emulator Suite (Auth + Firestore). Development is fully local — no production Firebase project is required.
- **Tests run against the Firebase Emulator**, not a live project.
- **CI/CD (GitHub Actions)**: on push to `main` → install, lint, test (against the emulator), build, then deploy **Hosting + Firestore rules** using the `FIREBASE_SERVICE_ACCOUNT` secret.

> Once `package.json` and the compose/CI files exist, replace this section with the exact commands (dev server, single-test invocation, lint, build, emulator startup).
