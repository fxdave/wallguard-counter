I need a website using firebase it should be free to host. Everything should be
behind auth. The website should use react CSR. Build it from scratch (vite
etc..), (no bloated create-react-app). Everything should be automated. Github
CICD should deploy it. And the development environment should be based on podman
compose.

This website is a Counter. It can count different kind of items. The items can
have a name, icon, price, category. A category can have a name, icon.

Settings page:

- CRUD is required for: items, categories, checkouts

Quick add page:

- list of categories for each category:
  - list of items in a grid for each item:
    - small card, minus sign on the left, plus sign on the right. In the middle
      there should be the number with nice animation on increment. The name and
      price if it's not 0. The background should be vibrant when it has bigger
      than 0 in its counter.
- affixed to the page bottom there should be a save button with price summary.

Overview page:

- it should show the items grouped by categories in a table view, each item in a
  separate row with name and icon in the side header, and dates with weekdays at
  top. Compact design. and in the cells it should show the number.

Export page:

- it should have date range selector with defaulting to the actual year
  beginning and to now.
- On pressing export button, it should start a download of a CSV file having all
  item transactions with dates like:		apple;2;2026-01-01T00:00:00
- the date is the checkout date.

---

# Refinement (design decisions)

Decisions made while brainstorming the spec above. The section above is the
source of truth for intent; this section pins down the ambiguous parts.

## Architecture

- **Fully client-side SPA, no backend.** Free hosting rules out Cloud Functions
  (those require the Blaze billing plan), so all logic lives in the client and
  in Firestore Security Rules.
- **Firebase Hosting** serves the static build (free Spark plan).
- **Firestore** is the database (chosen over Realtime Database for structured
  date-range / grouping queries needed by Overview and Export).
- CSV export is generated in the browser.

## Tech stack

- **Vite + React + TypeScript** (no create-react-app).
- **React Router** for the four pages (Quick Add, Overview, Export, Settings).
- **Firebase Web SDK** (Auth + Firestore) behind a thin typed data layer.
- **TanStack Query** for caching and optimistic updates.
- **Tailwind CSS** for styling (vibrant cards, compact tables).
- **Framer Motion** for the increment number animation.
- **Vitest + React Testing Library** for tests, run against the Firebase
  Emulator Suite.

## Auth & security

- **Google sign-in.** The whole app is gated behind a login wall.
- **Small allowlist of users sharing the same data** (household-style). The
  allowlist is a set of emails **hard-coded in `firestore.rules`**
  (version-controlled, deployed by CI; adding a member = edit rules + push, no
  admin UI).
- All collections are **shared** (not per-user). Rules allow read/write only
  when `request.auth.token.email` is in the allowlist.

## Data model (Firestore, shared top-level collections)

- `categories/{id}` → `{ name, icon }`
- `items/{id}` → `{ name, icon, price, categoryId }`
- `checkouts/{id}` → `{ createdAt: Timestamp, total, lines: [...] }`
  - Each line: `{ itemId, name, price, quantity }`.
  - **`name` and `price` are snapshotted** into the line at save time, so past
    checkouts and exports stay accurate even if the item is later renamed,
    repriced, or deleted. Items can therefore be hard-deleted freely.

## Behavior details

- **Checkout = batch snapshot.** Pressing Save on Quick Add writes **one**
  `checkout` document containing the current `{item, quantity}` lines, then
  resets the counters. CRUD for checkouts (Settings) edits/deletes these past
  batches.
- **Quick Add counters** are local in-memory state until Save; the bottom bar
  shows the running price total.
- **Overview** shows the **current calendar month**: every day of the month is
  a column (weekday + date header), items grouped by category as rows. Each
  cell sums that item's `quantity` across all checkouts on that day. Prev/next
  month navigation.
- **Export** date range defaults to **Jan 1 of the current year → now**. CSV
  rows are `name;quantity;ISO-date` (checkout date), one row per checkout line.

## Tooling / automation

- **Dev environment via podman compose:** one service runs the Vite dev server,
  another runs the Firebase Emulator Suite (Auth + Firestore). Fully local — no
  production Firebase project needed for development.
- **CI/CD (GitHub Actions):** on push to `main` → install, lint, test (against
  the emulator), build, then deploy **Hosting + Firestore rules** using a
  `FIREBASE_SERVICE_ACCOUNT` secret.
