# Pass Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the pass system with: shared `DateField` component (YYYY-MM-DD text inputs), pass holder CRUD in item edit, `usageCount` increment on checkout save, expiry expression evaluation in Quick Add, and a migration to backfill existing pass holders.

**Architecture:** All date inputs use a new `DateField` component. Pass holder management moves into the item edit modal (new "Pass Holders" section). Expiry is evaluated via `new Function` with `holder` and `today` in the Quick Add pass modal. `usageCount` is incremented atomically in Firestore on checkout save. Deleting a pass item is blocked if any pass holders exist.

**Tech Stack:** React, Firebase Firestore (`increment` from `firebase/firestore`), Vitest.

**IMPORTANT PREREQUISITE:** This plan depends on the types from the migrations-and-ordering plan. Make sure `src/lib/types.ts` already contains `PassHolder.startedAt`, `PassHolder.usageCount`, `Item.canExpire`, and `Item.expiryExpression` before starting. If not, run the migrations-and-ordering plan first.

---

### Task 1: Create the DateField component

**Files:**
- Create: `src/components/ui/DateField.tsx`

- [ ] **Step 1: Write DateField**

Create `/home/arch/wallguard-counter/src/components/ui/DateField.tsx`:

```tsx
import { useState, type InputHTMLAttributes } from 'react';
import { TextField } from './Field';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface DateFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'pattern' | 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * Text input for YYYY-MM-DD dates. Shows an inline validation error on blur
 * if the value doesn't match the expected format.
 */
export function DateField({ label, value, onChange, error: externalError, ...rest }: DateFieldProps) {
  const [touched, setTouched] = useState(false);

  const formatError =
    touched && value.length > 0 && !DATE_RE.test(value)
      ? 'Use YYYY-MM-DD format.'
      : null;

  const displayError = externalError ?? formatError;

  return (
    <div>
      <TextField
        label={label}
        type="text"
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        {...rest}
      />
      {displayError && (
        <p className="mt-1 text-xs text-red-400">{displayError}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/DateField.tsx
git commit -m "feat: add DateField component for YYYY-MM-DD text inputs"
```

---

### Task 2: Update firestore.ts with pass holder CRUD functions

**Files:**
- Modify: `src/lib/firestore.ts`

- [ ] **Step 1: Read current firestore.ts**

Read `/home/arch/wallguard-counter/src/lib/firestore.ts`.

- [ ] **Step 2: Add increment import**

Add `increment` to the firebase/firestore imports at the top:

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
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

- [ ] **Step 3: Add updatePassHolder, deletePassHolder, countPassHolders, incrementPassHolderUsage**

Add these functions after `createPassHolder`:

```ts
export async function updatePassHolder(
  id: string,
  input: Partial<Omit<PassHolder, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(passHoldersCol, id), input);
}

export async function deletePassHolder(id: string): Promise<void> {
  await deleteDoc(doc(passHoldersCol, id));
}

/** Returns the number of pass holders for a given pass item. */
export async function countPassHolders(passItemId: string): Promise<number> {
  const snap = await getDocs(
    query(passHoldersCol, where('passItemId', '==', passItemId)),
  );
  return snap.size;
}

/** Atomically increments usageCount on a pass holder. */
export async function incrementPassHolderUsage(id: string): Promise<void> {
  await updateDoc(doc(passHoldersCol, id), { usageCount: increment(1) });
}
```

- [ ] **Step 4: Update createPassHolder to include startedAt and usageCount defaults**

Replace `createPassHolder`:

```ts
export async function createPassHolder(input: PassHolderInput): Promise<string> {
  const ref = await addDoc(passHoldersCol, {
    ...input,
    usageCount: input.usageCount ?? 0,
    startedAt: input.startedAt ?? new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
```

