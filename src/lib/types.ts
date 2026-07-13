import type { Timestamp } from 'firebase/firestore';

/** A grouping of items, e.g. "Drinks" or "Snacks". */
export interface Category {
  id: string;
  name: string;
  /** Emoji or short icon string shown next to the category. */
  icon: string;
  /** Display order; lower numbers appear first. Multiples of 1000. */
  order: number;
}

/** A countable thing with a price, belonging to a category. */
export interface Item {
  id: string;
  name: string;
  icon: string;
  /** Unit price. `0` means "free / don't show price". */
  price: number;
  categoryId: string;
  /** Display order; lower numbers appear first. Multiples of 1000. */
  order: number;
  /**
   * When true this item is a "pass": adding it in Quick Add opens a search of
   * its pass holders. A known holder counts at price 0; an unknown person is
   * registered and counted at `price`. Absent/false for normal items.
   */
  isPass?: boolean;
  /** When true, pass holders of this item can expire. Pass items only. */
  canExpire?: boolean;
  /**
   * JS expression string evaluated to check if a holder is expired/over-limit.
   * Receives `holder` (PassHolder) and `today` (Date). Returns `true` if invalid.
   * Example: `holder.usageCount >= 10 || new Date(holder.startedAt) < new Date(today - 30 * 86400000)`
   * Only meaningful when `canExpire` is true.
   */
  expiryExpression?: string;
}

/**
 * A person who holds a given pass. Scoped to one pass item via `passItemId`, so
 * holding the gym pass doesn't imply holding the pool pass. Searched by name +
 * birthday in the Quick Add pass modal.
 */
export interface PassHolder {
  id: string;
  name: string;
  /** `YYYY-MM-DD` (date-input value). */
  birthday: string;
  /** `YYYY-MM-DD` — when the pass was activated. Defaults to registration date. */
  startedAt: string;
  /** The pass item (`Item.id`, where `isPass`) this holder belongs to. */
  passItemId: string;
  createdAt: Timestamp;
  /** Number of times this holder has been counted in a checkout. */
  usageCount: number;
}

export type PassHolderInput = Omit<PassHolder, 'id' | 'createdAt'>;

/**
 * A named percentage discount, e.g. "Internal staff" at 50%. Toggled on/off in
 * Quick Add; multiple may be active and stack multiplicatively in `order`.
 */
export interface Discount {
  id: string;
  name: string;
  /** Percent off, 0–100 (e.g. `50` means 50% off). */
  percent: number;
  /** Display + application order; lower numbers apply first. Multiples of 1000. */
  order: number;
}

/**
 * One line within a checkout. `name` and `price` are SNAPSHOTTED at save time
 * so historical checkouts and exports stay correct even if the item is later
 * renamed, repriced, or hard-deleted. Never re-resolve these from the live item.
 */
export interface CheckoutLine {
  /** Item id, pass item id, or discount id depending on the line kind. */
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  /** For pass entries: the person this line was counted for (snapshotted). */
  holderName?: string;
  /** For pass entries: the person's birthday (`YYYY-MM-DD`), snapshotted. */
  holderBirthday?: string;
  /**
   * Present only on discount lines: the discount percent applied (snapshotted).
   * Discount lines carry a NEGATIVE `price` (the reduction amount) and quantity 1.
   */
  percent?: number;
}

/** A batch counting session saved from the Quick Add page. */
export interface Checkout {
  id: string;
  createdAt: Timestamp;
  /** Sum of `price * quantity` across all lines, snapshotted at save time. */
  total: number;
  lines: CheckoutLine[];
}

/**
 * An eligible user. The document id is the member's lowercased email, so rules
 * can gate access with a cheap `exists(/members/$(email))` check. The bootstrap
 * owner (hardcoded in firestore.rules) has access without a document.
 */
export interface Member {
  /** Lowercased email — also the Firestore document id. */
  email: string;
  /** Email of the member who added this one (or "owner" when seeded). */
  addedBy: string;
  addedAt: Timestamp;
}

/** Payloads for create/update — the `id` is assigned by Firestore. */
export type CategoryInput = Omit<Category, 'id'>;
export type ItemInput = Omit<Item, 'id'>;
export type CheckoutInput = Omit<Checkout, 'id'>;
export type DiscountInput = Omit<Discount, 'id'>;
