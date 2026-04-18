import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { _resetDBPromise, IDB_DB_NAME, IDB_VERSION, openGraphnoteDB } from './idb';

beforeEach(() => {
  _resetDBPromise();
  // Reset fake-indexeddb state between tests
  // biome-ignore lint/suspicious/noGlobalAssign: required by fake-indexeddb reset pattern
  indexedDB = new (globalThis as unknown as { IDBFactory: new () => IDBFactory }).IDBFactory();
});

describe('openGraphnoteDB', () => {
  it('opens the database with the correct name and version', async () => {
    const db = await openGraphnoteDB();
    expect(db.name).toBe(IDB_DB_NAME);
    expect(db.version).toBe(IDB_VERSION);
    db.close();
  });

  it('creates the graphs object store', async () => {
    const db = await openGraphnoteDB();
    expect(db.objectStoreNames.contains('graphs')).toBe(true);
    db.close();
  });

  it('creates the bookmarks object store', async () => {
    const db = await openGraphnoteDB();
    expect(db.objectStoreNames.contains('bookmarks')).toBe(true);
    db.close();
  });

  it('creates the graph-meta object store', async () => {
    const db = await openGraphnoteDB();
    expect(db.objectStoreNames.contains('graph-meta')).toBe(true);
    db.close();
  });

  it('returns the same promise on multiple calls (singleton)', async () => {
    const p1 = openGraphnoteDB();
    const p2 = openGraphnoteDB();
    expect(p1).toBe(p2);
    const db = await p1;
    db.close();
  });

  it('returns a new promise after _resetDBPromise()', async () => {
    const p1 = openGraphnoteDB();
    await p1;
    _resetDBPromise();
    // biome-ignore lint/suspicious/noGlobalAssign: required by fake-indexeddb reset pattern
    indexedDB = new (globalThis as unknown as { IDBFactory: new () => IDBFactory }).IDBFactory();
    const p2 = openGraphnoteDB();
    expect(p1).not.toBe(p2);
    const db = await p2;
    db.close();
  });

  it('graph-meta store uses id as keyPath', async () => {
    const db = await openGraphnoteDB();
    const tx = db.transaction('graph-meta', 'readonly');
    const store = tx.objectStore('graph-meta');
    expect(store.keyPath).toBe('id');
    db.close();
  });

  it('bookmarks store uses id as keyPath', async () => {
    const db = await openGraphnoteDB();
    const tx = db.transaction('bookmarks', 'readonly');
    const store = tx.objectStore('bookmarks');
    expect(store.keyPath).toBe('id');
    db.close();
  });

  it('can write and read from graphs store', async () => {
    const db = await openGraphnoteDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('graphs', 'readwrite');
      const store = tx.objectStore('graphs');
      const req = store.put({ nodes: [], edges: [] }, 'test-key');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    const result = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('graphs', 'readonly');
      const store = tx.objectStore('graphs');
      const req = store.get('test-key');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(result).toEqual({ nodes: [], edges: [] });
    db.close();
  });

  it('can write and read from graph-meta store', async () => {
    const db = await openGraphnoteDB();
    const meta = { id: 'graph-1', name: 'My Graph', createdAt: Date.now() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('graph-meta', 'readwrite');
      const store = tx.objectStore('graph-meta');
      const req = store.put(meta);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    const result = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('graph-meta', 'readonly');
      const store = tx.objectStore('graph-meta');
      const req = store.get('graph-1');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(result).toEqual(meta);
    db.close();
  });

  it('can write and read from bookmarks store', async () => {
    const db = await openGraphnoteDB();
    const bookmark = {
      id: 'bm-1',
      name: 'Test Query',
      query: 'MATCH (n) RETURN n',
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('bookmarks', 'readwrite');
      const store = tx.objectStore('bookmarks');
      const req = store.put(bookmark);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    const result = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('bookmarks', 'readonly');
      const store = tx.objectStore('bookmarks');
      const req = store.get('bm-1');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(result).toEqual(bookmark);
    db.close();
  });
});
