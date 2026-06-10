# Migrations & Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Firestore migration infrastructure (numbered `.mjs` scripts run by a Node.js runner before each CI/CD deploy), and add drag-and-drop ordering for categories and items in Settings using `@dnd-kit`.

**Architecture:** Migration runner reads `_migrations` Firestore collection to skip already-applied scripts. Each migration receives a `db` instance (firebase-admin Firestore). Order is stored as a `number` field on each doc (`1000, 2000, 3000…`); on drag-drop all items in the list are renumbered via a batched write.

**Tech Stack:** `firebase-admin` (migration runner), `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (drag-and-drop UI).

**Note:** This plan also adds ALL type changes for the pass enhancements plan (`canExpire`, `expiryExpression` on Item; `startedAt`, `usageCount` on PassHolder) since those plans run after this one. The pass plan depends on these types already being in place.

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install firebase-admin (if not already present) and dnd-kit**

```bash
cd /home/arch/wallguard-counter && npm install --save-dev firebase-admin && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Verify**

```bash
node -e "import('firebase-admin').then(() => console.log('ok'))" && grep '@dnd-kit' package.json
```

Expected: `ok` then lines showing the three `@dnd-kit` packages.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add firebase-admin and @dnd-kit dependencies"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/lib/types.ts`

This task adds ALL new fields for both ordering AND pass enhancements (so dependent plans don't have to modify types.ts):
- `Category.order: number`
- `Item.order: number`, `Item.canExpire?: boolean`, `Item.expiryExpression?: string`
- `PassHolder.startedAt: string`, `PassHolder.usageCount: number`

- [ ] **Step 1: Read current types.ts**

Read `/home/arch/wallguard-counter/src/lib/types.ts`.

- [ ] **Step 2: Write updated types.ts**

Replace the full content of `src/lib/types.ts`:

```ts
import type { Timestamp } from 'firebase/firestore';

/** A grouping of items, e.g. "Drinks" or "Snacks". */
export interface Category {
  id: string;
  name: string;
  /** Emoji or short icon string shown next to the category. */
  icon: string;
  /** Display order; lower numbers appear first. Multiples of 1000. */
  order: number;
}

/** A countable thing with a price, belonging to a category. */
export interface Item {
  id: string;
  name: string;
  icon: string;
  /** Unit price. `0` means "free / don't show price". */
  price: number;
  categoryId: string;
  /** Display order; lower numbers appear first. Multiples of 1000. */
  order: number;
  /**
   * When true this item is a "pass": adding it in Quick Add opens a search of
   * its pass holders. A known holder counts at price 0; an unknown person is
   * registered and counted at `price`. Absent/false for normal items.
   */
  isPass?: boolean;
  /** When true, pass holders of this item can expire. Pass items only. */
  canExpire?: boolean;
  /**
   * JS expression string evaluated to check if a holder is expired/over-limit.
   * Receives `holder` (PassHolder) and `today` (Date). Returns `true` if invalid.
   * Example: `holder.usageCount >= 10 || new Date(holder.startedAt) < new Date(today - 30 * 86400000)`
   * Only meaningful when `canExpire` is true.
   */
  expiryExpression?: string;
}

/**
 * A person who holds a given pass. Scoped to one pass item via `passItemId`, so
 * holding the gym pass doesn't imply holding the pool pass. Searched by name +
 * birthday in the Quick Add pass modal.
 */
export interface PassHolder {
  id: string;
  name: string;
  /** `YYYY-MM-DD` (date-input value). */
  birthday: string;
  /** `YYYY-MM-DD` — when the pass was activated. Defaults to registration date. */
  startedAt: string;
  /** The pass item (`Item.id`, where `isPass`) this holder belongs to. */
  passItemId: string;
  createdAt: Timestamp;
  /** Number of times this holder has been counted in a checkout. */
  usageCount: number;
}

export type PassHolderInput = Omit<PassHolder, 'id' | 'createdAt'>;

/**
 * One line within a checkout. `name` and `price` are SNAPSHOTTED at save time
 * so historical checkouts and exports stay correct even if the item is later
 * renamed, repriced, or hard-deleted. Never re-resolve these from the live item.
 */
export interface CheckoutLine {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  /** For pass entries: the person this line was counted for (snapshotted). */
  holderName?: string;
  /** For pass entries: the person's birthday (`YYYY-MM-DD`), snapshotted. */
  holderBirthday?: string;
}

/** A batch counting session saved from the Quick Add page. */
export interface Checkout {
  id: string;
  createdAt: Timestamp;
  /** Sum of `price * quantity` across all lines, snapshotted at save time. */
  total: number;
  lines: CheckoutLine[];
}

/**
 * An eligible user. The document id is the member's lowercased email, so rules
 * can gate access with a cheap `exists(/members/$(email))` check. The bootstrap
 * owner (hardcoded in firestore.rules) has access without a document.
 */
export interface Member {
  /** Lowercased email — also the Firestore document id. */
  email: string;
  /** Email of the member who added this one (or "owner" when seeded). */
  addedBy: string;
  addedAt: Timestamp;
}

/** Payloads for create/update — the `id` is assigned by Firestore. */
export type CategoryInput = Omit<Category, 'id'>;
export type ItemInput = Omit<Item, 'id'>;
export type CheckoutInput = Omit<Checkout, 'id'>;
```

- [ ] **Step 3: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -20
```

Expected: TypeScript errors about missing `order` / `startedAt` / `usageCount` fields where they're now required — these will be fixed in subsequent tasks. It's OK to have errors here; track them.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add order, canExpire, expiryExpression, startedAt, usageCount to types"
```

---

### Task 3: Update firestore.ts for ordering

**Files:**
- Modify: `src/lib/firestore.ts`

- [ ] **Step 1: Read current firestore.ts**

Read `/home/arch/wallguard-counter/src/lib/firestore.ts`.

- [ ] **Step 2: Update listCategories to order by `order` field**

Replace the `listCategories` function:

```ts
export async function listCategories(): Promise<Category[]> {
  const snap = await getDocs(query(categoriesCol, orderBy('order')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryInput) }));
}
```

- [ ] **Step 3: Update createCategory to accept and store order**

The `CategoryInput` type now includes `order`. No change needed to the function signature — callers must now include `order` in the input. The function body stays the same:

```ts
export async function createCategory(input: CategoryInput): Promise<string> {
  const ref = await addDoc(categoriesCol, input);
  return ref.id;
}
```

- [ ] **Step 4: Add reorderCategories batch function**

Add after `deleteCategory`:

```ts
/** Reassigns order values (1000, 2000, 3000…) for all categories in the given sequence. */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(categoriesCol, id), { order: (index + 1) * 1000 });
  });
  await batch.commit();
}
```

- [ ] **Step 5: Update listItems to order by `order` field**

Replace the `listItems` function:

```ts
export async function listItems(): Promise<Item[]> {
  const snap = await getDocs(query(itemsCol, orderBy('order')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ItemInput) }));
}
```

- [ ] **Step 6: Add reorderItems batch function**

Add after `deleteItem`:

```ts
/** Reassigns order values (1000, 2000, 3000…) for all items in the given sequence. */
export async function reorderItems(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(itemsCol, id), { order: (index + 1) * 1000 });
  });
  await batch.commit();
}
```

- [ ] **Step 7: Add writeBatch to imports**

Make sure `writeBatch` is imported from `firebase/firestore` at the top of the file. The import line should include it:

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  type QueryConstraint,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
```

- [ ] **Step 8: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | grep -v "types.ts" | tail -20
```

Expected: errors should only be about callers not yet passing `order`. These are fixed in subsequent tasks.

- [ ] **Step 9: Commit**

```bash
git add src/lib/firestore.ts
git commit -m "feat: add order-based sorting and batch reorder functions to firestore layer"
```

---

### Task 4: Update queries.ts with reorder mutations

**Files:**
- Modify: `src/lib/queries.ts`

- [ ] **Step 1: Read current queries.ts**

Read `/home/arch/wallguard-counter/src/lib/queries.ts`.

- [ ] **Step 2: Add reorderCategories and reorderItems imports**

Add `reorderCategories` and `reorderItems` to the imports from `./firestore`.

- [ ] **Step 3: Add reorder mutation to useCategoryMutations**

Replace `useCategoryMutations`:

```ts
export function useCategoryMutations() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: queryKeys.categories });

  return {
    create: useMutation({ mutationFn: createCategory, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) =>
        updateCategory(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteCategory, onSuccess: invalidate }),
    reorder: useMutation({
      mutationFn: (orderedIds: string[]) => reorderCategories(orderedIds),
      onSuccess: invalidate,
    }),
  };
}
```

- [ ] **Step 4: Add reorder mutation to useItemMutations**

Replace `useItemMutations`:

```ts
export function useItemMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.items });

  return {
    create: useMutation({ mutationFn: createItem, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<ItemInput> }) =>
        updateItem(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteItem, onSuccess: invalidate }),
    reorder: useMutation({
      mutationFn: (orderedIds: string[]) => reorderItems(orderedIds),
      onSuccess: invalidate,
    }),
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add reorder mutations for categories and items"
```

---

### Task 5: Add drag-and-drop to CategoriesSection

**Files:**
- Modify: `src/pages/settings/CategoriesSection.tsx`

- [ ] **Step 1: Read current CategoriesSection.tsx**

Read `/home/arch/wallguard-counter/src/pages/settings/CategoriesSection.tsx`.

- [ ] **Step 2: Update CategoriesSection with drag-and-drop and order in create**

Replace the full file content:

```tsx
import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextField, IconField } from '../../components/ui/Field';
import { useCategories, useCategoryMutations } from '../../lib/queries';
import type { Category } from '../../lib/types';

interface CategoryFormState {
  name: string;
  icon: string;
}

const emptyForm = (): CategoryFormState => ({ name: '', icon: '' });

type ModalMode =
  | { type: 'closed' }
  | { type: 'add' }
  | { type: 'edit'; category: Category };

type DeleteState = { open: false } | { open: true; category: Category };

function SortableRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.05] transition"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-white/20 hover:text-white/60 transition select-none"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <span className="text-2xl leading-none">{category.icon || '·'}</span>
      <span className="flex-1 text-sm font-medium">{category.name}</span>
      <Button variant="subtle" className="!px-2 !py-1 text-xs" onClick={onEdit}>
        Edit
      </Button>
      <Button variant="danger" className="!px-2 !py-1 text-xs" onClick={onDelete}>
        Delete
      </Button>
    </li>
  );
}

export function CategoriesSection() {
  const { data: categories = [], isLoading } = useCategories();
  const { create, update, remove, reorder } = useCategoryMutations();

  const [modal, setModal] = useState<ModalMode>({ type: 'closed' });
  const [form, setForm] = useState<CategoryFormState>(emptyForm());
  const [error, setError] = useState('');
  const [deleteState, setDeleteState] = useState<DeleteState>({ open: false });

  const sensors = useSensors(useSensor(PointerSensor));

  function openAdd() {
    setForm(emptyForm());
    setError('');
    setModal({ type: 'add' });
  }

  function openEdit(cat: Category) {
    setForm({ name: cat.name, icon: cat.icon });
    setError('');
    setModal({ type: 'edit', category: cat });
  }

  function closeModal() {
    setModal({ type: 'closed' });
    setError('');
  }

  async function handleSave() {
    const name = form.name.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    const nextOrder = (categories[categories.length - 1]?.order ?? 0) + 1000;
    const input = { name, icon: form.icon.trim(), order: nextOrder };

    if (modal.type === 'add') {
      await create.mutateAsync(input);
    } else if (modal.type === 'edit') {
      await update.mutateAsync({ id: modal.category.id, input });
    }
    closeModal();
  }

  async function handleDelete() {
    if (!deleteState.open) return;
    await remove.mutateAsync(deleteState.category.id);
    setDeleteState({ open: false });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...categories];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    reorder.mutate(reordered.map((c) => c.id));
  }

  const isSaving = create.isPending || update.isPending;
  const isDeleting = remove.isPending;
  const isOpen = modal.type !== 'closed';

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Categories</h2>
          <p className="mt-0.5 text-sm text-white/40">Groupings shown on Quick Add.</p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          + Add category
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-white/30">Loading…</div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
          <p className="text-sm text-white/40">No categories yet — add one to get started.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {categories.map((cat) => (
                  <SortableRow
                    key={cat.id}
                    category={cat}
                    onEdit={() => openEdit(cat)}
                    onDelete={() => setDeleteState({ open: true, category: cat })}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Modal
        open={isOpen}
        onClose={closeModal}
        title={modal.type === 'add' ? 'Add category' : 'Edit category'}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setError(''); }}
            placeholder="e.g. Drinks"
            autoFocus
          />
          <IconField
            label="Icon"
            value={form.icon}
            onChange={(v) => setForm((f) => ({ ...f, icon: v }))}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteState.open}
        title="Delete category"
        message={
          deleteState.open
            ? `Delete "${deleteState.category.name}"? Items in this category will lose their grouping.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteState({ open: false })}
        busy={isDeleting}
      />
    </section>
  );
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/settings/CategoriesSection.tsx
git commit -m "feat: add drag-and-drop ordering to CategoriesSection"
```

---

### Task 6: Add drag-and-drop to ItemsSection

**Files:**
- Modify: `src/pages/settings/ItemsSection.tsx`

- [ ] **Step 1: Read current ItemsSection.tsx**

Read `/home/arch/wallguard-counter/src/pages/settings/ItemsSection.tsx`.

- [ ] **Step 2: Add dnd-kit imports and SortableRow component**

At the top of the file, add these imports after the existing ones:

```tsx
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

