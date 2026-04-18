import { asGnId } from "../types.js";
import type { GnId } from "../types.js";

export function escStr(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/** Returns true if s is a valid unquoted Cypher identifier (letters, digits, underscore; no leading digit). */
export function isValidIdentifier(s: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}

/** Throws a descriptive error if s is not a valid Cypher identifier. */
export function assertIdentifier(s: string): void {
  if (!isValidIdentifier(s)) {
    throw new Error(
      `"${s}" はCypher識別子として無効です（英数字とアンダースコアのみ、数字始まり不可）`,
    );
  }
}

/** Returns true if val is a query-result edge object (has _type, _src, _dst). */
export function isEdgeValue(val: unknown): boolean {
  if (val === null || typeof val !== "object" || Array.isArray(val))
    return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj["_type"] === "string" &&
    typeof obj["_src"] === "string" &&
    typeof obj["_dst"] === "string"
  );
}

export function extractMatchedGnIds(rows: unknown[]): {
  nodeGnIds: Set<GnId>;
  edgeGnIds: Set<GnId>;
} {
  const nodeGnIds = new Set<GnId>();
  const edgeGnIds = new Set<GnId>();
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    for (const val of Object.values(row as Record<string, unknown>)) {
      if (typeof val !== "object" || val === null) continue;
      const v = val as Record<string, unknown>;
      if (
        Array.isArray(v["_labels"]) &&
        typeof v["_properties"] === "object" &&
        v["_properties"] !== null
      ) {
        const gnId = (v["_properties"] as Record<string, unknown>)["gnId"];
        if (typeof gnId === "string") nodeGnIds.add(asGnId(gnId));
      } else if (
        typeof v["_type"] === "string" &&
        "_src" in v &&
        "_dst" in v &&
        typeof v["_properties"] === "object" &&
        v["_properties"] !== null
      ) {
        const gnId = (v["_properties"] as Record<string, unknown>)["gnId"];
        if (typeof gnId === "string") edgeGnIds.add(asGnId(gnId));
      }
    }
  }
  return { nodeGnIds, edgeGnIds };
}
