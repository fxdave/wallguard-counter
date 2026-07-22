import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLocalStorageState } from './useLocalStorageState';

// vitest's jsdom doesn't expose localStorage; install a minimal in-memory one.
function installStorageMock() {
  const store = new Map<string, string>();
  const mock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  };
  Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });
}

beforeEach(installStorageMock);
afterEach(() => window.localStorage.clear());

describe('useLocalStorageState', () => {
  it('uses the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorageState('k', { n: 1 }));
    expect(result.current[0]).toEqual({ n: 1 });
  });

  it('persists updates and restores them on the next mount', () => {
    const first = renderHook(() => useLocalStorageState('counts', {} as Record<string, number>));
    act(() => first.result.current[1]({ apple: 3 }));
    expect(window.localStorage.getItem('counts')).toBe('{"apple":3}');

    const second = renderHook(() => useLocalStorageState('counts', {} as Record<string, number>));
    expect(second.result.current[0]).toEqual({ apple: 3 });
  });

  it('falls back to the initial value on corrupt data', () => {
    window.localStorage.setItem('k', 'not json');
    const { result } = renderHook(() => useLocalStorageState('k', { ok: true }));
    expect(result.current[0]).toEqual({ ok: true });
  });

  it('round-trips a Set with custom serialize/deserialize', () => {
    const opts = {
      serialize: (s: Set<string>) => JSON.stringify([...s]),
      deserialize: (raw: string) => new Set(JSON.parse(raw) as string[]),
    };

    const first = renderHook(() => useLocalStorageState('discounts', new Set<string>(), opts));
    act(() => first.result.current[1](new Set(['a', 'b'])));
    expect(window.localStorage.getItem('discounts')).toBe('["a","b"]');

    const second = renderHook(() => useLocalStorageState('discounts', new Set<string>(), opts));
    expect(second.result.current[0]).toEqual(new Set(['a', 'b']));
  });
});
