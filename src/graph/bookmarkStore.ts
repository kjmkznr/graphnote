import { openGraphnoteDB } from './idb.js';

const IDB_STORE_NAME = 'bookmarks';

export interface Bookmark {
  id: string;
  name: string;
  query: string;
  createdAt: number;
}

export class BookmarkStore {
  private openDB(): Promise<IDBDatabase> {
    return openGraphnoteDB();
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
