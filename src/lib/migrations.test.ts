/**
 * Integration tests for migration scripts.
 * Runs against the Firebase Emulator (must be running on localhost:8080).
 * The emulator uses open dev rules, so no auth is needed for Admin SDK access.
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
// @ts-expect-error — .mjs outside tsconfig include; allowed for test-only use
import { run } from '../../migrations/001_add_order.mjs';

function getAdminDb(): Firestore {
  if (getApps().length === 0) {
    initializeApp({ projectId: 'demo-wallguard' });
  }
  return getFirestore();
}

async function clearCollection(db: Firestore, col: string) {
  const snap = await db.collection(col).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

describe('migration 001: add_order', () => {
  it('backfills order on categories and items sorted by name', async () => {
    const db = getAdminDb();

    // Clear and seed
    await clearCollection(db, 'categories');
    await clearCollection(db, 'items');
    await clearCollection(db, '_migrations');

    await db.collection('categories').add({ name: 'Zebra', icon: '🦓' });
    await db.collection('categories').add({ name: 'Apple', icon: '🍎' });
    await db.collection('categories').add({ name: 'Mango', icon: '🥭' });

    await db.collection('items').add({ name: 'Water', icon: '💧', price: 1, categoryId: 'x' });
    await db.collection('items').add({ name: 'Juice', icon: '🧃', price: 2, categoryId: 'x' });

    // Run migration
    await run(db);

    // Assert categories
    const cats = await db.collection('categories').orderBy('order').get();
    const catNames = cats.docs.map((d) => d.data()['name'] as string);
    expect(catNames).toEqual(['Apple', 'Mango', 'Zebra']);
    const catOrders = cats.docs.map((d) => d.data()['order'] as number);
    expect(catOrders).toEqual([1000, 2000, 3000]);

    // Assert items
    const its = await db.collection('items').orderBy('order').get();
    const itemNames = its.docs.map((d) => d.data()['name'] as string);
    expect(itemNames).toEqual(['Juice', 'Water']);
    const itemOrders = its.docs.map((d) => d.data()['order'] as number);
    expect(itemOrders).toEqual([1000, 2000]);
  });
});
