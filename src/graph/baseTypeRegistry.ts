export abstract class BaseTypeRegistry<TStyle> {
  private types: string[];
  private styles: Map<string, TStyle>;

  constructor(
    private readonly storageKey: string,
    private readonly styleStorageKey: string,
    private readonly defaultTypes: string[],
  ) {
    const raw = localStorage.getItem(storageKey);
    this.types = this.loadTypes(raw);

    this.styles = new Map();
    const rawStyles = localStorage.getItem(styleStorageKey);
    if (rawStyles) {
      try {
        const parsed = JSON.parse(rawStyles) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (this.validateStyle(v)) {
              this.styles.set(k, v);
            }
          }
        }
      } catch (err) {
        console.warn('[typeRegistry] Failed to parse styles from localStorage', { key: styleStorageKey, err });
      }
    }

    // Assign default styles for types that don't have one
    this.types.forEach((t, i) => {
      if (!this.styles.has(t)) {
        this.styles.set(t, this.defaultStyleForIndex(i));
      }
    });

    this.save();
  }

  protected abstract validateStyle(v: unknown): v is TStyle;
  protected abstract defaultStyleForIndex(i: number): TStyle;
  protected abstract defaultStyle(): TStyle;

  private loadTypes(raw: string | null): string[] {
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
          return parsed as string[];
        }
      } catch (err) {
        console.warn('[typeRegistry] Failed to parse types from localStorage', { key: this.storageKey, err });
      }
    }
    return [...this.defaultTypes];
  }

  getAll(): string[] {
    return [...this.types];
  }

  getStyle(type: string): TStyle {
    return this.styles.get(type) ?? this.defaultStyle();
  }

  setStyle(type: string, style: TStyle): void {
    this.styles.set(type, style);
    this.saveStyles();
  }

  add(type: string): void {
    const t = type.trim();
    if (!t || this.types.includes(t)) return;
    const index = this.types.length;
    this.types.push(t);
    if (!this.styles.has(t)) {
      this.styles.set(t, this.defaultStyleForIndex(index));
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
    localStorage.setItem(this.storageKey, JSON.stringify(this.types));
    this.saveStyles();
  }

  private saveStyles(): void {
    const obj: Record<string, TStyle> = {};
    for (const [k, v] of this.styles.entries()) {
      obj[k] = v;
    }
    localStorage.setItem(this.styleStorageKey, JSON.stringify(obj));
  }
}
