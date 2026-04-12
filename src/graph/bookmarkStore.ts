const IDB_DB_NAME = 'graphnote';
const IDB_STORE_NAME = 'bookmarks';
const IDB_VERSION = 2;

export interface Bookmark {
  id: string;
  name: string;
  query: string;
  createdAt: number;
}

export class BookmarkStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        if (event.oldVersion < 1) {
          db.createObjectStore('graphs');
        }
        if (event.oldVersion < 2) {
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME, { keyPath: 'id' });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async getAll(): Promise<Bookmark[]> {
    const db = await this.openDB();
    return new Promise<Bookmark[]>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const req = tx.objectStore(IDB_STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as Bookmark[]).sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => reject(req.error);
    });
  }

  async add(name: string, query: string): Promise<Bookmark> {
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      name,
      query,
      createdAt: Date.now(),
    };
    const db = await this.openDB();
    return new Promise<Bookmark>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const req = tx.objectStore(IDB_STORE_NAME).add(bookmark);
      req.onsuccess = () => resolve(bookmark);
      req.onerror = () => reject(req.error);
    });
  }

  async remove(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const req = tx.objectStore(IDB_STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
