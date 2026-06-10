import { useState } from 'react';
import { motion } from 'motion/react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { useCategories, useItems, useCheckoutMutations } from '../lib/queries';
import { formatPrice } from '../lib/format';
import type { CheckoutLine } from '../lib/types';
import { ItemCard } from './quickadd/ItemCard';

export function QuickAdd() {
  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const { data: items = [], isLoading: itemsLoading } = useItems();
  const { create } = useCheckoutMutations();

  const [counts, setCounts] = useState<Record<string, number>>({});

  const isLoading = catsLoading || itemsLoading;

  // Build category → items map (only categories that have items)
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const itemsByCategory = new Map<string, typeof items>();

  for (const item of items) {
    if (!categoryMap.has(item.categoryId)) continue;
    const existing = itemsByCategory.get(item.categoryId) ?? [];
    existing.push(item);
    itemsByCategory.set(item.categoryId, existing);
  }

  // Categories in order, filtered to those with items
  const activeCategories = categories.filter(
    (c) => (itemsByCategory.get(c.id)?.length ?? 0) > 0,
  );

  // Running total
  const runningTotal = items.reduce((sum, item) => {
    const qty = counts[item.id] ?? 0;
    return sum + item.price * qty;
  }, 0);

  // Total quantity across all items
  const totalQty = Object.values(counts).reduce((s, v) => s + v, 0);

  function increment(itemId: string) {
    setCounts((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }));
  }

  function decrement(itemId: string) {
    setCounts((prev) => {
      const current = prev[itemId] ?? 0;
      if (current <= 0) return prev;
      return { ...prev, [itemId]: current - 1 };
    });
  }

  async function handleSave() {
    const lines: CheckoutLine[] = items
      .filter((item) => (counts[item.id] ?? 0) > 0)
      .map((item) => ({
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: counts[item.id] ?? 0,
      }));

    if (lines.length === 0) return;

    await create.mutateAsync({ total: runningTotal, lines });
    setCounts({});
  }

  return (
    <div className="pb-28">
      <PageHeader
        title="Quick Add"
        subtitle="Tap to count. Save writes one checkout batch."
      />

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime-300/30 border-t-lime-300" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
          <p className="font-display text-2xl text-white/70">No items yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/40">
            Head over to <span className="text-white/60 font-medium">Settings</span> to
            add categories and items before counting.
          </p>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-8">
          {activeCategories.map((category) => {
            const catItems = itemsByCategory.get(category.id) ?? [];
            return (
              <section key={category.id}>
                {/* Category heading */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl leading-none">{category.icon}</span>
                  <h2 className="font-display text-lg font-bold tracking-tight text-white/90">
                    {category.name}
                  </h2>
                </div>

                {/* Item grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      count={counts[item.id] ?? 0}
                      onIncrement={() => increment(item.id)}
                      onDecrement={() => decrement(item.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Sticky save bar */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0b0b0f]/80 backdrop-blur-xl"
        initial={false}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wide">
              Total
            </span>
            <motion.span
              key={runningTotal}
              initial={{ scale: 0.9, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="font-display text-2xl font-extrabold text-lime-300 tabular-nums"
            >
              {formatPrice(runningTotal)}
            </motion.span>
          </div>

          <Button
            variant="primary"
            disabled={totalQty === 0 || create.isPending}
            onClick={() => void handleSave()}
            className="min-w-[100px] py-3 text-base"
          >
            {create.isPending ? (
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
    </div>
  );
}
