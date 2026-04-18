import { describe, expect, it } from 'vitest';
import { asGnId } from '../types';
import { extractMatchedGnIds } from './graphUtils';

describe('graphUtils', () => {
  it('extractMatchedGnIds should extract gnIds from rows', () => {
    const rows = [
      {
        n: {
          _labels: ['Person'],
          _properties: { gnId: 'n1', name: 'Alice' },
          _id: '0',
        },
      },
      {
        r: {
          _type: 'KNOWS',
          _properties: { gnId: 'e1' },
          _src: '0',
          _dst: '1',
        },
      },
    ];

    const result = extractMatchedGnIds(rows);
    expect(result.nodeGnIds.has(asGnId('n1'))).toBe(true);
    expect(result.edgeGnIds.has(asGnId('e1'))).toBe(true);
    expect(result.nodeGnIds.size).toBe(1);
    expect(result.edgeGnIds.size).toBe(1);
  });
});
