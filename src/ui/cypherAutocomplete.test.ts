import { describe, it, expect } from "vitest";
import {
  getTokenBeforeCursor,
  detectCompletionType,
  getCompletions,
  applyCompletion,
} from "./cypherAutocomplete.js";
import type { CompletionContext } from "./cypherAutocomplete.js";

const ctx: CompletionContext = {
  nodeTypes: ["Person", "Company", "System"],
  edgeTypes: ["KNOWS", "WORKS_AT", "MANAGES"],
  propertyKeys: ["name", "age", "email"],
};

// ── getTokenBeforeCursor ──────────────────────────────────────────────────────

describe("getTokenBeforeCursor", () => {
  it("通常のキーワード入力", () => {
    expect(getTokenBeforeCursor("MAT", 3)).toBe("MAT");
  });

  it("コロン直後のラベル", () => {
    expect(getTokenBeforeCursor("(n:Per", 6)).toBe("Per");
  });

  it("コロン直後でまだ文字がない", () => {
    expect(getTokenBeforeCursor("(n:", 3)).toBe("");
  });

  it("ドット直後のプロパティ", () => {
    expect(getTokenBeforeCursor("n.na", 4)).toBe("na");
  });

  it("ドット直後でまだ文字がない", () => {
    expect(getTokenBeforeCursor("n.", 2)).toBe("");
  });
});

// ── detectCompletionType ──────────────────────────────────────────────────────

describe("detectCompletionType", () => {
  it("ノードパターン (n:Per → nodeType", () => {
    expect(detectCompletionType("MATCH (n:Per", 12)).toBe("nodeType");
  });

  it("エッジパターン [r:KN → edgeType", () => {
    expect(detectCompletionType("MATCH ()-[r:KN", 14)).toBe("edgeType");
  });

  it("プロパティパターン n.name → property", () => {
    expect(detectCompletionType("WHERE n.na", 10)).toBe("property");
  });

  it("それ以外 → keyword", () => {
    expect(detectCompletionType("MAT", 3)).toBe("keyword");
  });
});

// ── getCompletions ────────────────────────────────────────────────────────────

describe("getCompletions", () => {
  it("キーワード補完: MA → MATCH", () => {
    const results = getCompletions("MA", 2, ctx);
    expect(results.map((r) => r.label)).toContain("MATCH");
    expect(results.every((r) => r.kind === "keyword")).toBe(true);
  });

  it("ノードタイプ補完: (n:Pe → Person", () => {
    const results = getCompletions("(n:Pe", 5, ctx);
    expect(results.map((r) => r.label)).toContain("Person");
    expect(results.map((r) => r.label)).not.toContain("Company");
    expect(results.every((r) => r.kind === "nodeType")).toBe(true);
  });

  it("エッジタイプ補完: [r:KN → KNOWS", () => {
    const results = getCompletions("MATCH ()-[r:KN", 14, ctx);
    expect(results.map((r) => r.label)).toContain("KNOWS");
    expect(results.every((r) => r.kind === "edgeType")).toBe(true);
  });

  it("プロパティ補完: n.na → name", () => {
    const results = getCompletions("WHERE n.na", 10, ctx);
    expect(results.map((r) => r.label)).toContain("name");
    expect(results.map((r) => r.label)).not.toContain("age");
    expect(results.every((r) => r.kind === "property")).toBe(true);
  });

  it("空トークンでコンテキストに応じた全候補を返す", () => {
    const results = getCompletions("(n:", 3, ctx);
    expect(results.length).toBe(ctx.nodeTypes.length);
  });

  it("マッチしない場合は空配列", () => {
    const results = getCompletions("ZZZ", 3, ctx);
    expect(results).toHaveLength(0);
  });
});

// ── applyCompletion ────────────────────────────────────────────────────────────

describe("applyCompletion", () => {
  it("キーワード補完: MAT → MATCH", () => {
    const { newText, newCursorPos } = applyCompletion("MAT", 3, "MATCH");
    expect(newText).toBe("MATCH");
    expect(newCursorPos).toBe(5);
  });

  it("ノードタイプ補完: (n:Per → (n:Person", () => {
    const { newText, newCursorPos } = applyCompletion("(n:Per", 6, "Person");
    expect(newText).toBe("(n:Person");
    expect(newCursorPos).toBe(9);
  });

  it("プロパティ補完: n.na → n.name", () => {
    const { newText, newCursorPos } = applyCompletion("n.na", 4, "name");
    expect(newText).toBe("n.name");
    expect(newCursorPos).toBe(6);
  });

  it("カーソルが中間にある場合: MAT|CH → MATCH|CH (末尾の単語を置換)", () => {
    const { newText, newCursorPos } = applyCompletion("MATCH n", 7, "name");
    expect(newText).toBe("MATCH name");
    expect(newCursorPos).toBe(10);
  });

  it("コロン直後（文字なし）でラベルを挿入", () => {
    const { newText, newCursorPos } = applyCompletion("(n:", 3, "Person");
    expect(newText).toBe("(n:Person");
    expect(newCursorPos).toBe(9);
  });
});
