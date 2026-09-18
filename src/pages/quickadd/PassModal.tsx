import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { DateField } from '../../components/ui/DateField';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { usePassHolders } from '../../lib/queries';
import { formatPrice } from '../../lib/format';
import { isHolderExpired } from '../../lib/passExpiry';
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
  /**
   * True when an existing holder was expired and is paying full price again.
   * Save renews the holder: `startedAt` = today, `usageCount` = 1.
   */
  renew?: boolean;
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
    if (isHolderExpired(item, holder)) {
      setExpiredHolder(holder);
      return;
    }
    addExisting(holder, false);
  }

  function addExisting(holder: PassHolder, renew: boolean) {
    onAdd({
      holderId: holder.id,
      name: holder.name,
      birthday: holder.birthday,
      price: renew ? item.price : 0,
      isNew: false,
      renew,
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
                {matches.map((h) => {
                  const expired = isHolderExpired(item, h);
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => checkAndAddExisting(h)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                          expired
                            ? 'border-amber-300/20 bg-amber-300/[0.04] hover:border-amber-300/40 hover:bg-amber-300/10'
                            : 'border-white/10 bg-white/[0.03] hover:border-lime-300/40 hover:bg-lime-300/5'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{h.name}</span>
                          <span className="block text-xs text-white/40">
                            🎂 {h.birthday} · started {h.startedAt} · {h.usageCount} uses
                          </span>
                        </span>
                        {expired ? (
                          <span className="shrink-0 text-xs font-semibold text-amber-300">
                            Expired · renew {formatPrice(item.price)}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-semibold text-lime-300">
                            Add · free
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
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
            ? `${expiredHolder.name}'s pass is expired or over its usage limit. Renew it at full price (${formatPrice(item.price)})? Saving restarts the pass from today with 1 use.`
            : ''
        }
        confirmLabel={`Renew · ${formatPrice(item.price)}`}
        onConfirm={() => {
          if (expiredHolder) addExisting(expiredHolder, true);
          setExpiredHolder(null);
        }}
        onCancel={() => setExpiredHolder(null)}
        busy={false}
      />
    </>
  );
}
