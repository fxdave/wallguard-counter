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
