import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { CategoriesSection } from './settings/CategoriesSection';
import { ItemsSection } from './settings/ItemsSection';
import { CheckoutsSection } from './settings/CheckoutsSection';

type Tab = 'categories' | 'items' | 'checkouts';

const TABS: { id: Tab; label: string }[] = [
  { id: 'categories', label: 'Categories' },
  { id: 'items', label: 'Items' },
  { id: 'checkouts', label: 'Checkouts' },
];

export function Settings() {
  const [active, setActive] = useState<Tab>('categories');

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage categories, items, and past checkouts."
      />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={[
              'flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition',
              active === tab.id
                ? 'bg-lime-300 text-black shadow-sm'
                : 'text-white/50 hover:bg-white/5 hover:text-white',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        {active === 'categories' && <CategoriesSection />}
        {active === 'items' && <ItemsSection />}
        {active === 'checkouts' && <CheckoutsSection />}
      </div>
    </>
  );
}
