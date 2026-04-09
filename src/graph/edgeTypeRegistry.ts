const STORAGE_KEY = 'graphnote:edge-types';
const DEFAULT_TYPES = ['RELATES_TO', 'DEPENDS_ON', 'KNOWS', 'USES', 'BELONGS_TO'];
export class EdgeTypeRegistry {
  private types: string[];
  constructor() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
          this.types = parsed as string[];
          return;
        }
      } catch { /* fall through */ }
    }
    this.types = [...DEFAULT_TYPES];
    this.save();
  }
  getAll(): string[] {
    return [...this.types];
  }
  add(type: string): void {
    const t = type.trim();
    if (!t || this.types.includes(t)) return;
    this.types.push(t);
    this.save();
  }
  remove(type: string): void {
    this.types = this.types.filter((t) => t !== type);
    this.save();
  }
  rename(oldType: string, newType: string): void {
    const t = newType.trim();
    if (!t || this.types.includes(t)) return;
    const idx = this.types.indexOf(oldType);
    if (idx === -1) return;
    this.types[idx] = t;
    this.save();
  }
  /** Ensure a type (possibly created via Cypher) is in the list. */
  ensure(type: string): void {
    this.add(type);
  }
  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.types));
  }
}
