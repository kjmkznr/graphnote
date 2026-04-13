/**
 * Shared IndexedDB singleton for the 'graphnote' database.
 * All object stores are created here to avoid upgrade conflicts
 * when multiple modules open the same database independently.
 */

export const IDB_DB_NAME = 'graphnote';
export const IDB_VERSION = 4;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openGraphnoteDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) {
        db.createObjectStore('graphs');
      }
      if (event.oldVersion < 2) {
        if (!db.objectStoreNames.contains('bookmarks')) {
          db.createObjectStore('bookmarks', { keyPath: 'id' });
        }
      }
      if (event.oldVersion < 3) {
        if (!db.objectStoreNames.contains('graph-meta')) {
          db.createObjectStore('graph-meta', { keyPath: 'id' });
        }
      }
      if (event.oldVersion < 4) {
        // Ensure graph-meta store exists (recovery for DBs that missed v3 upgrade due to race condition)
        if (!db.objectStoreNames.contains('graph-meta')) {
          db.createObjectStore('graph-meta', { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Reset the singleton (for testing purposes only). */
export function _resetDBPromise(): void {
  dbPromise = null;
}
