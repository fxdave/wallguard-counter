/**
 * Backfills `order` (1000, 2000, …) on all categories and items, sorted by
 * their current `name` field so the visible order doesn't change on first run.
 */

export async function run(db) {
  // Categories
  const catsSnap = await db.collection('categories').get();
  if (catsSnap.size > 0) {
    const sorted = catsSnap.docs.sort((a, b) =>
      (a.data().name ?? '').localeCompare(b.data().name ?? ''),
    );
    const batch = db.batch();
    sorted.forEach((docSnap, i) => {
      batch.update(docSnap.ref, { order: (i + 1) * 1000 });
    });
    await batch.commit();
    console.log(`    categories: ${sorted.length} updated`);
  }

  // Items
  const itemsSnap = await db.collection('items').get();
  if (itemsSnap.size > 0) {
    const sorted = itemsSnap.docs.sort((a, b) =>
      (a.data().name ?? '').localeCompare(b.data().name ?? ''),
    );
    const batch = db.batch();
    sorted.forEach((docSnap, i) => {
      batch.update(docSnap.ref, { order: (i + 1) * 1000 });
    });
    await batch.commit();
    console.log(`    items: ${sorted.length} updated`);
  }
}
