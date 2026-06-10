/**
 * Integration tests for Firestore data layer behaviour.
 * Runs against the Firebase Emulator (FIRESTORE_EMULATOR_HOST must be set).
 * Uses Admin SDK so rules are bypassed — we're testing query/mutation logic,
 * not security rules.
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import {
  getFirestore,
  FieldValue,
  Timestamp,
  type Firestore,
} from 'firebase-admin/firestore';
// @ts-expect-error — .mjs outside tsconfig include; allowed for test-only use
import { run as run002 } from '../../migrations/002_add_usage_count_and_started_at_to_pass_holders.mjs';

const emulatorAvailable = !!process.env.FIRESTORE_EMULATOR_HOST;

function db(): Firestore {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-wallguard' });
  return getFirestore();
}

async function clear(col: string) {
  const snap = await db().collection(col).get();
  const batch = db().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

async function seed(col: string, docs: FirebaseFirestore.DocumentData[]) {
  const batch = db().batch();
  docs.forEach((data) => batch.set(db().collection(col).doc(), data));
  await batch.commit();
}

// ─── helpers that mirror firestore.ts logic using Admin SDK ────────────────

const PAGE_SIZE = 25;

async function listCheckoutsPage(cursor?: FirebaseFirestore.QueryDocumentSnapshot) {
  let q = db()
    .collection('checkouts')
    .orderBy('createdAt', 'desc')
    .limit(PAGE_SIZE);
  if (cursor) q = q.startAfter(cursor) as typeof q;
  const snap = await q.get();
  const nextCursor = snap.size === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : undefined;
  return { checkouts: snap.docs.map((d) => ({ id: d.id, ...d.data() })), nextCursor };
}

async function addMember(email: string, addedBy: string) {
  await db().collection('members').doc(email).set({ email, addedBy, addedAt: FieldValue.serverTimestamp() });
}

async function listMembers() {
  const snap = await db().collection('members').orderBy('addedAt').get();
  return snap.docs.map((d) => ({ email: d.id, ...d.data() }));
}

async function removeMember(email: string) {
  await db().collection('members').doc(email).delete();
}

async function checkAccess(email: string): Promise<boolean> {
  const doc = await db().collection('members').doc(email.toLowerCase()).get();
  return doc.exists;
}

async function listCheckouts(range?: { from: Date; to: Date }) {
  let q: FirebaseFirestore.Query = db().collection('checkouts').orderBy('createdAt', 'desc');
  if (range) {
    q = q
      .where('createdAt', '>=', Timestamp.fromDate(range.from))
      .where('createdAt', '<', Timestamp.fromDate(range.to));
  }
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function reorderCategories(orderedIds: string[]) {
  const batch = db().batch();
  orderedIds.forEach((id, i) => batch.update(db().collection('categories').doc(id), { order: (i + 1) * 1000 }));
  await batch.commit();
}

async function reorderItems(orderedIds: string[]) {
  const batch = db().batch();
  orderedIds.forEach((id, i) => batch.update(db().collection('items').doc(id), { order: (i + 1) * 1000 }));
  await batch.commit();
}

async function searchPassHolders(passItemId: string, search: string) {
  const snap = await db()
    .collection('passHolders')
    .where('passItemId', '==', passItemId)
    .orderBy('name')
    .get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() as { name: string } }));
  if (!search.trim()) return all.slice(0, 50);
  const lower = search.trim().toLowerCase();
  return all.filter((h) => h.name.toLowerCase().includes(lower)).slice(0, 50);
}

async function incrementPassHolderUsage(id: string) {
  await db().collection('passHolders').doc(id).update({ usageCount: FieldValue.increment(1) });
}

async function countPassHolders(passItemId: string) {
  const snap = await db().collection('passHolders').where('passItemId', '==', passItemId).get();
  return snap.size;
}

// ─── tests ────────────────────────────────────────────────────────────────

describe.skipIf(!emulatorAvailable)('Firestore data layer', () => {

  // ── 1. Checkout pagination ──────────────────────────────────────────────
  describe('listCheckoutsPage', () => {
    beforeEach(() => clear('checkouts'));

    it('returns first page of 25 with a cursor when more exist', async () => {
      const base = new Date('2026-01-01T00:00:00Z');
      const batch = db().batch();
      for (let i = 0; i < 30; i++) {
        batch.set(db().collection('checkouts').doc(), {
          createdAt: Timestamp.fromDate(new Date(base.getTime() + i * 60_000)),
          total: i,
          lines: [],
        });
      }
      await batch.commit();

      const page1 = await listCheckoutsPage();
      expect(page1.checkouts).toHaveLength(25);
      expect(page1.nextCursor).toBeDefined();
    });

    it('second page contains remaining docs and no cursor', async () => {
      const base = new Date('2026-01-01T00:00:00Z');
      const batch = db().batch();
      for (let i = 0; i < 30; i++) {
        batch.set(db().collection('checkouts').doc(), {
          createdAt: Timestamp.fromDate(new Date(base.getTime() + i * 60_000)),
          total: i,
          lines: [],
        });
      }
      await batch.commit();

      const page1 = await listCheckoutsPage();
      const page2 = await listCheckoutsPage(page1.nextCursor);
      expect(page2.checkouts).toHaveLength(5);
      expect(page2.nextCursor).toBeUndefined();
    });

    it('returns no cursor when results fit in one page', async () => {
      await seed('checkouts', [
        { createdAt: Timestamp.fromDate(new Date('2026-01-01')), total: 1, lines: [] },
      ]);
      const page = await listCheckoutsPage();
      expect(page.checkouts).toHaveLength(1);
      expect(page.nextCursor).toBeUndefined();
    });
  });

  // ── 2 & 3. Member add / list / remove ──────────────────────────────────
  describe('addMember / listMembers / removeMember', () => {
    beforeEach(() => clear('members'));

    it('added member appears in list ordered by addedAt', async () => {
      await addMember('alice@example.com', 'owner@example.com');
      await addMember('bob@example.com', 'owner@example.com');
      const members = await listMembers();
      const emails = members.map((m) => (m as { email: string }).email);
      expect(emails).toContain('alice@example.com');
      expect(emails).toContain('bob@example.com');
    });

    it('addMember is idempotent — second write does not duplicate', async () => {
      await addMember('alice@example.com', 'owner');
      await addMember('alice@example.com', 'owner');
      const members = await listMembers();
      expect(members.filter((m) => (m as { email: string }).email === 'alice@example.com')).toHaveLength(1);
    });

    it('removed member no longer appears in list', async () => {
      await addMember('alice@example.com', 'owner');
      await removeMember('alice@example.com');
      const members = await listMembers();
      expect(members.map((m) => (m as { email: string }).email)).not.toContain('alice@example.com');
    });
  });

  // ── 4. checkAccess ─────────────────────────────────────────────────────
  describe('checkAccess', () => {
    beforeEach(() => clear('members'));

    it('returns true for a member', async () => {
      await addMember('member@example.com', 'owner');
      expect(await checkAccess('member@example.com')).toBe(true);
    });

    it('returns false for a non-member', async () => {
      expect(await checkAccess('nobody@example.com')).toBe(false);
    });

    it('is case-insensitive', async () => {
      await addMember('alice@example.com', 'owner');
      expect(await checkAccess('ALICE@EXAMPLE.COM')).toBe(true);
    });
  });

  // ── 5. createCheckout + listCheckouts date range ────────────────────────
  describe('listCheckouts date range', () => {
    beforeEach(() => clear('checkouts'));

    it('returns all checkouts when no range given', async () => {
      await seed('checkouts', [
        { createdAt: Timestamp.fromDate(new Date('2026-01-15')), total: 1, lines: [] },
        { createdAt: Timestamp.fromDate(new Date('2026-03-10')), total: 2, lines: [] },
      ]);
      const results = await listCheckouts();
      expect(results).toHaveLength(2);
    });

    it('filters checkouts inside the range', async () => {
      await seed('checkouts', [
        { createdAt: Timestamp.fromDate(new Date('2026-01-10')), total: 1, lines: [] },
        { createdAt: Timestamp.fromDate(new Date('2026-02-10')), total: 2, lines: [] },
        { createdAt: Timestamp.fromDate(new Date('2026-03-10')), total: 3, lines: [] },
      ]);
      const results = await listCheckouts({
        from: new Date('2026-01-15'),
        to: new Date('2026-03-01'),
      });
      expect(results).toHaveLength(1);
      expect((results[0] as FirebaseFirestore.DocumentData)['total']).toBe(2);
    });

    it('range boundary: from is inclusive, to is exclusive', async () => {
      const from = new Date('2026-02-01T00:00:00Z');
      const to = new Date('2026-03-01T00:00:00Z');
      await seed('checkouts', [
        { createdAt: Timestamp.fromDate(from), total: 10, lines: [] },
        { createdAt: Timestamp.fromDate(to), total: 20, lines: [] },
      ]);
      const results = await listCheckouts({ from, to });
      expect(results).toHaveLength(1);
      expect((results[0] as FirebaseFirestore.DocumentData)['total']).toBe(10);
    });
  });

  // ── 6. reorderCategories / reorderItems ────────────────────────────────
  describe('reorder', () => {
    beforeEach(async () => {
      await clear('categories');
      await clear('items');
    });

    it('reorderCategories assigns 1000-spaced order values in given sequence', async () => {
      const ids: string[] = [];
      for (const name of ['C', 'A', 'B']) {
        const ref = await db().collection('categories').add({ name, order: 0 });
        ids.push(ref.id);
      }
      // Move index 1 to front: [A, C, B] → new order
      await reorderCategories([ids[1], ids[0], ids[2]]);
      const snap = await db().collection('categories').orderBy('order').get();
      const names = snap.docs.map((d) => d.data()['name'] as string);
      expect(names).toEqual(['A', 'C', 'B']);
      const orders = snap.docs.map((d) => d.data()['order'] as number);
      expect(orders).toEqual([1000, 2000, 3000]);
    });

    it('reorderItems renumbers all items on each move', async () => {
      const ids: string[] = [];
      for (const name of ['X', 'Y', 'Z']) {
        const ref = await db().collection('items').add({ name, order: 0 });
        ids.push(ref.id);
      }
      await reorderItems([ids[2], ids[0], ids[1]]);
      const snap = await db().collection('items').orderBy('order').get();
      const names = snap.docs.map((d) => d.data()['name'] as string);
      expect(names).toEqual(['Z', 'X', 'Y']);
    });
  });

  // ── 7. searchPassHolders ───────────────────────────────────────────────
  describe('searchPassHolders', () => {
    const passItemId = 'item-search-test';
    beforeEach(() => clear('passHolders'));

    async function addHolder(name: string) {
      await db().collection('passHolders').add({ name, passItemId, birthday: '2000-01-01', startedAt: '2026-01-01', usageCount: 0, createdAt: FieldValue.serverTimestamp() });
    }

    it('empty search returns holders (up to 50)', async () => {
      await addHolder('Alice');
      await addHolder('Bob');
      const results = await searchPassHolders(passItemId, '');
      expect(results.map((h) => h.name)).toEqual(['Alice', 'Bob']);
    });

    it('filters by name substring case-insensitively', async () => {
      await addHolder('Alice Smith');
      await addHolder('Bob Jones');
      await addHolder('alicia keys');
      const results = await searchPassHolders(passItemId, 'ali');
      const names = results.map((h) => h.name);
      expect(names).toContain('Alice Smith');
      expect(names).toContain('alicia keys');
      expect(names).not.toContain('Bob Jones');
    });

    it('returns empty array when no match', async () => {
      await addHolder('Alice');
      expect(await searchPassHolders(passItemId, 'zzz')).toHaveLength(0);
    });

    it('caps results at 50 for empty search', async () => {
      const batch = db().batch();
      for (let i = 0; i < 60; i++) {
        batch.set(db().collection('passHolders').doc(), { name: `Holder ${String(i).padStart(3, '0')}`, passItemId, birthday: '2000-01-01', startedAt: '2026-01-01', usageCount: 0, createdAt: FieldValue.serverTimestamp() });
      }
      await batch.commit();
      const results = await searchPassHolders(passItemId, '');
      expect(results).toHaveLength(50);
    });

    it('ignores holders from other pass items', async () => {
      await db().collection('passHolders').add({ name: 'Other', passItemId: 'other-item', birthday: '2000-01-01', startedAt: '2026-01-01', usageCount: 0, createdAt: FieldValue.serverTimestamp() });
      await addHolder('Alice');
      const results = await searchPassHolders(passItemId, '');
      expect(results.map((h) => h.name)).toEqual(['Alice']);
    });
  });

  // ── 8. incrementPassHolderUsage ────────────────────────────────────────
  describe('incrementPassHolderUsage', () => {
    beforeEach(() => clear('passHolders'));

    it('increments usageCount by 1', async () => {
      const ref = await db().collection('passHolders').add({ name: 'Alice', passItemId: 'p1', usageCount: 3, birthday: '2000-01-01', startedAt: '2026-01-01', createdAt: FieldValue.serverTimestamp() });
      await incrementPassHolderUsage(ref.id);
      const snap = await ref.get();
      expect(snap.data()!['usageCount']).toBe(4);
    });

    it('handles concurrent increments correctly (sequential simulation)', async () => {
      const ref = await db().collection('passHolders').add({ name: 'Bob', passItemId: 'p1', usageCount: 0, birthday: '2000-01-01', startedAt: '2026-01-01', createdAt: FieldValue.serverTimestamp() });
      await Promise.all([
        incrementPassHolderUsage(ref.id),
        incrementPassHolderUsage(ref.id),
        incrementPassHolderUsage(ref.id),
      ]);
      const snap = await ref.get();
      expect(snap.data()!['usageCount']).toBe(3);
    });
  });

  // ── 9. countPassHolders ────────────────────────────────────────────────
  describe('countPassHolders', () => {
    beforeEach(() => clear('passHolders'));

    it('returns 0 when no holders exist', async () => {
      expect(await countPassHolders('empty-item')).toBe(0);
    });

    it('returns correct count for the given item', async () => {
      const batch = db().batch();
      for (let i = 0; i < 3; i++) {
        batch.set(db().collection('passHolders').doc(), { name: `H${i}`, passItemId: 'item-a', usageCount: 0, birthday: '2000-01-01', startedAt: '2026-01-01', createdAt: FieldValue.serverTimestamp() });
      }
      batch.set(db().collection('passHolders').doc(), { name: 'Other', passItemId: 'item-b', usageCount: 0, birthday: '2000-01-01', startedAt: '2026-01-01', createdAt: FieldValue.serverTimestamp() });
      await batch.commit();
      expect(await countPassHolders('item-a')).toBe(3);
      expect(await countPassHolders('item-b')).toBe(1);
    });
  });

  // ── 11. Migration 002 ──────────────────────────────────────────────────
  describe('migration 002: add_usage_count_and_started_at_to_pass_holders', () => {
    beforeEach(async () => {
      await clear('passHolders');
      await clear('_migrations');
    });

    it('backfills usageCount: 0 on holders missing the field', async () => {
      const createdAt = Timestamp.fromDate(new Date('2025-06-01T12:00:00Z'));
      await db().collection('passHolders').add({ name: 'Alice', passItemId: 'p1', birthday: '2000-01-01', createdAt });
      await run002(db());
      const snap = await db().collection('passHolders').get();
      for (const doc of snap.docs) {
        expect(doc.data()['usageCount']).toBe(0);
      }
    });

    it('backfills startedAt from createdAt timestamp', async () => {
      const createdAt = Timestamp.fromDate(new Date('2025-06-01T12:00:00Z'));
      await db().collection('passHolders').add({ name: 'Bob', passItemId: 'p1', birthday: '2000-01-01', createdAt });
      await run002(db());
      const snap = await db().collection('passHolders').get();
      for (const doc of snap.docs) {
        expect(doc.data()['startedAt']).toBe('2025-06-01');
      }
    });

    it('does not overwrite existing usageCount or startedAt', async () => {
      await db().collection('passHolders').add({
        name: 'Carol',
        passItemId: 'p1',
        birthday: '2000-01-01',
        usageCount: 5,
        startedAt: '2024-01-15',
        createdAt: Timestamp.fromDate(new Date('2025-01-01')),
      });
      await run002(db());
      const snap = await db().collection('passHolders').get();
      const data = snap.docs[0].data();
      expect(data['usageCount']).toBe(5);
      expect(data['startedAt']).toBe('2024-01-15');
    });
  });
});
