# Multi-Feature Design — 2026-06-10

## Scope

Seven independent feature areas to be implemented together:

1. Makefile (install / start / import-prod-db)
2. Email/password login
3. Firestore migration infrastructure
4. Category & item ordering
5. Pass enhancements (expiry expression, usage count, holder CRUD, delete protection)
6. Shared DateField component (YYYY-MM-DD text inputs)
7. Birthday input already correct — no change needed

---

## 1. Makefile

Three targets:

```makefile
install:
	podman compose build

start:
	podman compose up

import-prod-db:
	node scripts/import-prod-db.mjs
```

`scripts/import-prod-db.mjs`:
- Reads `FIREBASE_SERVICE_ACCOUNT` (JSON string) and `FIREBASE_PROJECT_ID` from env vars.
- Initialises two Admin SDK instances: one pointed at prod, one at the local emulator (`localhost:8080`).
- Iterates all collections: `categories`, `items`, `checkouts`, `members`, `passHolders`, `_migrations`.
- For each collection: deletes all emulator docs, then writes all prod docs (preserving document IDs and data).

---

## 2. Email/Password Login

### UI

`LoginGate` gains a "Sign in with email" button **above** the Google button. Clicking it expands an inline form:

- Email field
- Password field
- "Sign in" button
- "Back" link to collapse the form

Google button remains below, always visible. No tabs, no separate page, no account creation UI.

### Auth layer

`AuthContext` / `context.ts` gains `signInWithEmail(email: string, password: string): Promise<void>`.

Implementation uses `signInWithEmailAndPassword` from `firebase/auth`. Firebase errors (wrong password, user not found, etc.) are caught and shown inline in the form.

### Membership gate

Unchanged. An email/password account that is not in the `members` allowlist will authenticate successfully but hit the "Access pending" screen — same behaviour as Google accounts.

---

## 3. Firestore Migration Infrastructure

### File structure

```
migrations/
  001_add_order.mjs
  002_add_usage_count_and_started_at_to_pass_holders.mjs
scripts/
  migrate.mjs
```

### Runner (`scripts/migrate.mjs`)

1. Reads `FIREBASE_SERVICE_ACCOUNT` env var, parses JSON, initialises Admin SDK via `admin.credential.cert(...)`. No temp files.
2. Reads the `_migrations` Firestore collection to determine which migration IDs have already been applied.
3. Discovers all `migrations/*.mjs` files, sorts them numerically.
4. Runs each pending migration in order, passing the `db` instance.
5. On success writes `{ appliedAt: FieldValue.serverTimestamp() }` to `_migrations/{scriptId}`.
6. Exits with code 1 on any failure — aborts CI/CD.

### Migration scripts

**`001_add_order.mjs`**
- Reads all categories, sorts by `name`, writes `order: 1000, 2000, 3000…` back.
- Reads all items, sorts by `name`, writes `order: 1000, 2000, 3000…` back.

**`002_add_usage_count_and_started_at_to_pass_holders.mjs`**
- Reads all passHolders.
- For each: sets `usageCount: 0` (if absent) and `startedAt` derived from `createdAt` timestamp converted to `YYYY-MM-DD` (if absent).

### CI/CD

`.github/workflows/deploy.yml` gains a step before `firebase deploy`:

```yaml
- name: Run Firestore migrations
  run: node scripts/migrate.mjs
  env:
    FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
    FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
```

### Testing

A Vitest integration test (`src/lib/migrations.test.ts`) runs against the Firebase emulator:
- Seeds pre-migration data (categories/items without `order`, passHolders without `usageCount`/`startedAt`).
- Imports and runs each migration script directly.
- Asserts the expected fields are present and correct on all documents.

---

## 4. Category & Item Ordering

### Data model

- `Category` gains `order: number`.
- `Item` gains `order: number`.

### Queries

Replace `orderBy('name')` with `orderBy('order')` in `listCategories` and `listItems` in `firestore.ts`. All read pages (Quick Add grid, Overview rows) automatically respect order.

### UI — Settings

`CategoriesSection` and `ItemsSection` in Settings wrap their lists with `@dnd-kit/core` + `@dnd-kit/sortable`.

Each row gets a drag handle icon (visible on hover/touch). On drag-drop end, **all** items in the list are reassigned `order` values as `1000, 2000, 3000…` in the new sequence. All writes are batched (Firestore `writeBatch`).

