import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  type QueryConstraint,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from '../firebase/config';
import type {
  Category,
  CategoryInput,
  Checkout,
  CheckoutInput,
  Item,
  ItemInput,
  Member,
  PassHolder,
  PassHolderInput,
} from './types';

/**
 * Thin typed data layer over the shared Firestore collections. All collections
 * are top-level and shared by every allowlisted user (household-style); access
 * is enforced by firestore.rules, not here.
 */

const categoriesCol = collection(db, 'categories');
const itemsCol = collection(db, 'items');
const checkoutsCol = collection(db, 'checkouts');
const membersCol = collection(db, 'members');
const passHoldersCol = collection(db, 'passHolders');

// ------------------------------------------------------------------- Members

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Determine whether the signed-in user is allowed to use the app. Reads of the
 * `members` collection are themselves gated by `isMember()` in the rules, so a
 * successful read means the caller is a member (or the owner); a
 * permission-denied means they are not. Other errors propagate.
 */
export async function checkAccess(email: string): Promise<boolean> {
  try {
    await getDoc(doc(membersCol, normalizeEmail(email)));
    return true;
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'permission-denied') {
      return false;
    }
    throw err;
  }
}

export async function listMembers(): Promise<Member[]> {
  const snap = await getDocs(query(membersCol, orderBy('email')));
  return snap.docs.map((d) => ({ email: d.id, ...(d.data() as Omit<Member, 'email'>) }));
}

/** Add an eligible user. Idempotent — the email is the document id. */
export async function addMember(email: string, addedBy: string): Promise<void> {
  const normalized = normalizeEmail(email);
  await setDoc(doc(membersCol, normalized), {
    addedBy,
    addedAt: serverTimestamp(),
  });
}

export async function removeMember(email: string): Promise<void> {
  await deleteDoc(doc(membersCol, normalizeEmail(email)));
}

// ---------------------------------------------------------------- Categories

export async function listCategories(): Promise<Category[]> {
  const snap = await getDocs(query(categoriesCol, orderBy('order')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryInput) }));
}

export async function createCategory(input: CategoryInput): Promise<string> {
  const ref = await addDoc(categoriesCol, input);
  return ref.id;
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
): Promise<void> {
  await updateDoc(doc(categoriesCol, id), input);
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(categoriesCol, id));
}

/** Reassigns order values (1000, 2000, 3000…) for all categories in the given sequence. */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(categoriesCol, id), { order: (index + 1) * 1000 });
  });
  await batch.commit();
}

// --------------------------------------------------------------- Pass holders

/** List the holders of a given pass item, ordered by name. */
export async function listPassHolders(passItemId: string): Promise<PassHolder[]> {
  const snap = await getDocs(
    query(passHoldersCol, where('passItemId', '==', passItemId), orderBy('name')),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<PassHolder, 'id'>),
  }));
}

export async function createPassHolder(input: PassHolderInput): Promise<string> {
  const ref = await addDoc(passHoldersCol, {
    ...input,
    usageCount: input.usageCount ?? 0,
    startedAt: input.startedAt ?? new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePassHolder(
  id: string,
  input: Partial<Omit<PassHolder, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(passHoldersCol, id), input);
}

export async function deletePassHolder(id: string): Promise<void> {
  await deleteDoc(doc(passHoldersCol, id));
}

/** Returns the number of pass holders for a given pass item. */
export async function countPassHolders(passItemId: string): Promise<number> {
  const snap = await getDocs(
    query(passHoldersCol, where('passItemId', '==', passItemId)),
  );
  return snap.size;
}

/** Atomically increments usageCount on a pass holder. */
export async function incrementPassHolderUsage(id: string): Promise<void> {
  await updateDoc(doc(passHoldersCol, id), { usageCount: increment(1) });
}

// --------------------------------------------------------------------- Items

export async function listItems(): Promise<Item[]> {
  const snap = await getDocs(query(itemsCol, orderBy('order')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ItemInput) }));
}

export async function createItem(input: ItemInput): Promise<string> {
  const ref = await addDoc(itemsCol, input);
  return ref.id;
}

export async function updateItem(
  id: string,
  input: Partial<ItemInput>,
): Promise<void> {
  await updateDoc(doc(itemsCol, id), input);
}

export async function deleteItem(id: string): Promise<void> {
  await deleteDoc(doc(itemsCol, id));
}

/** Reassigns order values (1000, 2000, 3000…) for all items in the given sequence. */
export async function reorderItems(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(itemsCol, id), { order: (index + 1) * 1000 });
  });
  await batch.commit();
}

// ----------------------------------------------------------------- Checkouts

/**
 * Persist a batch checkout. The caller passes pre-snapshotted lines (name +
 * price copied from the items at the time of saving). `createdAt` is set by the
 * server clock unless an explicit date is provided (used when editing).
 */
export async function createCheckout(
  input: Omit<CheckoutInput, 'createdAt'> & { createdAt?: Date },
): Promise<string> {
  const ref = await addDoc(checkoutsCol, {
    ...input,
    createdAt: input.createdAt
      ? Timestamp.fromDate(input.createdAt)
      : serverTimestamp(),
  });
  return ref.id;
}

export async function updateCheckout(
  id: string,
  input: Partial<Omit<CheckoutInput, 'createdAt'>> & { createdAt?: Date },
): Promise<void> {
  const { createdAt, ...rest } = input;
  await updateDoc(doc(checkoutsCol, id), {
    ...rest,
    ...(createdAt ? { createdAt: Timestamp.fromDate(createdAt) } : {}),
  });
}

export async function deleteCheckout(id: string): Promise<void> {
  await deleteDoc(doc(checkoutsCol, id));
}

/**
 * List checkouts, newest first, optionally constrained to a [from, to) date
 * range on `createdAt`. Used by Overview (current month) and Export (range).
 */
export async function listCheckouts(range?: {
  from: Date;
  to: Date;
}): Promise<Checkout[]> {
  const constraints: QueryConstraint[] = [];
  if (range) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(range.from)));
    constraints.push(where('createdAt', '<', Timestamp.fromDate(range.to)));
  }
  constraints.push(orderBy('createdAt', 'desc'));

  const snap = await getDocs(query(checkoutsCol, ...constraints));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<Checkout, 'id'>;
    return { id: d.id, ...data };
  });
}
