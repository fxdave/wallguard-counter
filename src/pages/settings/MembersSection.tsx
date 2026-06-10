import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextField } from '../../components/ui/Field';
import { useMembers, useMemberMutations } from '../../lib/queries';
import { useAuth } from '../../auth/useAuth';
import type { Member } from '../../lib/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DeleteState = { open: false } | { open: true; member: Member };

function formatAdded(member: Member): string {
  const by = member.addedBy ? `by ${member.addedBy}` : '';
  const when = member.addedAt
    ? member.addedAt.toDate().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';
  return [by, when].filter(Boolean).join(' · ');
}

export function MembersSection() {
  const { user } = useAuth();
  const { data: members = [], isLoading } = useMembers();
  const { add, remove } = useMemberMutations();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>({ open: false });

  const normalized = email.trim().toLowerCase();
  const alreadyListed = members.some((m) => m.email === normalized);

  async function handleAdd() {
    setError(null);
    if (!EMAIL_RE.test(normalized)) {
      setError('Enter a valid email address.');
      return;
    }
    if (alreadyListed) {
      setError('That email is already on the list.');
      return;
    }
    await add.mutateAsync({ email: normalized, addedBy: user?.email ?? 'unknown' });
    setEmail('');
  }

  async function handleDelete() {
    if (!deleteState.open) return;
    await remove.mutateAsync(deleteState.member.email);
    setDeleteState({ open: false });
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold tracking-tight">Members</h2>
        <p className="mt-0.5 text-sm text-white/40">
          Everyone listed here can sign in and use the app. Any member can add or
          remove others.
        </p>
      </div>

      {/* Add member */}
      <div className="mb-5 flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="Add by email"
            type="email"
            placeholder="person@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
            }}
          />
        </div>
        <Button
          variant="primary"
          onClick={() => void handleAdd()}
          disabled={add.isPending || normalized.length === 0}
          className="shrink-0"
        >
          {add.isPending ? 'Adding…' : 'Add'}
        </Button>
      </div>
      {error && <p className="-mt-3 mb-4 text-xs text-red-300/80">{error}</p>}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-white/30">Loading…</div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
          <p className="text-sm text-white/40">
            No members added yet. The owner (set in firestore.rules) always has
            access — add household members above.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {members.map((member) => (
              <motion.li
                key={member.email}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime-300/10 text-sm font-bold uppercase text-lime-300">
                  {member.email.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {member.email}
                    {member.email === user?.email?.toLowerCase() && (
                      <span className="ml-2 text-xs text-white/30">(you)</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-white/35">
                    {formatAdded(member)}
                  </span>
                </span>
                <Button
                  variant="danger"
                  className="!px-2 !py-1 text-xs"
                  onClick={() => setDeleteState({ open: true, member })}
                >
                  Remove
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <ConfirmDialog
        open={deleteState.open}
        title="Remove member"
        message={
          deleteState.open
            ? `Remove ${deleteState.member.email}? They will lose access immediately.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteState({ open: false })}
        busy={remove.isPending}
      />
    </section>
  );
}
