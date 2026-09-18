import type { Item, PassHolder } from './types';

/**
 * Whether `holder` is expired / over limit for `item`, per the item's
 * `expiryExpression`. Items that can't expire never report expiry. An
 * expression that throws is logged and treated as "not expired" so a typo in
 * Settings doesn't start charging every holder.
 */
export function isHolderExpired(item: Item, holder: PassHolder, today: Date = new Date()): boolean {
  if (!item.canExpire || !item.expiryExpression) return false;
  try {
    return (
      new Function('holder', 'today', `return (${item.expiryExpression})`)(holder, today) === true
    );
  } catch {
    console.warn('passExpiry: expiry expression error', item.expiryExpression);
    return false;
  }
}