Add a `SortableItemRow` component before `ItemsSection` (add it after the `DeleteState` type definition):

```tsx
function SortableItemRow({
  item,
  catLabel,
  onEdit,
  onDelete,
}: {
  item: Item;
  catLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.05] transition"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-white/20 hover:text-white/60 transition select-none"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <span className="text-2xl leading-none">{item.icon || '·'}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{item.name}</span>
          {item.isPass && (
            <span className="shrink-0 rounded-md bg-lime-300/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-300">
              Pass
            </span>
          )}
        </span>
        <span className="block text-xs text-white/40 truncate">{catLabel}</span>
      </span>
      <Button variant="subtle" className="!px-2 !py-1 text-xs" onClick={onEdit}>
        Edit
      </Button>
      <Button variant="danger" className="!px-2 !py-1 text-xs" onClick={onDelete}>
        Delete
      </Button>
    </li>
  );
}
```

- [ ] **Step 3: Add reorder to mutation destructuring and sensors**

In `ItemsSection`, update the mutation destructuring:
```tsx
const { create, update, remove, reorder } = useItemMutations();
```

Add sensors state after the other `useState` declarations:
```tsx
const sensors = useSensors(useSensor(PointerSensor));
```

- [ ] **Step 4: Update handleSave to include order for new items**