- [ ] **Step 5: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/firestore.ts
git commit -m "feat: add updatePassHolder, deletePassHolder, countPassHolders, incrementPassHolderUsage"
```

---

### Task 3: Update queries.ts with full pass holder mutations

**Files:**
- Modify: `src/lib/queries.ts`

- [ ] **Step 1: Read current queries.ts**

Read `/home/arch/wallguard-counter/src/lib/queries.ts`.

- [ ] **Step 2: Add new firestore imports**

Add `updatePassHolder`, `deletePassHolder`, `countPassHolders`, `incrementPassHolderUsage` to the imports from `./firestore`.

- [ ] **Step 3: Replace usePassHolderMutations with full CRUD + usageCount increment**

Replace the existing `usePassHolderMutations`:

```ts
export function usePassHolderMutations(passItemId?: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: passItemId ? queryKeys.passHolders(passItemId) : ['passHolders'] });

  return {
    create: useMutation({
      mutationFn: createPassHolder,
      onSuccess: () => qc.invalidateQueries({ queryKey: ['passHolders'] }),
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updatePassHolder>[1] }) =>
        updatePassHolder(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: deletePassHolder,
      onSuccess: invalidate,
    }),
    incrementUsage: useMutation({
      mutationFn: incrementPassHolderUsage,
    }),
  };
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: expand usePassHolderMutations with update, remove, incrementUsage"
```

---

### Task 4: Update ItemsSection with pass enhancements

**Files:**
- Modify: `src/pages/settings/ItemsSection.tsx`

This task adds:
1. `canExpire` checkbox and `expiryExpression` textarea to the item form (shown when `isPass` is checked)
2. Pass Holders CRUD section in the item edit modal
3. Block item delete if pass holders exist

- [ ] **Step 1: Read current ItemsSection.tsx**

Read `/home/arch/wallguard-counter/src/pages/settings/ItemsSection.tsx`.

- [ ] **Step 2: Add new imports**

Add to the imports at the top of the file:

```tsx
import { DateField } from '../../components/ui/DateField';
import {
  usePassHolders,
  usePassHolderMutations,
} from '../../lib/queries';
import { countPassHolders } from '../../lib/firestore';
import type { PassHolder } from '../../lib/types';
```

- [ ] **Step 3: Extend ItemFormState**

Replace the `ItemFormState` interface:

```tsx
interface ItemFormState {
  name: string;
  icon: string;
  price: string;
  categoryId: string;
  isPass: boolean;
  canExpire: boolean;
  expiryExpression: string;
}
```

Update `emptyForm`:

```tsx
const emptyForm = (defaultCategoryId = ''): ItemFormState => ({
  name: '',
  icon: '',
  price: '0',
  categoryId: defaultCategoryId,
  isPass: false,
  canExpire: false,
  expiryExpression: '',
});
```

- [ ] **Step 4: Update openEdit to populate new fields**

Replace the `openEdit` function:

```tsx
function openEdit(item: Item) {
  setForm({
    name: item.name,
    icon: item.icon,
    price: String(item.price),
    categoryId: item.categoryId,
    isPass: item.isPass ?? false,
    canExpire: item.canExpire ?? false,
    expiryExpression: item.expiryExpression ?? '',
  });
  setErrors({});
  setModal({ type: 'edit', item });
}
```

- [ ] **Step 5: Update handleSave to include new fields**

Replace the `input` construction in `handleSave`:

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
  ...(form.isPass ? {
    canExpire: form.canExpire,
    expiryExpression: form.canExpire ? form.expiryExpression.trim() : '',
  } : {}),
};
```

- [ ] **Step 6: Update handleDelete to check for pass holders**

Replace `handleDelete`:

```tsx
async function handleDelete() {
  if (!deleteState.open) return;
  if (deleteState.item.isPass) {
    const holderCount = await countPassHolders(deleteState.item.id);
    if (holderCount > 0) {
      setDeleteState({ open: false });
      alert(`Remove all ${holderCount} pass holder(s) before deleting this item.`);
      return;
    }
  }
  await remove.mutateAsync(deleteState.item.id);
  setDeleteState({ open: false });
}
```

- [ ] **Step 7: Add PassHoldersSection component**

Add this component inside the file (before `ItemsSection`), which manages pass holders for a single pass item:

