import { useEffect, useRef, useState } from 'react';

interface Options<T> {
  /** Turn the value into a string for storage. Defaults to `JSON.stringify`. */
  serialize?: (value: T) => string;
  /** Rebuild the value from a stored string. Defaults to `JSON.parse`. */
  deserialize?: (raw: string) => T;
}

/**
 * `useState` that mirrors its value into `localStorage` under `key`. The initial
 * render reads any persisted value; every change writes it back. Corrupt,
 * missing, or unavailable storage falls back to `initialValue` — reads and
 * writes never throw. Pass `serialize`/`deserialize` for non-JSON values such as
 * a `Set`.
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
  options: Options<T> = {},
) {
  const serialize = options.serialize ?? JSON.stringify;
  const deserialize = options.deserialize ?? (JSON.parse as (raw: string) => T);

  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initialValue : deserialize(raw);
    } catch {
      return initialValue;
    }
  });

  // Hold the latest serializer in a ref so an inline function passed fresh each
  // render doesn't re-run the write effect on its own.
  const serializeRef = useRef(serialize);
  useEffect(() => {
    serializeRef.current = serialize;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serializeRef.current(state));
    } catch {
      // Ignore write failures (quota, private mode, storage disabled).
    }
  }, [key, state]);

  return [state, setState] as const;
}
