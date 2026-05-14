import type { GnId, PersistedGroup } from '../types.js';
import { asGnId } from '../types.js';

const DEFAULT_GROUP_COLORS = [
  '#4ec994',
  '#5aa8ff',
  '#f0b429',
  '#e07b91',
  '#a78bfa',
  '#5dd0c8',
  '#ff8c66',
];

/**
 * Per-graph store of visual node groups (compound containers).
 * Membership is recorded on each node via its `group` Cypher property;
 * this store only holds the group meta information (name, color, note,
 * collapsed flag, optional fixed position).
 */
export class GroupStore {
  private groups = new Map<GnId, PersistedGroup>();
  private order: GnId[] = [];

  list(): PersistedGroup[] {
    return this.order
      .map((id) => this.groups.get(id))
      .filter((g): g is PersistedGroup => g !== undefined);
  }

  get(id: GnId): PersistedGroup | undefined {
    return this.groups.get(id);
  }

  has(id: GnId): boolean {
    return this.groups.has(id);
  }

  create(name: string, opts: Partial<Omit<PersistedGroup, 'id'>> = {}): PersistedGroup {
    const id = asGnId(crypto.randomUUID());
    const defaultColor =
      DEFAULT_GROUP_COLORS[this.order.length % DEFAULT_GROUP_COLORS.length] ??
      DEFAULT_GROUP_COLORS[0] ??
      '#4ec994';
    const group: PersistedGroup = {
      id,
      name: name.trim() || 'Group',
      color: opts.color ?? defaultColor,
      note: opts.note ?? '',
      collapsed: opts.collapsed ?? false,
      position: opts.position,
    };
    this.groups.set(id, group);
    this.order.push(id);
    return group;
  }

  rename(id: GnId, name: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    g.name = name.trim() || g.name;
  }

  setColor(id: GnId, color: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    g.color = color;
  }

  setNote(id: GnId, note: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    g.note = note;
  }

  setCollapsed(id: GnId, collapsed: boolean): void {
    const g = this.groups.get(id);
    if (!g) return;
    g.collapsed = collapsed;
  }

  setPosition(id: GnId, pos: { x: number; y: number }): void {
    const g = this.groups.get(id);
    if (!g) return;
    g.position = { ...pos };
  }

  remove(id: GnId): void {
    this.groups.delete(id);
    this.order = this.order.filter((x) => x !== id);
  }

  clear(): void {
    this.groups.clear();
    this.order = [];
  }

  loadAll(groups: PersistedGroup[]): void {
    this.clear();
    for (const g of groups) {
      if (!g?.id) continue;
      const stored: PersistedGroup = {
        id: g.id,
        name: g.name ?? 'Group',
        color: g.color ?? DEFAULT_GROUP_COLORS[0] ?? '#4ec994',
        note: g.note ?? '',
        collapsed: g.collapsed ?? false,
        position: g.position,
      };
      this.groups.set(g.id, stored);
      this.order.push(g.id);
    }
  }

  dump(): PersistedGroup[] {
    return this.list().map((g) => ({ ...g }));
  }
}
