const STORAGE_KEY = 'graphnote:edge-types';
const STYLE_STORAGE_KEY = 'graphnote:edge-type-styles';
const DEFAULT_TYPES = ['RELATES_TO', 'DEPENDS_ON', 'KNOWS', 'USES', 'BELONGS_TO'];

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface EdgeTypeStyle {
  color: string;
  lineStyle: LineStyle;
}

const DEFAULT_COLORS = [
  '#4a5568', '#6c8ef7', '#f6ad55', '#68d391', '#fc8181',
  '#76e4f7', '#b794f4', '#f687b3', '#fbd38d', '#9ae6b4',
];

const DEFAULT_LINE_STYLES: LineStyle[] = ['solid', 'dashed', 'dotted'];

function defaultStyleForIndex(index: number): EdgeTypeStyle {
  return {
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? '#4a5568',
    lineStyle: DEFAULT_LINE_STYLES[index % DEFAULT_LINE_STYLES.length] ?? 'solid',
  };
}

function loadTypes(raw: string | null): string[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        return parsed as string[];
      }
    } catch { /* fall through */ }
  }
  return [...DEFAULT_TYPES];
}

export class EdgeTypeRegistry {
  private types: string[];
  private styles: Map<string, EdgeTypeStyle>;

  constructor() {
    const raw = localStorage.getItem(STORAGE_KEY);
    this.types = loadTypes(raw);

    this.styles = new Map();
    const rawStyles = localStorage.getItem(STYLE_STORAGE_KEY);
    if (rawStyles) {
      try {
        const parsed = JSON.parse(rawStyles) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (
              v && typeof v === 'object' && !Array.isArray(v) &&
              typeof (v as Record<string, unknown>)['color'] === 'string' &&
              typeof (v as Record<string, unknown>)['lineStyle'] === 'string'
            ) {
              this.styles.set(k, {
                color: (v as Record<string, unknown>)['color'] as string,
                lineStyle: (v as Record<string, unknown>)['lineStyle'] as LineStyle,
              });
            }
          }
        }
      } catch { /* fall through */ }
    }

    // Assign default styles for types that don't have one
    this.types.forEach((t, i) => {
      if (!this.styles.has(t)) {
        this.styles.set(t, defaultStyleForIndex(i));
      }
    });

    this.save();
  }

  getAll(): string[] {
    return [...this.types];
  }

  getStyle(type: string): EdgeTypeStyle {
    return this.styles.get(type) ?? { color: '#4a5568', lineStyle: 'solid' };
  }

  setStyle(type: string, style: EdgeTypeStyle): void {
    this.styles.set(type, style);
    this.saveStyles();
  }

  add(type: string): void {
    const t = type.trim();
    if (!t || this.types.includes(t)) return;
    const index = this.types.length;
    this.types.push(t);
    if (!this.styles.has(t)) {
      this.styles.set(t, defaultStyleForIndex(index));
    }
    this.save();
  }

  remove(type: string): void {
    this.types = this.types.filter((t) => t !== type);
    this.styles.delete(type);
    this.save();
  }

  rename(oldType: string, newType: string): void {
    const t = newType.trim();
    if (!t || this.types.includes(t)) return;
    const idx = this.types.indexOf(oldType);
    if (idx === -1) return;
    this.types[idx] = t;
    const oldStyle = this.styles.get(oldType);
    if (oldStyle) {
      this.styles.set(t, oldStyle);
      this.styles.delete(oldType);
    }
    this.save();
  }

  /** Ensure a type (possibly created via Cypher) is in the list. */
  ensure(type: string): void {
    this.add(type);
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.types));
    this.saveStyles();
  }

  private saveStyles(): void {
    const obj: Record<string, EdgeTypeStyle> = {};
    for (const [k, v] of this.styles.entries()) {
      obj[k] = v;
    }
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(obj));
  }
}