In the `handleSave` function, update the input construction:

```tsx
const input = {
  name: form.name.trim(),
  icon: form.icon.trim(),
  price: parseFloat(form.price) || 0,
  categoryId: form.categoryId,
  isPass: form.isPass,
  order: modal.type === 'add'
    ? (items[items.length - 1]?.order ?? 0) + 1000
    : (modal.type === 'edit' ? modal.item.order : 1000),
};
```

- [ ] **Step 5: Add handleDragEnd**

Add this function before the return statement:

```tsx
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const oldIndex = items.findIndex((i) => i.id === active.id);
  const newIndex = items.findIndex((i) => i.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return;

  const reordered = [...items];
  const [moved] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, moved);

  reorder.mutate(reordered.map((i) => i.id));
}
```

- [ ] **Step 6: Wrap the items list with DndContext and replace motion.li with SortableItemRow**

Replace the items list rendering (the `<ul className="space-y-1.5">` block inside the non-loading/non-empty branch) with:

```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
    <ul className="space-y-1.5">
      {items.map((item) => {
        const cat = categoryMap.get(item.categoryId);
        const catLabel = [
          cat ? `${cat.icon || ''} ${cat.name}`.trim() : 'Unknown category',
          item.price > 0 ? formatPrice(item.price) : '',
        ].filter(Boolean).join(' · ');
        return (
          <SortableItemRow
            key={item.id}
            item={item}
            catLabel={catLabel}
            onEdit={() => openEdit(item)}
            onDelete={() => setDeleteState({ open: true, item })}
          />
        );
      })}
    </ul>
  </SortableContext>
</DndContext>
```

