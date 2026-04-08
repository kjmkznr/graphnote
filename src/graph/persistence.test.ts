import { describe, it, expect, vi } from 'vitest';
import { saveGraph, loadGraph, type IStorage } from './persistence';
import { GraphDB, type IGraphExecutor } from './db';

describe('persistence', () => {
  it('saveGraph should call storage.setItem', () => {
    const mockExecutor: IGraphExecutor = {
      execute: vi.fn().mockReturnValue('[]'),
      exportCypher: vi.fn().mockReturnValue(''),
      nodeCount: vi.fn(),
      edgeCount: vi.fn(),
      reset: vi.fn()
    };
    const db = new GraphDB();
    db.setExecutor(mockExecutor);

    const mockStorage: IStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };

    saveGraph(db, {}, mockStorage);
    expect(mockStorage.setItem).toHaveBeenCalledWith('graphnote:v1', expect.any(String));
  });

  it('loadGraph should call storage.getItem and restore data', async () => {
    const mockExecutor: IGraphExecutor = {
      execute: vi.fn().mockReturnValue('[]'),
      exportCypher: vi.fn().mockReturnValue(''),
      nodeCount: vi.fn(),
      edgeCount: vi.fn(),
      reset: vi.fn()
    };
    const db = new GraphDB();
    db.setExecutor(mockExecutor);

    const savedData = JSON.stringify({
      version: 1,
      nodes: [{ id: 'n1', labels: ['Person'], properties: { gnId: 'n1' } }],
      edges: [],
      positions: { n1: { x: 10, y: 20 } }
    });

    const mockStorage: IStorage = {
      getItem: vi.fn().mockReturnValue(savedData),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };

    const positions = await loadGraph(db, mockStorage);
    expect(mockStorage.getItem).toHaveBeenCalledWith('graphnote:v1');
    expect(positions).toEqual({ n1: { x: 10, y: 20 } });
    expect(mockExecutor.execute).toHaveBeenCalledWith(expect.stringContaining('CREATE (:Person {gnId: "n1"})'));
  });
});