No reordering UI on read pages (Quick Add, Overview, Export) — they consume order only.

---

## 5. Pass Enhancements

### Data model changes

**`Item`** (when `isPass: true`):
- `canExpire: boolean` — whether holders of this pass can expire.
- `expiryExpression?: string` — JS expression string, present only when `canExpire` is true.

**`PassHolder`** gains:
- `usageCount: number` — incremented atomically on each checkout save.
- `startedAt: string` — YYYY-MM-DD, entered at registration, defaults to today.

### Item edit form

When `isPass` is checked, the item edit form shows:
- `canExpire` checkbox.
- `expiryExpression` textarea (only when `canExpire` is checked), with placeholder examples:
  - 30-day pass: `new Date(holder.startedAt) < new Date(today - 30 * 86400000)`
  - Expire 1st of next month: `today >= new Date(new Date(holder.startedAt).getFullYear(), new Date(holder.startedAt).getMonth() + 1, 1)`
  - Combined 30 days or 10 usages: `holder.usageCount >= 10 || new Date(holder.startedAt) < new Date(today - 30 * 86400000)`
- "Pass Holders" section (see below).

### Pass holder CRUD in item edit

A "Pass Holders" section appears below the item fields when editing an existing pass item.

- Lists all holders: name, birthday, startedAt, usageCount. Edit and delete buttons per row.
- Inline add form: name (text), birthday (DateField), startedAt (DateField, defaults to today).
- **Delete a holder:** always allowed from Settings.
- **Delete the pass item itself:** blocked if any passHolders exist for that `passItemId`. Show inline error: "Remove all pass holders before deleting this item."

### Usage count increment

In `QuickAdd`, when saving a checkout, for each pass line where `isNew === false` (existing holder), call `updateDoc` with `{ usageCount: increment(1) }` using Firestore's atomic increment. Batched with the checkout write.

### Validity check in PassModal (Quick Add)

When the user selects an existing holder:

1. If `item.canExpire` is false (or `expiryExpression` is absent): skip check, add free.
2. Otherwise evaluate: `new Function('holder', 'today', \`return (${item.expiryExpression})\`)(holder, new Date())`.
3. If result is `true`: show `ConfirmDialog` — *"This pass is expired or over its limit. Add at full price (X)?"*
   - Confirm → add at `item.price` (full price).
   - Cancel → do nothing.
4. If result is `false`: add free as normal.

Expression evaluation errors (syntax errors etc.) are caught; on error the check is treated as `false` (pass valid) and a console warning is emitted.

### startedAt in QuickAdd

When registering a **new** holder in PassModal, `startedAt` is set silently to today's date (`new Date().toISOString().slice(0, 10)`). No input shown in QuickAdd — the date input only appears in the Settings pass holder CRUD.

---

## 6. Shared DateField Component

New component `src/components/ui/DateField.tsx`:
- Wraps `TextField` with `type="text"`, `placeholder="YYYY-MM-DD"`, `pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"`, `inputMode="numeric"`.
- Validates on blur: if value is non-empty and doesn't match `YYYY-MM-DD`, shows inline error "Use YYYY-MM-DD format."
- Used for: `birthday` and `startedAt` in pass holder forms, `maxUsageDate` if added in future.

The existing `type="date"` birthday input in `PassModal` is replaced with `DateField`.

---

## Data Model Summary (TypeScript)

```ts
interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;            // NEW
}

interface Item {
  id: string;
  name: string;
  icon: string;
  price: number;
  categoryId: string;
  isPass?: boolean;
  order: number;            // NEW
  canExpire?: boolean;      // NEW (pass only)
  expiryExpression?: string; // NEW (pass only, when canExpire)
}

interface PassHolder {
  id: string;
  name: string;
  birthday: string;         // YYYY-MM-DD
  passItemId: string;
  createdAt: Timestamp;
  startedAt: string;        // NEW — YYYY-MM-DD
  usageCount: number;       // NEW
}
```

---

## Out of Scope

- Expiry expression sandboxing / security — this is a trusted household app, `new Function` is acceptable.
- Per-holder expiry dates — all expiry logic lives in the item-level expression.
- Removing Google sign-in — both auth methods coexist.
- Account creation UI — new users are added via the members allowlist only.
