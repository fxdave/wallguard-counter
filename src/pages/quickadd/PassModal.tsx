import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { usePassHolders } from '../../lib/queries';
import { formatPrice } from '../../lib/format';
import type { Item } from '../../lib/types';

/** One person added to a pass item in the current Quick Add session. */
export interface PassEntry {
  name: string;
  birthday: string;
  /** Resolved price: 0 for an existing holder, the item price for a new one. */
  price: number;
  /** True when this person isn't a holder yet and must be registered on Save. */
  isNew: boolean;
}

interface PassModalProps {
  item: Item;
  onClose: () => void;
  onAdd: (entry: PassEntry) => void;
}

export function PassModal({ item, onClose, onAdd }: PassModalProps) {
  const { data: holders = [], isLoading } = usePassHolders(item.id);
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');

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

  function addExisting(holderName: string, holderBirthday: string) {
    onAdd({ name: holderName, birthday: holderBirthday, price: 0, isNew: false });
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
            <TextField
              label="Birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
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
                    onClick={() => addExisting(h.name, h.birthday)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-lime-300/40 hover:bg-lime-300/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{h.name}</span>
                      <span className="block text-xs text-white/40">{h.birthday}</span>
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
  );
}
