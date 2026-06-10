import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  type QueryConstraint,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type {
  Category,
  CategoryInput,
  Checkout,
  CheckoutInput,
  Item,
  ItemInput,
} from './types';

/**
 * Thin typed data layer over the shared Firestore collections. All collections
 * are top-level and shared by every allowlisted user (household-style); access
 * is enforced by firestore.rules, not here.
 */

const categoriesCol = collection(db, 'categories');
const itemsCol = collection(db, 'items');
const checkoutsCol = collection(db, 'checkouts');

// ---------------------------------------------------------------- Categories

export async function listCategories(): Promise<Category[]> {
  const snap = await getDocs(query(categoriesCol, orderBy('name')));
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

// --------------------------------------------------------------------- Items

export async function listItems(): Promise<Item[]> {
  const snap = await getDocs(query(itemsCol, orderBy('name')));
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
