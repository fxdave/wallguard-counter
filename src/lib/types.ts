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
  /**
   * When true this item is a "pass": adding it in Quick Add opens a search of
   * its pass holders. A known holder counts at price 0; an unknown person is
   * registered and counted at `price`. Absent/false for normal items.
   */
  isPass?: boolean;
  /** When true, the pass can expire based on `expiryExpression`. */
  canExpire?: boolean;
  /**
   * A JS expression string evaluated at check-in time. Receives `holder`
   * (PassHolder) and `today` (Date). Should return `true` if the pass is
   * expired/over-limit. Only used when `canExpire` is true.
   */
  expiryExpression?: string;
  /** Sort order for display. Higher numbers appear later. */
  order?: number;
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
  /** The pass item (`Item.id`, where `isPass`) this holder belongs to. */
  passItemId: string;
  /** `YYYY-MM-DD` — the date this holder started using the pass. */
  startedAt: string;
  /** Number of times this holder has used the pass. */
  usageCount: number;
  createdAt: Timestamp;
}

export type PassHolderInput = Omit<PassHolder, 'id' | 'createdAt'>;

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
  /** For pass entries: the person this line was counted for (snapshotted). */
  holderName?: string;
  /** For pass entries: the person's birthday (`YYYY-MM-DD`), snapshotted. */
  holderBirthday?: string;
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
