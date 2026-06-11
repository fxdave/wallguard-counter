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
import {
  TextField,
  IconField,
  NumberField,
  SelectField,
  CheckboxField,
} from '../../components/ui/Field';
import { DateField } from '../../components/ui/DateField';
import { useItems, useItemMutations, useCategories, usePassHolders, usePassHolderMutations } from '../../lib/queries';
import { countPassHolders } from '../../lib/firestore';
import { formatPrice } from '../../lib/format';
import type { Item, PassHolder } from '../../lib/types';

interface ItemFormState {
  name: string;
  icon: string;
  price: string;
  categoryId: string;
  isPass: boolean;
  canExpire: boolean;
  expiryExpression: string;
}

const emptyForm = (defaultCategoryId = ''): ItemFormState => ({
  name: '',
  icon: '',
  price: '0',
  categoryId: defaultCategoryId,
  isPass: false,
  canExpire: false,
  expiryExpression: '',
});

type ModalMode =
  | { type: 'closed' }
  | { type: 'add' }
  | { type: 'edit'; item: Item };

type DeleteState = { open: false } | { open: true; item: Item };

function PassHoldersSection({ passItemId }: { passItemId: string }) {
  const [search, setSearch] = useState('');
  const { data: allHolders = [], isLoading } = usePassHolders(passItemId);
  const holders = search.trim()
    ? allHolders.filter((h) => h.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 50)
    : allHolders.slice(0, 50);
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

  function openEditHolder(h: PassHolder) {
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

      <input
        className="mb-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-300/60"
        placeholder="Search by name…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setEditHolder(null); }}
      />

      {isLoading ? (
        <p className="text-sm text-white/30">Loading…</p>
      ) : holders.length === 0 ? (
        <p className="mb-3 text-sm text-white/30">{search ? 'No results.' : 'No holders registered yet.'}</p>
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
              <Button variant="subtle" className="!px-2 !py-1 text-xs shrink-0" onClick={() => openEditHolder(h)}>Edit</Button>
              <Button variant="danger" className="!px-2 !py-1 text-xs shrink-0" onClick={() => void handleRemove(h.id)} disabled={remove.isPending}>Del</Button>
            </li>
          ))}
        </ul>
      )}

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
        transition: isDragging ? undefined : transition,
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

export function ItemsSection() {
  const { data: items = [], isLoading: itemsLoading } = useItems();
  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const { create, update, remove, reorder } = useItemMutations();

  const [modal, setModal] = useState<ModalMode>({ type: 'closed' });
  const [form, setForm] = useState<ItemFormState>(emptyForm());
  const [errors, setErrors] = useState<Partial<Record<keyof ItemFormState, string>>>({});
  const [deleteState, setDeleteState] = useState<DeleteState>({ open: false });

  const sensors = useSensors(useSensor(PointerSensor));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  function openAdd() {
    setForm(emptyForm(categories[0]?.id ?? ''));
    setErrors({});
    setModal({ type: 'add' });
  }

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

  function closeModal() {
    setModal({ type: 'closed' });
    setErrors({});
  }

  function validate(): boolean {
    const next: Partial<Record<keyof ItemFormState, string>> = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) next.price = 'Price must be 0 or more.';
    if (!form.categoryId) next.categoryId = 'Category is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
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

    if (modal.type === 'add') {
      await create.mutateAsync(input);
    } else if (modal.type === 'edit') {
      await update.mutateAsync({ id: modal.item.id, input });
    }
    closeModal();
  }

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

  const isSaving = create.isPending || update.isPending;
  const isDeleting = remove.isPending;
  const isOpen = modal.type !== 'closed';
  const noCategories = !catsLoading && categories.length === 0;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Items</h2>
          <p className="mt-0.5 text-sm text-white/40">Countable things with names, icons, and prices.</p>
        </div>
        <Button
          variant="primary"
          onClick={openAdd}
          disabled={noCategories}
          title={noCategories ? 'Add a category first' : undefined}
        >
          + Add item
        </Button>
      </div>

      {noCategories && (
        <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-300/80">
          No categories yet — add at least one category before adding items.
        </div>
      )}

      {itemsLoading ? (
        <div className="py-8 text-center text-sm text-white/30">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
          <p className="text-sm text-white/40">No items yet.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
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
              </AnimatePresence>
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Modal
        open={isOpen}
        onClose={closeModal}
        title={modal.type === 'add' ? 'Add item' : 'Edit item'}
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
            onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((er) => ({ ...er, name: undefined })); }}
            placeholder="e.g. Still water"
            autoFocus
          />
          {errors.name && <p className="text-xs text-red-400 -mt-2">{errors.name}</p>}
          <IconField
            label="Icon"
            value={form.icon}
            onChange={(v) => setForm((f) => ({ ...f, icon: v }))}
          />
          <NumberField
            label="Price"
            value={form.price}
            min={0}
            step={0.01}
            onChange={(e) => { setForm((f) => ({ ...f, price: e.target.value })); setErrors((er) => ({ ...er, price: undefined })); }}
          />
          {errors.price && <p className="text-xs text-red-400 -mt-2">{errors.price}</p>}
          <SelectField
            label="Category"
            value={form.categoryId}
            onChange={(e) => { setForm((f) => ({ ...f, categoryId: e.target.value })); setErrors((er) => ({ ...er, categoryId: undefined })); }}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
              </option>
            ))}
          </SelectField>
          {errors.categoryId && <p className="text-xs text-red-400 -mt-2">{errors.categoryId}</p>}
          <CheckboxField
            label="This is a pass"
            description="Adding it in Quick Add searches pass holders by name + birthday. Known holders count free; new people are registered and charged the price above."
            checked={form.isPass}
            onChange={(v) => setForm((f) => ({ ...f, isPass: v }))}
          />
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
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteState.open}
        title="Delete item"
        message={deleteState.open ? `Delete "${deleteState.item.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteState({ open: false })}
        busy={isDeleting}
      />
    </section>
  );
}
