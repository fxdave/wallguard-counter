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
import { TextField, NumberField } from '../../components/ui/Field';
import { useDiscounts, useDiscountMutations } from '../../lib/queries';
import type { Discount } from '../../lib/types';

interface DiscountFormState {
  name: string;
  percent: string;
}

const emptyForm = (): DiscountFormState => ({ name: '', percent: '' });

type ModalMode =
  | { type: 'closed' }
  | { type: 'add' }
  | { type: 'edit'; discount: Discount };

type DeleteState = { open: false } | { open: true; discount: Discount };

function SortableRow({
  discount,
  onEdit,
  onDelete,
}: {
  discount: Discount;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: discount.id });

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
      <span className="flex-1 text-sm font-medium">{discount.name}</span>
      <span className="rounded-md bg-lime-300/15 px-2 py-0.5 text-xs font-bold tabular-nums text-lime-300">
        −{discount.percent}%
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

export function DiscountsSection() {
  const { data: discounts = [], isLoading } = useDiscounts();
  const { create, update, remove, reorder } = useDiscountMutations();

  const [modal, setModal] = useState<ModalMode>({ type: 'closed' });
  const [form, setForm] = useState<DiscountFormState>(emptyForm());
  const [error, setError] = useState('');
  const [deleteState, setDeleteState] = useState<DeleteState>({ open: false });

  const sensors = useSensors(useSensor(PointerSensor));

  function openAdd() {
    setForm(emptyForm());
    setError('');
    setModal({ type: 'add' });
  }

  function openEdit(discount: Discount) {
    setForm({ name: discount.name, percent: String(discount.percent) });
    setError('');
    setModal({ type: 'edit', discount });
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
    const percent = Number(form.percent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      setError('Percent must be a number between 0 and 100.');
      return;
    }
    const nextOrder = (discounts[discounts.length - 1]?.order ?? 0) + 1000;
    const input = { name, percent, order: nextOrder };

    if (modal.type === 'add') {
      await create.mutateAsync(input);
    } else if (modal.type === 'edit') {
      await update.mutateAsync({
        id: modal.discount.id,
        input: { name, percent },
      });
    }
    closeModal();
  }

  async function handleDelete() {
    if (!deleteState.open) return;
    await remove.mutateAsync(deleteState.discount.id);
    setDeleteState({ open: false });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = discounts.findIndex((d) => d.id === active.id);
    const newIndex = discounts.findIndex((d) => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...discounts];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    reorder.mutate(reordered.map((d) => d.id));
  }

  const isSaving = create.isPending || update.isPending;
  const isDeleting = remove.isPending;
  const isOpen = modal.type !== 'closed';

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Discounts</h2>
          <p className="mt-0.5 text-sm text-white/40">
            Percentage discounts toggled on Quick Add. Stack multiplicatively in order.
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          + Add discount
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-white/30">Loading…</div>
      ) : discounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
          <p className="text-sm text-white/40">No discounts yet — add one to get started.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={discounts.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {discounts.map((discount) => (
                  <SortableRow
                    key={discount.id}
                    discount={discount}
                    onEdit={() => openEdit(discount)}
                    onDelete={() => setDeleteState({ open: true, discount })}
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
        title={modal.type === 'add' ? 'Add discount' : 'Edit discount'}
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
            placeholder="e.g. Internal staff"
            autoFocus
          />
          <NumberField
            label="Percent off"
            value={form.percent}
            min={0}
            max={100}
            onChange={(e) => { setForm((f) => ({ ...f, percent: e.target.value })); setError(''); }}
            placeholder="e.g. 50"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteState.open}
        title="Delete discount"
        message={
          deleteState.open
            ? `Delete "${deleteState.discount.name}"? Past checkouts keep their recorded discount.`
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
