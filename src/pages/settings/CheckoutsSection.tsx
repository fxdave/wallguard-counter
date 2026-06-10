import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { NumberField, SelectField } from '../../components/ui/Field';
import { useCheckouts, useCheckoutMutations, useItems } from '../../lib/queries';
import { formatPrice, toDateInputValue, fromDateInputValue } from '../../lib/format';
import type { Checkout, CheckoutLine } from '../../lib/types';

type DeleteState = { open: false } | { open: true; checkout: Checkout };
type EditState = { open: false } | { open: true; checkout: Checkout; date: string; lines: CheckoutLine[] };

function formatCheckoutDate(checkout: Checkout): string {
  const d = checkout.createdAt.toDate();
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

function recomputeTotal(lines: CheckoutLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
}

interface CheckoutRowProps {
  checkout: Checkout;
  onEdit: () => void;
  onDelete: () => void;
}

function CheckoutRow({ checkout, onEdit, onDelete }: CheckoutRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden transition hover:bg-white/[0.045]"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
          aria-expanded={expanded}
        >
          <span
            className={[
              'text-white/30 transition-transform duration-200 text-xs',
              expanded ? 'rotate-90' : '',
            ].join(' ')}
          >
            ▶
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium">{formatCheckoutDate(checkout)}</span>
            <span className="block text-xs text-white/40">
              {checkout.lines.length} {checkout.lines.length === 1 ? 'line' : 'lines'}
              <span className="ml-2 text-lime-300/70">{formatPrice(checkout.total)}</span>
            </span>
          </span>
        </button>
        <Button variant="subtle" className="!px-2 !py-1 text-xs" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="danger" className="!px-2 !py-1 text-xs" onClick={onDelete}>
          Delete
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="lines"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ul className="border-t border-white/5 px-4 pb-3 pt-2 space-y-1">
              {checkout.lines.map((line) => (
                <li
                  key={line.itemId}
                  className="flex items-center justify-between text-xs text-white/60"
                >
                  <span>{line.name}</span>
                  <span className="flex items-center gap-3">
                    <span>×{line.quantity}</span>
                    {line.price > 0 && (
                      <span className="text-white/40">@ {formatPrice(line.price)}</span>
                    )}
                    {line.price > 0 && (
                      <span className="text-lime-300/60 w-16 text-right tabular-nums">
                        {formatPrice(line.price * line.quantity)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export function CheckoutsSection() {
  const { data: checkouts = [], isLoading } = useCheckouts();
  const { data: items = [] } = useItems();
  const { update, remove } = useCheckoutMutations();

  const [deleteState, setDeleteState] = useState<DeleteState>({ open: false });
  const [editState, setEditState] = useState<EditState>({ open: false });
  const [addItemId, setAddItemId] = useState('');

  function openEdit(checkout: Checkout) {
    setAddItemId('');
    setEditState({
      open: true,
      checkout,
      date: toDateInputValue(checkout.createdAt.toDate()),
      lines: checkout.lines.map((l) => ({ ...l })),
    });
  }

  function closeEdit() {
    setEditState({ open: false });
  }

  /** Add the selected item as a new line, or bump its quantity if already present. */
  function addLine() {
    const item = items.find((i) => i.id === addItemId);
    if (!item) return;
    setEditState((s) => {
      if (!s.open) return s;
      const existing = s.lines.find((l) => l.itemId === item.id);
      if (existing) {
        return {
          ...s,
          lines: s.lines.map((l) =>
            l.itemId === item.id ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        };
      }
      // Snapshot name + price at add time, matching how checkouts are saved.
      return {
        ...s,
        lines: [
          ...s.lines,
          { itemId: item.id, name: item.name, price: item.price, quantity: 1 },
        ],
      };
    });
    setAddItemId('');
  }

  async function handleSave() {
    if (!editState.open) return;
    const lines = editState.lines.filter((l) => l.quantity > 0);
    const total = recomputeTotal(lines);
    const createdAt = fromDateInputValue(editState.date);
    await update.mutateAsync({
      id: editState.checkout.id,
      input: { lines, total, createdAt },
    });
    closeEdit();
  }

  async function handleDelete() {
    if (!deleteState.open) return;
    await remove.mutateAsync(deleteState.checkout.id);
    setDeleteState({ open: false });
  }

  function setLineQuantity(itemId: string, qty: number) {
    if (!editState.open) return;
    setEditState((s) => {
      if (!s.open) return s;
      return {
        ...s,
        lines: s.lines.map((l) =>
          l.itemId === itemId ? { ...l, quantity: Math.max(0, qty) } : l,
        ),
      };
    });
  }

  const isSaving = update.isPending;
  const isDeleting = remove.isPending;

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold tracking-tight">Checkouts</h2>
        <p className="mt-0.5 text-sm text-white/40">Past saved batches from Quick Add.</p>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-white/30">Loading…</div>
      ) : checkouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
          <p className="text-sm text-white/40">No checkouts yet. Save a batch from Quick Add first.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {checkouts.map((co) => (
              <CheckoutRow
                key={co.id}
                checkout={co}
                onEdit={() => openEdit(co)}
                onDelete={() => setDeleteState({ open: true, checkout: co })}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* Edit modal */}
      <Modal
        open={editState.open}
        onClose={closeEdit}
        title="Edit checkout"
        footer={
          <>
            <Button variant="ghost" onClick={closeEdit} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        {editState.open && (
          <div className="space-y-5">
            <div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                  Date
                </span>
                <input
                  type="date"
                  value={editState.date}
                  onChange={(e) =>
                    setEditState((s) => s.open ? { ...s, date: e.target.value } : s)
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20"
                />
              </label>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
                Lines (set quantity to 0 to remove)
              </p>
              <ul className="space-y-2">
                {editState.lines.map((line) => (
                  <li key={line.itemId} className="flex items-center gap-3">
                    <span className="flex-1 truncate text-sm text-white/70">{line.name}</span>
                    {line.price > 0 && (
                      <span className="text-xs text-white/30 shrink-0">@ {formatPrice(line.price)}</span>
                    )}
                    <div className="w-24 shrink-0">
                      <NumberField
                        label=""
                        value={line.quantity}
                        min={0}
                        step={1}
                        onChange={(e) =>
                          setLineQuantity(line.itemId, parseInt(e.target.value, 10) || 0)
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
              {editState.lines.length === 0 && (
                <p className="text-xs text-white/30">No lines yet — add an item below.</p>
              )}

              {/* Add a new item line */}
              <div className="mt-3 flex items-end gap-2 border-t border-white/5 pt-3">
                <div className="flex-1">
                  <SelectField
                    label="Add item"
                    value={addItemId}
                    onChange={(e) => setAddItemId(e.target.value)}
                  >
                    <option value="">Select an item…</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.icon ? `${item.icon} ` : ''}
                        {item.name}
                        {item.price > 0 ? ` · ${formatPrice(item.price)}` : ''}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <Button
                  variant="ghost"
                  onClick={addLine}
                  disabled={!addItemId}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
              {items.length === 0 && (
                <p className="mt-2 text-xs text-white/30">
                  No items defined yet — add some in the Items tab.
                </p>
              )}

              {editState.lines.length > 0 && editState.lines.every((l) => l.quantity === 0) && (
                <p className="mt-2 text-xs text-amber-300/70">
                  All quantities are 0 — saving will create an empty checkout.
                </p>
              )}
              <p className="mt-3 text-right text-sm text-white/50">
                New total:{' '}
                <span className="font-semibold text-lime-300">
                  {formatPrice(recomputeTotal(editState.lines.filter((l) => l.quantity > 0)))}
                </span>
              </p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteState.open}
        title="Delete checkout"
        message={
          deleteState.open
            ? `Delete the checkout from ${formatCheckoutDate(deleteState.checkout)}? This cannot be undone.`
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
