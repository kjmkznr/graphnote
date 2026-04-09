import { asGnId } from '../types.js';
import type { GnId } from '../types.js';

export function escStr(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Escape a string as a Cypher identifier (label, relationship type, or property key)
 * using backtick quoting. Backticks within the name are doubled per the Cypher spec.
 */
export function escLabel(s: string): string {
  return '`' + s.replace(/`/g, '``') + '`';
}

export function extractMatchedGnIds(rows: unknown[]): { nodeGnIds: Set<GnId>; edgeGnIds: Set<GnId> } {
  const nodeGnIds = new Set<GnId>();
  const edgeGnIds = new Set<GnId>();
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    for (const val of Object.values(row as Record<string, unknown>)) {
      if (typeof val !== 'object' || val === null) continue;
      const v = val as Record<string, unknown>;
      if (Array.isArray(v['_labels']) && typeof v['_properties'] === 'object' && v['_properties'] !== null) {
        const gnId = (v['_properties'] as Record<string, unknown>)['gnId'];
        if (typeof gnId === 'string') nodeGnIds.add(asGnId(gnId));
      } else if (typeof v['_type'] === 'string' && '_src' in v && '_dst' in v && typeof v['_properties'] === 'object' && v['_properties'] !== null) {
        const gnId = (v['_properties'] as Record<string, unknown>)['gnId'];
        if (typeof gnId === 'string') edgeGnIds.add(asGnId(gnId));
      }
    }
  }
  return { nodeGnIds, edgeGnIds };
}