- [ ] **Step 7: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -10
```

- [ ] **Step 8: Commit**

```bash
git add src/pages/settings/ItemsSection.tsx
git commit -m "feat: add drag-and-drop ordering to ItemsSection"
```

---

### Task 7: Write migration runner

**Files:**
- Create: `scripts/migrate.mjs`

- [ ] **Step 1: Create the runner**

Create `/home/arch/wallguard-counter/scripts/migrate.mjs`:

```js
/**
 * Firestore migration runner.
 *
 * Reads FIREBASE_SERVICE_ACCOUNT (JSON string) and FIREBASE_PROJECT_ID from env.
 * Discovers all migrations/*.mjs files, runs pending ones in order, and records
 * each applied migration in the `_migrations` Firestore collection.
 *
 * Usage (prod):
 *   FIREBASE_SERVICE_ACCOUNT="..." FIREBASE_PROJECT_ID="wallguard-counter" \
 *   node scripts/migrate.mjs
 *
 * Usage (emulator, for testing):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_SERVICE_ACCOUNT='{"project_id":"demo-wallguard","type":"service_account","private_key":"x","client_email":"x@x.x"}' \
 *   FIREBASE_PROJECT_ID=demo-wallguard \
 *   node scripts/migrate.mjs
 */

import admin from 'firebase-admin';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}');
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('FIREBASE_PROJECT_ID must be set.');
  process.exit(1);
}

