import { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/Button';
import {
  useCategories,
  useItems,
  useCheckoutMutations,
  usePassHolderMutations,
} from '../lib/queries';
import { formatPrice } from '../lib/format';
import type { CheckoutLine, Item } from '../lib/types';
import { ItemCard } from './quickadd/ItemCard';
import { PassModal, type PassEntry } from './quickadd/PassModal';

export function QuickAdd() {
  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const { data: items = [], isLoading: itemsLoading } = useItems();
  const { create } = useCheckoutMutations();
  const { create: createHolder, incrementUsage } = usePassHolderMutations();

  // Normal items: simple counts. Pass items: a list of per-person entries.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [passEntries, setPassEntries] = useState<Record<string, PassEntry[]>>({});
  const [passModalItem, setPassModalItem] = useState<Item | null>(null);

  const isLoading = catsLoading || itemsLoading;

  // Build category → items map (only categories that have items)
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const itemsByCategory = new Map<string, Item[]>();
  for (const item of items) {
    if (!categoryMap.has(item.categoryId)) continue;
    const existing = itemsByCategory.get(item.categoryId) ?? [];
    existing.push(item);
    itemsByCategory.set(item.categoryId, existing);
  }
  const activeCategories = categories.filter(
    (c) => (itemsByCategory.get(c.id)?.length ?? 0) > 0,
  );

  function entriesFor(itemId: string): PassEntry[] {
    return passEntries[itemId] ?? [];
  }

  /** Count shown on the card: people for a pass item, tally for a normal one. */
  function countFor(item: Item): number {
    return item.isPass ? entriesFor(item.id).length : counts[item.id] ?? 0;
  }

  function passSubtotal(itemId: string): number {
    return entriesFor(itemId).reduce((sum, e) => sum + e.price, 0);
  }

  // Running totals across normal counts + pass entries.
  const runningTotal =
    items.reduce((sum, item) => {
      if (item.isPass) return sum + passSubtotal(item.id);
      return sum + item.price * (counts[item.id] ?? 0);
    }, 0);

  const totalQty =
    Object.values(counts).reduce((s, v) => s + v, 0) +
    Object.values(passEntries).reduce((s, list) => s + list.length, 0);

  function handleIncrement(item: Item) {
    if (item.isPass) {
      setPassModalItem(item);
      return;
    }
    setCounts((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }));
  }

  function handleDecrement(item: Item) {
    if (item.isPass) {
      setPassEntries((prev) => {
        const list = prev[item.id] ?? [];
        if (list.length === 0) return prev;
        return { ...prev, [item.id]: list.slice(0, -1) };
      });
      return;
    }
    setCounts((prev) => {
      const current = prev[item.id] ?? 0;
      if (current <= 0) return prev;
      return { ...prev, [item.id]: current - 1 };
    });
  }

  function handleAddPassEntry(entry: PassEntry) {
    if (!passModalItem) return;
    const id = passModalItem.id;
    setPassEntries((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), entry] }));
  }

  async function handleSave() {
    const lines: CheckoutLine[] = [];

    // Normal item lines.
    for (const item of items) {
      if (item.isPass) continue;
      const qty = counts[item.id] ?? 0;
      if (qty > 0) {
        lines.push({ itemId: item.id, name: item.name, price: item.price, quantity: qty });
      }
    }

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
            // Registering + adding in Quick Add counts as the holder's first use.
            usageCount: 1,
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

    if (lines.length === 0) return;

    await create.mutateAsync({ total: runningTotal, lines });
    setCounts({});
    setPassEntries({});
  }

  const saving = create.isPending || createHolder.isPending;

  return (
    <div className="pb-28">
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime-300/30 border-t-lime-300" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
          <p className="font-display text-2xl text-white/70">No items yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/40">
            Head over to <span className="font-medium text-white/60">Settings</span> to
            add categories and items before counting.
          </p>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-5">
          {activeCategories.map((category) => {
            const catItems = itemsByCategory.get(category.id) ?? [];
            return (
              <section key={category.id} className="flex items-stretch gap-3">
                <div className="flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-1 [writing-mode:vertical-rl] rotate-180">
                  <span className="text-xl leading-none rotate-180">{category.icon}</span>
                  <h2 className="font-display text-lg font-bold tracking-tight text-white/90">
                    {category.name}
                  </h2>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {catItems.map((item) => {
                    const count = countFor(item);
                    const priceText = item.isPass
                      ? count > 0
                        ? formatPrice(passSubtotal(item.id))
                        : formatPrice(item.price)
                      : undefined;
                    return (
                      <ItemCard
                        key={item.id}
                        item={item}
                        count={count}
                        badge={item.isPass ? 'Pass' : undefined}
                        priceText={priceText}
                        onIncrement={() => handleIncrement(item)}
                        onDecrement={() => handleDecrement(item)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}

          <p className="pt-2 text-center text-xs text-white/30">
            Tap to count. Save writes one checkout batch.
          </p>
        </div>
      )}

      {/* Sticky save bar */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b0b0f]/80 backdrop-blur-xl"
        initial={false}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-white/40">
              Total
            </span>
            <motion.span
              key={runningTotal}
              initial={{ scale: 0.9, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="font-display text-2xl font-extrabold tabular-nums text-lime-300"
            >
              {formatPrice(runningTotal)}
            </motion.span>
          </div>

          <Button
            variant="primary"
            disabled={totalQty === 0 || saving}
            onClick={() => void handleSave()}
            className="min-w-[100px] py-3 text-base"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                Saving…
              </span>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </motion.div>

      {passModalItem && (
        <PassModal
          item={passModalItem}
          onClose={() => setPassModalItem(null)}
          onAdd={handleAddPassEntry}
        />
      )}
    </div>
  );
}
