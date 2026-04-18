import { BaseTypeRegistry } from "./baseTypeRegistry.js";

export type LineStyle = "solid" | "dashed" | "dotted";

export interface EdgeTypeStyle {
  color: string;
  lineStyle: LineStyle;
}

const DEFAULT_COLORS = [
  "#4a5568",
  "#6c8ef7",
  "#f6ad55",
  "#68d391",
  "#fc8181",
  "#76e4f7",
  "#b794f4",
  "#f687b3",
  "#fbd38d",
  "#9ae6b4",
];

const DEFAULT_LINE_STYLES: LineStyle[] = ["solid", "dashed", "dotted"];

const DEFAULT_TYPES = [
  "RELATES_TO",
  "DEPENDS_ON",
  "KNOWS",
  "USES",
  "BELONGS_TO",
];

export class EdgeTypeRegistry extends BaseTypeRegistry<EdgeTypeStyle> {
  constructor() {
    super("graphnote:edge-types", "graphnote:edge-type-styles", DEFAULT_TYPES);
  }

  protected validateStyle(v: unknown): v is EdgeTypeStyle {
    return (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof (v as Record<string, unknown>)["color"] === "string" &&
      typeof (v as Record<string, unknown>)["lineStyle"] === "string"
    );
  }

  protected defaultStyleForIndex(i: number): EdgeTypeStyle {
    return {
      color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] ?? "#4a5568",
      lineStyle: DEFAULT_LINE_STYLES[i % DEFAULT_LINE_STYLES.length] ?? "solid",
    };
  }

  protected defaultStyle(): EdgeTypeStyle {
    return { color: "#4a5568", lineStyle: "solid" };
  }
}
