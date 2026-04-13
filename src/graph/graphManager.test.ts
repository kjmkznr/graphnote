import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphManager } from './graphManager';
import type { GraphMeta, IAsyncStorage } from './persistence';
import { GraphDB, type IGraphExecutor } from './db';

function makeExecutor(executeResult = '[]'): IGraphExecutor {
  return {
    execute: vi.fn().mockReturnValue(executeResult),
    exportCypher: vi.fn().mockReturnValue(''),
    nodeCount: vi.fn().mockReturnValue(0),
    edgeCount: vi.fn().mockReturnValue(0),
    reset: vi.fn(),
  };
}

function makeStorage(initial: Record<string, string> = {}): IAsyncStorage & {
  metaStore: Map<string, GraphMeta>;
  listGraphMeta: () => Promise<GraphMeta[]>;
  putGraphMeta: (meta: GraphMeta) => Promise<void>;
  deleteGraphMeta: (id: string) => Promise<void>;
} {
  const store = { ...initial };
  const metaStore = new Map<string, GraphMeta>();
  return {
    metaStore,
    getItem: vi.fn(async (key: string) => store[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn(async (key: string) => { delete store[key]; }),
    listGraphMeta: vi.fn(async () => [...metaStore.values()].sort((a, b) => a.createdAt - b.createdAt)),
    putGraphMeta: vi.fn(async (meta: GraphMeta) => { metaStore.set(meta.id, meta); }),
    deleteGraphMeta: vi.fn(async (id: string) => { metaStore.delete(id); }),
  };
}

describe('GraphManager', () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('test-uuid-1234') });
  });

  it('init creates default graph when no graphs exist', async () => {
    const manager = new GraphManager(storage as never);
    await manager.init();
    expect(manager.graphs).toHaveLength(1);
    expect(manager.graphs[0]?.name).toBe('デフォルト');
    expect(manager.currentGraphId).toBe('test-uuid-1234');
  });

  it('init uses existing graphs from storage', async () => {
    const existingMeta: GraphMeta = { id: 'existing-id', name: 'My Graph', createdAt: 1000 };
    storage.metaStore.set('existing-id', existingMeta);
    const manager = new GraphManager(storage as never);
    await manager.init();
    expect(manager.graphs).toHaveLength(1);
    expect(manager.currentGraphId).toBe('existing-id');
  });

  it('init migrates legacy data when graphnote:v1 exists', async () => {
    const legacyData = JSON.stringify({ version: 1, nodes: [], edges: [], positions: {} });
    const storageWithLegacy = makeStorage({ 'graphnote:v1': legacyData });
    const manager = new GraphManager(storageWithLegacy as never);
    await manager.init();
    expect(storageWithLegacy.setItem).toHaveBeenCalledWith(
      expect.stringContaining('graph:'),
      legacyData,
    );
  });

  it('createGraph adds a new graph', async () => {
    const manager = new GraphManager(storage as never);
    await manager.init();
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('new-graph-id') });
    const meta = await manager.createGraph('Test Graph');
    expect(meta.name).toBe('Test Graph');
    expect(manager.graphs).toHaveLength(2);
  });

  it('createGraph uses default name when empty string given', async () => {
    const manager = new GraphManager(storage as never);
    await manager.init();
    const meta = await manager.createGraph('');
    expect(meta.name).toBe('新しいグラフ');
  });

  it('deleteGraph removes a graph', async () => {
    const manager = new GraphManager(storage as never);
    await manager.init();
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('second-id') });
    await manager.createGraph('Second');
    expect(manager.graphs).toHaveLength(2);
    await manager.deleteGraph('test-uuid-1234');
    expect(manager.graphs).toHaveLength(1);
    expect(manager.graphs[0]?.id).toBe('second-id');
  });

  it('deleteGraph throws when only one graph remains', async () => {
    const manager = new GraphManager(storage as never);
    await manager.init();
    await expect(manager.deleteGraph('test-uuid-1234')).rejects.toThrow('最後のグラフは削除できません');
  });

  it('renameGraph updates graph name', async () => {
    const manager = new GraphManager(storage as never);
    await manager.init();
    await manager.renameGraph('test-uuid-1234', 'Renamed Graph');
    expect(manager.currentGraph?.name).toBe('Renamed Graph');
    expect(storage.putGraphMeta).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-uuid-1234', name: 'Renamed Graph' }),
    );
  });

  it('renameGraph throws when graph not found', async () => {
    const manager = new GraphManager(storage as never);
    await manager.init();
    await expect(manager.renameGraph('nonexistent', 'New Name')).rejects.toThrow('グラフが見つかりません');
  });

  it('switchGraph loads the specified graph', async () => {
    const manager = new GraphManager(storage as never);
    await manager.init();
    const db = new GraphDB();
    db.setExecutor(makeExecutor());
    const result = await manager.switchGraph('test-uuid-1234', db);
    expect(manager.currentGraphId).toBe('test-uuid-1234');
    expect(result.positions).toBeDefined();
  });

  it('saveCurrentGraph saves to the current graph key', async () => {
    const manager = new GraphManager(storage as never);
    await manager.init();
    const db = new GraphDB();
    db.setExecutor(makeExecutor());
    await manager.saveCurrentGraph(db, {});
    expect(storage.setItem).toHaveBeenCalledWith('graph:test-uuid-1234', expect.any(String));
  });
});
