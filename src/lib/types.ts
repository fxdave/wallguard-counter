import type { Timestamp } from 'firebase/firestore';

/** A grouping of items, e.g. "Drinks" or "Snacks". */
export interface Category {
  id: string;
  name: string;
  /** Emoji or short icon string shown next to the category. */
  icon: string;
}

/** A countable thing with a price, belonging to a category. */
export interface Item {
  id: string;
  name: string;
  icon: string;
  /** Unit price. `0` means "free / don't show price". */
  price: number;
  categoryId: string;
}

/**
 * One line within a checkout. `name` and `price` are SNAPSHOTTED at save time
 * so historical checkouts and exports stay correct even if the item is later
 * renamed, repriced, or hard-deleted. Never re-resolve these from the live item.
 */
export interface CheckoutLine {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
}

/** A batch counting session saved from the Quick Add page. */
export interface Checkout {
  id: string;
  createdAt: Timestamp;
  /** Sum of `price * quantity` across all lines, snapshotted at save time. */
  total: number;
  lines: CheckoutLine[];
}

/** Payloads for create/update — the `id` is assigned by Firestore. */
export type CategoryInput = Omit<Category, 'id'>;
export type ItemInput = Omit<Item, 'id'>;
export type CheckoutInput = Omit<Checkout, 'id'>;
