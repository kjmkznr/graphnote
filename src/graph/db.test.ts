import { describe, it, expect, vi } from 'vitest';
import { GraphDB, type IGraphExecutor } from './db';

describe('GraphDB', () => {
  it('should call executor with correct cypher for getAllNodes', () => {
    const mockExecutor: IGraphExecutor = {
      execute: vi.fn().mockReturnValue('[]'),
      exportCypher: vi.fn().mockReturnValue(''),
      nodeCount: vi.fn(),
      edgeCount: vi.fn(),
      reset: vi.fn()
    };
    const db = new GraphDB();
    db.setExecutor(mockExecutor);
    
    db.getAllNodes();
    expect(mockExecutor.execute).toHaveBeenCalledWith('MATCH (n) RETURN n');
  });

  it('should create node and return gnId', () => {
    const mockExecutor: IGraphExecutor = {
      execute: vi.fn().mockReturnValue('[]'),
      exportCypher: vi.fn().mockReturnValue(''),
      nodeCount: vi.fn(),
      edgeCount: vi.fn(),
      reset: vi.fn()
    };
    const db = new GraphDB();
    db.setExecutor(mockExecutor);

    // Mock crypto.randomUUID for stable testing if necessary, 
    // but here we just check if it was called with CREATE
    const gnId = db.createNode('Person', { name: 'Alice' });
    
    expect(gnId).toBeDefined();
    expect(mockExecutor.execute).toHaveBeenCalledWith(
      expect.stringContaining('CREATE (:Person {name: "Alice", gnId: "')
    );
  });
});