```tsx
function PassHoldersSection({ passItemId }: { passItemId: string }) {
  const { data: holders = [], isLoading } = usePassHolders(passItemId);
  const { create, update, remove } = usePassHolderMutations(passItemId);

  const today = new Date().toISOString().slice(0, 10);
  const [addForm, setAddForm] = useState({ name: '', birthday: '', startedAt: today });
  const [addError, setAddError] = useState('');
  const [editHolder, setEditHolder] = useState<PassHolder | null>(null);
  const [editForm, setEditForm] = useState({ name: '', birthday: '', startedAt: '' });

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.birthday || !addForm.startedAt) {
      setAddError('Name, birthday, and started date are required.');
      return;
    }
    await create.mutateAsync({
      name: addForm.name.trim(),
      birthday: addForm.birthday,
      startedAt: addForm.startedAt,
      passItemId,
      usageCount: 0,
    });
    setAddForm({ name: '', birthday: '', startedAt: today });
    setAddError('');
  }

  function openEdit(h: PassHolder) {
    setEditHolder(h);
    setEditForm({ name: h.name, birthday: h.birthday, startedAt: h.startedAt });
  }

  async function handleEditSave() {
    if (!editHolder) return;
    await update.mutateAsync({
      id: editHolder.id,
      input: {
        name: editForm.name.trim(),
        birthday: editForm.birthday,
        startedAt: editForm.startedAt,
      },
    });
    setEditHolder(null);
  }

  async function handleRemove(id: string) {
    await remove.mutateAsync(id);
  }

  return (
    <div className="border-t border-white/10 pt-4 mt-2">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">
        Pass Holders
      </p>

      {isLoading ? (
        <p className="text-sm text-white/30">Loading…</p>
      ) : holders.length === 0 ? (
        <p className="mb-3 text-sm text-white/30">No holders registered yet.</p>
      ) : editHolder ? (
        <div className="mb-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-medium text-white/50">Editing {editHolder.name}</p>
          <input
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-300/60"
            placeholder="Name"
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <DateField label="Birthday" value={editForm.birthday} onChange={(v) => setEditForm((f) => ({ ...f, birthday: v }))} />
            </div>
            <div className="flex-1">
              <DateField label="Started at" value={editForm.startedAt} onChange={(v) => setEditForm((f) => ({ ...f, startedAt: v }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="!py-1 text-xs" onClick={() => setEditHolder(null)}>Cancel</Button>
            <Button variant="primary" className="!py-1 text-xs" onClick={() => void handleEditSave()} disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mb-3 space-y-1">
          {holders.map((h) => (
            <li key={h.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium">{h.name}</span>
                <span className="block text-xs text-white/40">
                  🎂 {h.birthday} · started {h.startedAt} · {h.usageCount} uses
                </span>
              </span>
              <Button variant="subtle" className="!px-2 !py-1 text-xs shrink-0" onClick={() => openEdit(h)}>Edit</Button>
              <Button variant="danger" className="!px-2 !py-1 text-xs shrink-0" onClick={() => void handleRemove(h.id)} disabled={remove.isPending}>Del</Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add form */}
      {!editHolder && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-white/40">Add holder</p>
          <input
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-300/60"
            placeholder="Name"
            value={addForm.name}
            onChange={(e) => { setAddForm((f) => ({ ...f, name: e.target.value })); setAddError(''); }}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <DateField label="Birthday" value={addForm.birthday} onChange={(v) => { setAddForm((f) => ({ ...f, birthday: v })); setAddError(''); }} />
            </div>
            <div className="flex-1">
              <DateField label="Started at" value={addForm.startedAt} onChange={(v) => setAddForm((f) => ({ ...f, startedAt: v }))} />
            </div>
          </div>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <Button variant="primary" className="w-full !py-1.5 text-xs" onClick={() => void handleAdd()} disabled={create.isPending}>
            {create.isPending ? 'Adding…' : '+ Add holder'}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Add pass fields to the item modal form**

Inside the `<Modal>` in `ItemsSection`, after the `CheckboxField` for `isPass`, add the following block:

```tsx
{form.isPass && (
  <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
    <CheckboxField
      label="Pass can expire"
      description="Enables an expiry expression evaluated at check-in time."
      checked={form.canExpire}
      onChange={(v) => setForm((f) => ({ ...f, canExpire: v }))}
    />
    {form.canExpire && (
      <div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
            Expiry expression
          </span>
          <textarea
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-mono text-white placeholder:text-white/30 outline-none transition focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20 resize-none"
            rows={3}
            placeholder={'holder.usageCount >= 10 || new Date(holder.startedAt) < new Date(today - 30 * 86400000)'}
            value={form.expiryExpression}
            onChange={(e) => setForm((f) => ({ ...f, expiryExpression: e.target.value }))}
          />
        </label>
        <p className="mt-1 text-xs text-white/30">
          Receives <code className="text-white/50">holder</code> (PassHolder) and <code className="text-white/50">today</code> (Date). Return <code className="text-white/50">true</code> if invalid.
        </p>
      </div>
    )}
    {modal.type === 'edit' && modal.item.isPass && (
      <PassHoldersSection passItemId={modal.item.id} />
    )}
  </div>
)}
```

- [ ] **Step 9: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -15
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/pages/settings/ItemsSection.tsx
git commit -m "feat: add pass expiry fields and pass holder CRUD to item edit modal"
```

