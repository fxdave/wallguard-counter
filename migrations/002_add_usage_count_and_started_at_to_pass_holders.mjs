/**
 * Backfills `usageCount` (0) and `startedAt` (derived from `createdAt`)
 * on all existing pass holders that don't have these fields yet.
 */

export async function run(db) {
  const snap = await db.collection('passHolders').get();
  if (snap.size === 0) {
    console.log('    passHolders: nothing to migrate');
    return;
  }

  const batch = db.batch();
  let count = 0;
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const update = {};
    if (!('usageCount' in data)) update.usageCount = 0;
    if (!('startedAt' in data)) {
      const createdAt = data.createdAt?.toDate?.();
      update.startedAt = createdAt
        ? createdAt.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    }
    if (Object.keys(update).length > 0) {
      batch.update(docSnap.ref, update);
      count++;
    }
  });
  await batch.commit();
  console.log(`    passHolders: ${count} updated`);
}
