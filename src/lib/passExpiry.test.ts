import { describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { isHolderExpired } from './passExpiry';
import type { Item, PassHolder } from './types';

const item: Item = {
  id: 'p1',
  name: 'Pass',
  icon: '',
  price: 1000,
  categoryId: 'c1',
  order: 1000,
  isPass: true,
  canExpire: true,
  expiryExpression: 'holder.usageCount >= 10 || new Date(holder.startedAt) < new Date(today - 30 * 86400000)',
};

const holder: PassHolder = {
  id: 'h1',
  name: 'Alice',
  birthday: '2000-01-01',
  startedAt: '2026-09-01',
  passItemId: 'p1',
  createdAt: Timestamp.now(),
  usageCount: 3,
};

const today = new Date('2026-09-18T12:00:00Z');

describe('isHolderExpired', () => {
  it('is false for a valid holder', () => {
    expect(isHolderExpired(item, holder, today)).toBe(false);
  });

  it('is true when over the usage limit', () => {
    expect(isHolderExpired(item, { ...holder, usageCount: 10 }, today)).toBe(true);
  });

  it('is true when started too long ago', () => {
    expect(isHolderExpired(item, { ...holder, startedAt: '2026-07-01' }, today)).toBe(true);
  });

  it('is false when the item cannot expire, even with an expression', () => {
    expect(isHolderExpired({ ...item, canExpire: false }, { ...holder, usageCount: 99 }, today)).toBe(false);
  });

  it('is false when the expression is empty', () => {
    expect(isHolderExpired({ ...item, expiryExpression: '' }, { ...holder, usageCount: 99 }, today)).toBe(false);
  });

  it('is false (and warns) when the expression throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(isHolderExpired({ ...item, expiryExpression: 'holder.nope.deep' }, holder, today)).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('requires a strict true, not a truthy value', () => {
    expect(isHolderExpired({ ...item, expiryExpression: '"yes"' }, holder, today)).toBe(false);
  });
});
