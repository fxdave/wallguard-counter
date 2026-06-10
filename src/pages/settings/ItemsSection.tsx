import { useState } from 'react';
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
import { useItems, useItemMutations, useCategories } from '../../lib/queries';
import { formatPrice } from '../../lib/format';
import type { Item } from '../../lib/types';

interface ItemFormState {
  name: string;
  icon: string;
  price: string;
  categoryId: string;
  isPass: boolean;
}

const emptyForm = (defaultCategoryId = ''): ItemFormState => ({
  name: '',
  icon: '',
  price: '0',
  categoryId: defaultCategoryId,
  isPass: false,
});

type ModalMode =
  | { type: 'closed' }
  | { type: 'add' }
  | { type: 'edit'; item: Item };

type DeleteState = { open: false } | { open: true; item: Item };

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
