import { DictionaryLoadError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Dictionary checker backed by a bundled, read-only wordlist asset
 * (public/dictionaries/rockyou.txt). Performs case-insensitive membership
 * checks so common passwords are flagged regardless of entropy.
 *
 * In Electron: uses IPC to the main process, which loads the file via
 * Node's fs module (fetch doesn't work with file:// URLs and CSP blocks
 * it anyway). The main process holds the Set and returns the lookup result.
 *
 * In a browser/dev: falls back to fetch() against the Vite-served asset.
 *
 * The input password is never logged or persisted.
 */

let dictionaryPromise = null;

/**
 * Loads the wordlist via fetch (browser/dev only) and returns it as a
 * lowercase Set. Cached so subsequent calls share the same promise.
 *
 * @returns {Promise<Set<string>>}
 */
function loadDictionaryViaFetch() {
  if (dictionaryPromise) return dictionaryPromise;

  dictionaryPromise = (async () => {
    try {
      const url = new URL(
        './dictionaries/rockyou.txt',
        document.baseURI,
      ).href;
      const res = await fetch(url);
      if (!res.ok) {
        throw new DictionaryLoadError(
          `Failed to load wordlist: HTTP ${res.status}`,
        );
      }
      const text = await res.text();
      const set = new Set();
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim().toLowerCase();
        if (trimmed) set.add(trimmed);
      }
      logger.info('Dictionary loaded via fetch', { entries: set.size });
      return set;
    } catch (err) {
      dictionaryPromise = null; // allow retry on next call
      if (err instanceof DictionaryLoadError) throw err;
      throw new DictionaryLoadError(err.message, { cause: err });
    }
  })();

  return dictionaryPromise;
}

/**
 * Checks whether the given input appears in the bundled dictionary.
 *
 * In Electron, delegates to the main process via IPC (window.appRuntime).
 * In a browser, falls back to loading the file via fetch.
 *
 * @param {string} input - Candidate password.
 * @returns {Promise<{inDictionary: boolean, loaded: boolean}>}
 */
export async function checkDictionary(input) {
  if (!input) return { inDictionary: false, loaded: false };

  // Electron IPC path — preferred when available
  if (typeof window !== 'undefined' && window.appRuntime?.checkDictionary) {
    try {
      return await window.appRuntime.checkDictionary(input);
    } catch (err) {
      logger.warn('IPC dictionary check failed, falling back to fetch', {
        error: err.message,
      });
    }
  }

  // Browser/dev fallback via fetch
  try {
    const dict = await loadDictionaryViaFetch();
    return { inDictionary: dict.has(input.toLowerCase()), loaded: true };
  } catch (err) {
    logger.warn('Dictionary unavailable, skipping check', {
      error: err.message,
    });
    return { inDictionary: false, loaded: false };
  }
}

/**
 * Test-only helper to inject a pre-built dictionary and bypass both IPC
 * and fetch.
 * @param {Set<string>|null} dict
 */
export function __setDictionaryForTests(dict) {
  dictionaryPromise = dict ? Promise.resolve(dict) : null;
}