---

### Task 5: Update PassModal with validity check and DateField

**Files:**
- Modify: `src/pages/quickadd/PassModal.tsx`

- [ ] **Step 1: Read current PassModal.tsx**

Read `/home/arch/wallguard-counter/src/pages/quickadd/PassModal.tsx`.

- [ ] **Step 2: Rewrite PassModal**

Replace the full file content:

```tsx
import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { DateField } from '../../components/ui/DateField';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { usePassHolders } from '../../lib/queries';
import { formatPrice } from '../../lib/format';
import type { Item, PassHolder } from '../../lib/types';

/** One person added to a pass item in the current Quick Add session. */
export interface PassEntry {
  holderId?: string;
  name: string;
  birthday: string;
  /** Resolved price: 0 for an existing valid holder, item.price otherwise. */
  price: number;
  /** True when this person isn't a holder yet and must be registered on Save. */
  isNew: boolean;
}

interface PassModalProps {
  item: Item;
  onClose: () => void;
  onAdd: (entry: PassEntry) => void;
}

function evalExpiry(expression: string, holder: PassHolder): boolean {
  try {
    return new Function('holder', 'today', `return (${expression})`)(holder, new Date()) === true;
  } catch {
    console.warn('PassModal: expiry expression error', expression);
    return false;
  }
}

export function PassModal({ item, onClose, onAdd }: PassModalProps) {
  const { data: holders = [], isLoading } = usePassHolders(item.id);
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');

  const [expiredHolder, setExpiredHolder] = useState<PassHolder | null>(null);

  const query = name.trim().toLowerCase();
  const matches = useMemo(
    () =>
      holders.filter((h) => {
        const byName = query.length === 0 || h.name.toLowerCase().includes(query);
        const byDob = birthday.length === 0 || h.birthday === birthday;
        return byName && byDob;
      }),
    [holders, query, birthday],
  );

  const canRegister = name.trim().length > 0 && birthday.length > 0;

  function checkAndAddExisting(holder: PassHolder) {
    const hasLimits = item.canExpire && item.expiryExpression;
    if (hasLimits && evalExpiry(item.expiryExpression!, holder)) {
      setExpiredHolder(holder);
      return;
    }
    addExisting(holder, 0);
  }

  function addExisting(holder: PassHolder, price: number) {
    onAdd({
      holderId: holder.id,
      name: holder.name,
      birthday: holder.birthday,
      price,
      isNew: false,
    });
    onClose();
  }

  function registerNew() {
    if (!canRegister) return;
    onAdd({
      name: name.trim(),
      birthday,
      price: item.price,
      isNew: true,
    });
    onClose();
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`${item.icon ? `${item.icon} ` : ''}${item.name}`}
        footer={
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-white/40">
            Search the pass holders. Found → free. Not found → register them and
            charge {formatPrice(item.price)}.
          </p>

          <div className="flex gap-2">
            <div className="flex-1">
              <TextField
                label="Name"
                value={name}
                autoFocus
                placeholder="Search or enter a name"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="w-40 shrink-0">
              <DateField
                label="Birthday"
                value={birthday}
                onChange={setBirthday}
              />
            </div>
          </div>

          {/* Matches */}
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-white/40">
              Holders
            </p>
            {isLoading ? (
              <p className="py-3 text-center text-sm text-white/30">Loading…</p>
            ) : matches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-4 text-center text-sm text-white/40">
                {holders.length === 0
                  ? 'No holders registered yet.'
                  : 'No match — register them below.'}
              </p>
            ) : (
              <ul className="max-h-44 space-y-1 overflow-auto pr-1">
                {matches.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => checkAndAddExisting(h)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-lime-300/40 hover:bg-lime-300/5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{h.name}</span>
                        <span className="block text-xs text-white/40">
                          {h.birthday} · {h.usageCount} uses
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-lime-300">
                        Add · free
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Register new */}
          <div className="border-t border-white/5 pt-3">
            <Button
              variant="primary"
              onClick={registerNew}
              disabled={!canRegister}
              className="w-full"
            >
              Register &amp; add
              {item.price > 0 ? ` · ${formatPrice(item.price)}` : ''}
            </Button>
            {!canRegister && (
              <p className="mt-2 text-center text-xs text-white/30">
                Enter a name and birthday to register a new holder.
              </p>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={expiredHolder !== null}
        title="Pass expired or over limit"
        message={
          expiredHolder
            ? `${expiredHolder.name}'s pass is expired or over its usage limit. Add at full price (${formatPrice(item.price)})?`
            : ''
        }
        confirmLabel={`Add · ${formatPrice(item.price)}`}
        onConfirm={() => {
          if (expiredHolder) addExisting(expiredHolder, item.price);
          setExpiredHolder(null);
        }}
        onCancel={() => setExpiredHolder(null)}
        busy={false}
      />
    </>
  );
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/quickadd/PassModal.tsx
git commit -m "feat: add expiry validity check and DateField to PassModal"
```

---

### Task 6: Update QuickAdd to increment usageCount and pass startedAt

**Files:**
- Modify: `src/pages/QuickAdd.tsx`

- [ ] **Step 1: Read current QuickAdd.tsx**

Read `/home/arch/wallguard-counter/src/pages/QuickAdd.tsx`.

- [ ] **Step 2: Add incrementUsage to pass holder mutations**

Update the mutations line at the top of `QuickAdd`:

```tsx
const { create: createHolder, incrementUsage } = usePassHolderMutations();
```

- [ ] **Step 3: Update handleSave to increment usageCount for existing holders and pass startedAt for new holders**

Replace the pass entries loop in `handleSave`:

```tsx
// Pass entries: one line per person, plus register any new holders.
for (const item of items) {
  if (!item.isPass) continue;
  for (const entry of entriesFor(item.id)) {
    if (entry.isNew) {
      await createHolder.mutateAsync({
        name: entry.name,
        birthday: entry.birthday,
        startedAt: new Date().toISOString().slice(0, 10),
        passItemId: item.id,
        usageCount: 0,
      });
    } else if (entry.holderId) {
      // Atomically increment usage count for existing holders.
      incrementUsage.mutate(entry.holderId);
    }
    lines.push({
      itemId: item.id,
      name: item.name,
      price: entry.price,
      quantity: 1,
      holderName: entry.name,
      holderBirthday: entry.birthday,
    });
  }
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/QuickAdd.tsx
git commit -m "feat: increment usageCount on checkout and pass startedAt on registration"
```

---

### Task 7: Write migration 002 (backfill pass holder fields)

**Files:**
- Create: `migrations/002_add_usage_count_and_started_at_to_pass_holders.mjs`

- [ ] **Step 1: Create the migration**

Create `/home/arch/wallguard-counter/migrations/002_add_usage_count_and_started_at_to_pass_holders.mjs`:

```js
/**
 * Backfills `usageCount` (0) and `startedAt` (derived from `createdAt`)
 * on all existing pass holders that don't have these fields yet.
 */

export async function run(db) {
  const snap = await db.collection('passHolders').get();
  if (snap.size === 0) {
    console.log('    passHolders: nothing to migrate');
    return;
  }

  const batch = db.batch();
  let count = 0;
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const update = {};
    if (!('usageCount' in data)) update.usageCount = 0;
    if (!('startedAt' in data)) {
      const createdAt = data.createdAt?.toDate?.();
      update.startedAt = createdAt
        ? createdAt.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    }
    if (Object.keys(update).length > 0) {
      batch.update(docSnap.ref, update);
      count++;
    }
  });
  await batch.commit();
  console.log(`    passHolders: ${count} updated`);
}
```

- [ ] **Step 2: Commit**

```bash
git add migrations/002_add_usage_count_and_started_at_to_pass_holders.mjs
git commit -m "feat: migration 002 — backfill usageCount and startedAt on pass holders"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full typecheck**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 2: Full test run against emulator**

```bash
cd /home/arch/wallguard-counter && npx firebase-tools emulators:exec --only auth,firestore -P demo-wallguard "npm run test" 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 3: Lint**

```bash
cd /home/arch/wallguard-counter && npm run lint 2>&1 | tail -10
```

Expected: no errors.
