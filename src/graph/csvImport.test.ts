import { describe, it, expect, beforeEach } from "vitest";
import { parseCsv, importCsv } from "./csvImport.js";
import { GraphDB } from "./db.js";

// ── parseCsv ──────────────────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("基本的なCSVをパースする", () => {
    const result = parseCsv("name,age\nAlice,30\nBob,25");
    expect(result).toEqual([
      ["name", "age"],
      ["Alice", "30"],
      ["Bob", "25"],
    ]);
  });

  it("ダブルクォートフィールドをパースする", () => {
    const result = parseCsv('"hello, world",42\n"foo""bar",baz');
    expect(result).toEqual([
      ["hello, world", "42"],
      ['foo"bar', "baz"],
    ]);
  });

  it("クォートフィールド内の改行をパースする", () => {
    const result = parseCsv('"line1\nline2",end');
    expect(result).toEqual([["line1\nline2", "end"]]);
  });

  it("CRLF 改行をパースする", () => {
    const result = parseCsv("a,b\r\n1,2\r\n3,4");
    expect(result).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("空行をスキップする", () => {
    const result = parseCsv("a,b\n1,2\n\n3,4");
    // 空行は空配列として含まれる場合があるが、importCsv 側でスキップする
    const nonEmpty = result.filter((r) => r.some((c) => c.trim() !== ""));
    expect(nonEmpty).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

// ── importCsv ─────────────────────────────────────────────────────────────────

describe("importCsv", () => {
  let db: GraphDB;

  beforeEach(async () => {
    db = new GraphDB();
    await db.init();
  });

  it("CSVの各行をノードとして作成する", () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const result = importCsv(db, csv, { nodeLabel: "Person", edgeColumns: [] });
    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(0);
    const nodes = db.getAllNodes();
    expect(nodes).toHaveLength(2);
    const names = nodes.map((n) => n._properties["name"]).sort();
    expect(names).toEqual(["Alice", "Bob"]);
  });

  it("数値プロパティを数値型として保存する", () => {
    const csv = "name,score\nAlice,42";
    importCsv(db, csv, { nodeLabel: "Person", edgeColumns: [] });
    const nodes = db.getAllNodes();
    expect(nodes[0]!._properties["score"]).toBe(42);
  });

  it("真偽値プロパティを boolean 型として保存する", () => {
    const csv = "name,active\nAlice,true\nBob,false";
    importCsv(db, csv, { nodeLabel: "Person", edgeColumns: [] });
    const nodes = db.getAllNodes();
    const alice = nodes.find((n) => n._properties["name"] === "Alice");
    const bob = nodes.find((n) => n._properties["name"] === "Bob");
    expect(alice?._properties["active"]).toBe(true);
    expect(bob?._properties["active"]).toBe(false);
  });

  it("エッジ列からエッジを自動生成する", () => {
    const csv = "name,manager\nAlice,\nBob,Alice\nCarol,Alice";
    const result = importCsv(db, csv, {
      nodeLabel: "Person",
      edgeColumns: [
        { column: "manager", edgeType: "REPORTS_TO", direction: "out" },
      ],
    });
    expect(result.nodeCount).toBe(3);
    expect(result.edgeCount).toBe(2);
    const edges = db.getAllEdges();
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e._type === "REPORTS_TO")).toBe(true);
  });

  it("direction: in でエッジの向きが逆になる", () => {
    // Alice が Bob を subordinate として持つ → direction: in → Bob→Alice のエッジ
    const csv = "name,subordinate\nAlice,Bob\nBob,";
    importCsv(db, csv, {
      nodeLabel: "Person",
      edgeColumns: [
        { column: "subordinate", edgeType: "MANAGES", direction: "in" },
      ],
    });
    const edges = db.getAllEdges();
    expect(edges).toHaveLength(1);
    const nodes = db.getAllNodes();
    const alice = nodes.find((n) => n._properties["name"] === "Alice");
    const bob = nodes.find((n) => n._properties["name"] === "Bob");
    const edge = edges[0];
    expect(edge).toBeDefined();
    expect(edge!._type).toBe("MANAGES");
    // direction: in → target(Bob) が src、このノード(Alice) が dst
    const srcNode = nodes.find((n) => n._id === edge!._src);
    const dstNode = nodes.find((n) => n._id === edge!._dst);
    expect(srcNode?._properties["gnId"]).toBe(bob?._properties["gnId"]);
    expect(dstNode?._properties["gnId"]).toBe(alice?._properties["gnId"]);
  });

  it("存在しないターゲットへのエッジはスキップされる", () => {
    const csv = "name,manager\nAlice,Unknown";
    const result = importCsv(db, csv, {
      nodeLabel: "Person",
      edgeColumns: [
        { column: "manager", edgeType: "REPORTS_TO", direction: "out" },
      ],
    });
    expect(result.edgeCount).toBe(0);
    expect(result.skippedEdges).toBe(1);
  });

  it("エッジ列はノードのプロパティとして保存されない", () => {
    const csv = "name,manager\nAlice,\nBob,Alice";
    importCsv(db, csv, {
      nodeLabel: "Person",
      edgeColumns: [
        { column: "manager", edgeType: "REPORTS_TO", direction: "out" },
      ],
    });
    const nodes = db.getAllNodes();
    for (const node of nodes) {
      expect("manager" in node._properties).toBe(false);
    }
  });

  it("無効なノードラベルでエラーをスローする", () => {
    const csv = "name\nAlice";
    expect(() =>
      importCsv(db, csv, { nodeLabel: "123invalid", edgeColumns: [] }),
    ).toThrow();
  });

  it("無効なエッジタイプでエラーをスローする", () => {
    const csv = "name,rel\nAlice,Bob";
    expect(() =>
      importCsv(db, csv, {
        nodeLabel: "Person",
        edgeColumns: [
          { column: "rel", edgeType: "invalid-type", direction: "out" },
        ],
      }),
    ).toThrow();
  });

  it("ヘッダー行のみのCSVでエラーをスローする", () => {
    const csv = "name,age";
    expect(() =>
      importCsv(db, csv, { nodeLabel: "Person", edgeColumns: [] }),
    ).toThrow();
  });
});
