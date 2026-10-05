// Thin localStorage wrapper that never throws (private browsing, storage
// quota, or disabled storage should degrade gracefully, not crash the app).

export function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const k = "__inkfluently_test__" + Math.random();
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function lsSet<T>(key: string, val: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
}