let credential;
// When using the emulator with a fake SA, cert() will fail — fall back to
// application default (which the emulator accepts without validation).
try {
  credential = admin.credential.cert(sa);
} catch {
  credential = admin.credential.applicationDefault();
}

admin.initializeApp({ credential, projectId });
const db = admin.firestore();

const migrationsDir = join(process.cwd(), 'migrations');
let files;
try {
  files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.mjs'))
    .sort();
} catch {
  console.log('No migrations directory found — nothing to run.');
  process.exit(0);
}

if (files.length === 0) {
  console.log('No migration files found — nothing to run.');
  process.exit(0);
}

const appliedSnap = await db.collection('_migrations').get();
const applied = new Set(appliedSnap.docs.map((d) => d.id));

let ran = 0;
for (const file of files) {
  const id = file.replace('.mjs', '');
  if (applied.has(id)) {
    console.log(`  skip  ${id}`);
    continue;
  }
  console.log(`  run   ${id} …`);
  const { run } = await import(pathToFileURL(join(migrationsDir, file)).href);
  await run(db);
  await db
    .collection('_migrations')
    .doc(id)
    .set({ appliedAt: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`  done  ${id}`);
  ran++;
}

console.log(`\n${ran} migration(s) applied.`);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate.mjs
git commit -m "feat: add Firestore migration runner"
```

---

### Task 8: Write migration 001 (add order)

**Files:**
- Create: `migrations/001_add_order.mjs`

- [ ] **Step 1: Create the migrations directory and migration file**

```bash
mkdir -p /home/arch/wallguard-counter/migrations
```

Create `/home/arch/wallguard-counter/migrations/001_add_order.mjs`:

```js
/**
 * Backfills `order` (1000, 2000, …) on all categories and items, sorted by
 * their current `name` field so the visible order doesn't change on first run.
 */

export async function run(db) {
  // Categories
  const catsSnap = await db.collection('categories').get();
  if (catsSnap.size > 0) {
    const sorted = catsSnap.docs.sort((a, b) =>
      (a.data().name ?? '').localeCompare(b.data().name ?? ''),
    );
    const batch = db.batch();
    sorted.forEach((docSnap, i) => {
      batch.update(docSnap.ref, { order: (i + 1) * 1000 });
    });
    await batch.commit();
    console.log(`    categories: ${sorted.length} updated`);
  }

  // Items
  const itemsSnap = await db.collection('items').get();
  if (itemsSnap.size > 0) {
    const sorted = itemsSnap.docs.sort((a, b) =>
      (a.data().name ?? '').localeCompare(b.data().name ?? ''),
    );
    const batch = db.batch();
    sorted.forEach((docSnap, i) => {
      batch.update(docSnap.ref, { order: (i + 1) * 1000 });
    });
    await batch.commit();
    console.log(`    items: ${sorted.length} updated`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add migrations/001_add_order.mjs
git commit -m "feat: migration 001 — backfill order on categories and items"
```

---

### Task 9: Write and run migration tests

**Files:**
- Create: `src/lib/migrations.test.ts`

- [ ] **Step 1: Write the test file**

Create `/home/arch/wallguard-counter/src/lib/migrations.test.ts`:

```ts
/**
 * Integration tests for migration scripts.
 * Runs against the Firebase Emulator (must be running on localhost:8080).
 * The emulator uses open dev rules, so no auth is needed for Admin SDK access.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  connectAuthEmulator,
  getAuth,
} from 'firebase/firestore';

// Use the Admin SDK pointed at the emulator via env var
// FIRESTORE_EMULATOR_HOST must be set (done by the emulators:exec wrapper).
import admin from 'firebase-admin';

function getAdminDb() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'demo-wallguard' });
  }
  return admin.firestore();
}

async function clearCollection(db: admin.firestore.Firestore, col: string) {
  const snap = await db.collection(col).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

describe('migration 001: add_order', () => {
  it('backfills order on categories and items sorted by name', async () => {
    const db = getAdminDb();

    // Clear and seed
    await clearCollection(db, 'categories');
    await clearCollection(db, 'items');
    await clearCollection(db, '_migrations');

    await db.collection('categories').add({ name: 'Zebra', icon: '🦓' });
    await db.collection('categories').add({ name: 'Apple', icon: '🍎' });
    await db.collection('categories').add({ name: 'Mango', icon: '🥭' });

    await db.collection('items').add({ name: 'Water', icon: '💧', price: 1, categoryId: 'x' });
    await db.collection('items').add({ name: 'Juice', icon: '🧃', price: 2, categoryId: 'x' });

    // Run migration
    const { run } = await import('../../migrations/001_add_order.mjs' as string);
    await run(db);

    // Assert categories
    const cats = await db.collection('categories').orderBy('order').get();
    const catNames = cats.docs.map((d) => d.data().name);
    expect(catNames).toEqual(['Apple', 'Mango', 'Zebra']);
    const catOrders = cats.docs.map((d) => d.data().order);
    expect(catOrders).toEqual([1000, 2000, 3000]);

    // Assert items
    const its = await db.collection('items').orderBy('order').get();
    const itemNames = its.docs.map((d) => d.data().name);
    expect(itemNames).toEqual(['Juice', 'Water']);
    const itemOrders = its.docs.map((d) => d.data().order);
    expect(itemOrders).toEqual([1000, 2000]);
  });
});
```

- [ ] **Step 2: Run migrations tests against emulator**

```bash
cd /home/arch/wallguard-counter && npx firebase-tools emulators:exec --only auth,firestore -P demo-wallguard "npm run test -- migrations" 2>&1 | tail -20
```

Expected: the migration test passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/migrations.test.ts migrations/001_add_order.mjs
git commit -m "test: add migration 001 integration test"
```

---

### Task 10: Update CI/CD to run migrations before deploy

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Read current workflow**

Read `/home/arch/wallguard-counter/.github/workflows/deploy.yml`.

- [ ] **Step 2: Add migration step before firebase deploy**

In the `deploy` job, add a step between `npm ci` (or the build step) and the "Deploy to Firebase" step. Insert:

```yaml
      - name: Run Firestore migrations
        run: node scripts/migrate.mjs
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: run Firestore migrations before deploy"
```

---

### Task 11: Verify everything compiles and tests pass

- [ ] **Step 1: Full typecheck**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 2: Full test run**

```bash
cd /home/arch/wallguard-counter && npx firebase-tools emulators:exec --only auth,firestore -P demo-wallguard "npm run test" 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 3: Lint**

```bash
cd /home/arch/wallguard-counter && npm run lint 2>&1 | tail -10
```

Expected: no errors.
