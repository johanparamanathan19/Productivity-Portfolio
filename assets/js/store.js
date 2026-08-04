/**
 * Tiny localStorage wrapper.
 *
 * Every call is guarded: private browsing, disabled storage, and corrupt
 * values all degrade to the fallback instead of throwing and taking a
 * tool down with them.
 */

/**
 * @template T
 * @param {string} key
 * @param {T} fallback returned when the key is missing or unreadable
 * @returns {T}
 */
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {unknown} value must be JSON-serialisable
 */
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage unavailable — nothing useful to do */
  }
}

/** @param {string} key */
export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
