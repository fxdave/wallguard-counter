import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { NumberField } from '../../components/ui/Field';
import { DateField } from '../../components/ui/DateField';
import { useItems, usePassHolders, usePassHolderMutations } from '../../lib/queries';
import { isHolderExpired } from '../../lib/passExpiry';
import type { Item, PassHolder } from '../../lib/types';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-lime-300/60';

const today = () => new Date().toISOString().slice(0, 10);

const emptyAddForm = () => ({ name: '', birthday: '', startedAt: today(), usageCount: '0' });

function PassHolders({ item }: { item: Item }) {
  const [search, setSearch] = useState('');
  const { data: allHolders = [], isLoading } = usePassHolders(item.id);
  const holders = (
    search.trim()
      ? allHolders.filter((h) => h.name.toLowerCase().includes(search.trim().toLowerCase()))
      : allHolders
  ).slice(0, 50);
  const { create, update, remove } = usePassHolderMutations(item.id);

  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addError, setAddError] = useState('');
  const [editHolder, setEditHolder] = useState<PassHolder | null>(null);
  const [editForm, setEditForm] = useState({ name: '', birthday: '', startedAt: '', usageCount: '0' });
  const [deleteHolder, setDeleteHolder] = useState<PassHolder | null>(null);

  const parseUses = (raw: string) => Math.max(0, Math.trunc(Number(raw) || 0));

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.birthday || !addForm.startedAt) {
      setAddError('Name, birthday, and started date are required.');
      return;
    }
    await create.mutateAsync({
      name: addForm.name.trim(),
      birthday: addForm.birthday,
      startedAt: addForm.startedAt,
      passItemId: item.id,
      usageCount: parseUses(addForm.usageCount),
    });
    setAddForm(emptyAddForm());
    setAddError('');
  }

  function openEdit(h: PassHolder) {
    setEditHolder(h);
    setEditForm({
      name: h.name,
      birthday: h.birthday,
      startedAt: h.startedAt,
      usageCount: String(h.usageCount),
    });
  }

  async function handleEditSave() {
    if (!editHolder || !editForm.name.trim() || !editForm.birthday || !editForm.startedAt) return;
    await update.mutateAsync({
      id: editHolder.id,
      input: {
        name: editForm.name.trim(),
        birthday: editForm.birthday,
        startedAt: editForm.startedAt,
        usageCount: parseUses(editForm.usageCount),
      },
    });
    setEditHolder(null);
  }

  async function handleDelete() {
    if (!deleteHolder) return;
    await remove.mutateAsync(deleteHolder.id);
    setDeleteHolder(null);
  }

  return (
    <div className="space-y-4">
      <input
        className={inputClass}
        placeholder="Search by name…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setEditHolder(null);
        }}
      />

      {isLoading ? (
        <p className="text-sm text-white/30">Loading…</p>
      ) : holders.length === 0 ? (
        <p className="text-sm text-white/30">{search ? 'No results.' : 'No holders registered yet.'}</p>
      ) : editHolder ? (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-medium text-white/50">Editing {editHolder.name}</p>
          <input
            className={inputClass}
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
            <div className="w-24 shrink-0">
              <NumberField
                label="Uses"
                min={0}
                step={1}
                value={editForm.usageCount}
                onChange={(e) => setEditForm((f) => ({ ...f, usageCount: e.target.value }))}
              />
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
        <ul className="space-y-1">
          {holders.map((h) => {
            const expired = isHolderExpired(item, h);
            return (
              <li key={h.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="truncate">{h.name}</span>
                    {expired && (
                      <span className="shrink-0 rounded-md bg-amber-300/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                        Expired
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-white/40">
                    🎂 {h.birthday} · started {h.startedAt} · {h.usageCount} uses
                  </span>
                </span>
                <Button variant="subtle" className="!px-2 !py-1 text-xs shrink-0" onClick={() => openEdit(h)}>Edit</Button>
                <Button variant="danger" className="!px-2 !py-1 text-xs shrink-0" onClick={() => setDeleteHolder(h)}>Delete</Button>
              </li>
            );
          })}
          {allHolders.length > 50 && holders.length === 50 && (
            <li className="px-3 py-1 text-xs text-white/30">Showing first 50 — search to narrow.</li>
          )}
        </ul>
      )}

      {!editHolder && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-white/40">Add holder</p>
          <input
            className={inputClass}
            placeholder="Name"
            value={addForm.name}
            onChange={(e) => {
              setAddForm((f) => ({ ...f, name: e.target.value }));
              setAddError('');
            }}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <DateField
                label="Birthday"
                value={addForm.birthday}
                onChange={(v) => {
                  setAddForm((f) => ({ ...f, birthday: v }));
                  setAddError('');
                }}
              />
            </div>
            <div className="flex-1">
              <DateField label="Started at" value={addForm.startedAt} onChange={(v) => setAddForm((f) => ({ ...f, startedAt: v }))} />
            </div>
            <div className="w-24 shrink-0">
              <NumberField
                label="Uses"
                min={0}
                step={1}
                value={addForm.usageCount}
                onChange={(e) => setAddForm((f) => ({ ...f, usageCount: e.target.value }))}
              />
            </div>
          </div>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <Button variant="primary" className="w-full !py-1.5 text-xs" onClick={() => void handleAdd()} disabled={create.isPending}>
            {create.isPending ? 'Adding…' : '+ Add holder'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteHolder !== null}
        title="Delete holder"
        message={deleteHolder ? `Delete "${deleteHolder.name}"? Past checkouts keep their lines; only the holder record is removed.` : ''}
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteHolder(null)}
        busy={remove.isPending}
      />
    </div>
  );
}

export function PassesSection() {
  const { data: items = [], isLoading } = useItems();
  const passItems = items.filter((i) => i.isPass);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = passItems.find((i) => i.id === selectedId) ?? passItems[0] ?? null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold tracking-tight">Passes</h2>
        <p className="mt-0.5 text-sm text-white/40">
          People holding each pass. Mark an item as a pass under Items to make it show up here.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-white/30">Loading…</p>
      ) : passItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-6 text-center text-sm text-white/40">
          No pass items yet.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {passItems.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setSelectedId(i.id)}
                className={[
                  'rounded-xl border px-3 py-1.5 text-sm font-medium transition',
                  selected?.id === i.id
                    ? 'border-lime-300/40 bg-lime-300/15 text-lime-300'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                {i.icon ? `${i.icon} ` : ''}
                {i.name}
              </button>
            ))}
          </div>
          {selected && <PassHolders key={selected.id} item={selected} />}
        </>
      )}
    </section>
  );
}
