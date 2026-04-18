import type { GraphDB } from "./db.js";
import type { GnId, PropertyValue } from "../types.js";
import { isValidIdentifier } from "../utils/graphUtils.js";

export interface CsvImportOptions {
  /** ノードのラベル（Cypherノードタイプ） */
  nodeLabel: string;
  /**
   * エッジ列の定義。各エントリは CSV の列名と、その列が参照する
   * ノードの name プロパティ値を使ってエッジを張るための設定。
   */
  edgeColumns: EdgeColumnDef[];
}

export interface EdgeColumnDef {
  /** CSV の列名 */
  column: string;
  /** エッジのタイプ名 */
  edgeType: string;
  /** エッジの向き: 'out' = このノード→参照先, 'in' = 参照先→このノード */
  direction: "out" | "in";
}

export interface CsvImportResult {
  nodeCount: number;
  edgeCount: number;
  skippedEdges: number;
}

/**
 * CSV テキストを行ごとにパースする。
 * RFC 4180 準拠: ダブルクォートによるフィールドのエスケープをサポート。
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let pos = 0;

  while (pos < lines.length) {
    const row: string[] = [];
    while (pos < lines.length) {
      if (lines[pos] === '"') {
        // クォートフィールド
        pos++;
        let field = "";
        while (pos < lines.length) {
          if (lines[pos] === '"') {
            pos++;
            if (lines[pos] === '"') {
              field += '"';
              pos++;
            } else {
              break;
            }
          } else {
            field += lines[pos];
            pos++;
          }
        }
        row.push(field);
        if (lines[pos] === ",") pos++;
        else break;
      } else {
        // 非クォートフィールド
        let field = "";
        while (
          pos < lines.length &&
          lines[pos] !== "," &&
          lines[pos] !== "\n"
        ) {
          field += lines[pos];
          pos++;
        }
        row.push(field);
        if (lines[pos] === ",") pos++;
        else break;
      }
    }
    if (lines[pos] === "\n") pos++;
    if (row.length > 0) rows.push(row);
  }

  return rows;
}

/**
 * 文字列値を PropertyValue に変換する。
 * 数値・真偽値・null を自動判定する。
 */
function parseValue(s: string): PropertyValue {
  if (s === "") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  const n = Number(s);
  if (!Number.isNaN(n) && s.trim() !== "") return n;
  return s;
}

/**
 * CSV テキストを GraphDB にインポートする。
 * - 各行をノードとして作成（列 = プロパティ）
 * - edgeColumns に指定された列の値を name プロパティとして持つ
 *   既存ノードを検索し、エッジを自動生成する
 */
export function importCsv(
  db: GraphDB,
  csvText: string,
  options: CsvImportOptions,
): CsvImportResult {
  const { nodeLabel, edgeColumns } = options;

  if (!isValidIdentifier(nodeLabel)) {
    throw new Error(`ノードラベル "${nodeLabel}" はCypher識別子として無効です`);
  }
  for (const ec of edgeColumns) {
    if (!isValidIdentifier(ec.edgeType)) {
      throw new Error(
        `エッジタイプ "${ec.edgeType}" はCypher識別子として無効です`,
      );
    }
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error("CSVにはヘッダー行とデータ行が必要です");
  }

  const headers = rows[0];
  if (!headers) throw new Error("CSVにはヘッダー行とデータ行が必要です");
  const edgeColSet = new Set(edgeColumns.map((ec) => ec.column));

  // ノードを作成し、name → gnId のマップを構築
  const nameToGnId = new Map<string, GnId>();
  let nodeCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    // 空行をスキップ
    if (row.every((cell) => cell.trim() === "")) continue;

    const props: Record<string, PropertyValue> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (!header || edgeColSet.has(header)) continue;
      if (!isValidIdentifier(header)) continue;
      props[header] = parseValue(row[j] ?? "");
    }

    const gnId = db.createNode(nodeLabel, props);
    nodeCount++;

    // name プロパティがあればマップに登録
    const nameVal = props["name"];
    if (typeof nameVal === "string" && nameVal !== "") {
      nameToGnId.set(nameVal, gnId);
    }
  }

  // エッジを作成
  let edgeCount = 0;
  let skippedEdges = 0;

  if (edgeColumns.length > 0) {
    // 再度行を走査してエッジを張る
    // このノードの gnId を name から引くため、全ノードを再取得
    const allNodes = db.getAllNodes();
    const nodeNameToGnId = new Map<string, GnId>();
    for (const node of allNodes) {
      const nameVal = node._properties["name"];
      if (typeof nameVal === "string" && nameVal !== "") {
        nodeNameToGnId.set(nameVal, node._properties["gnId"] as GnId);
      }
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      if (row.every((cell) => cell.trim() === "")) continue;

      // このノードの name を取得
      const nameIdx = headers.indexOf("name");
      const thisName = nameIdx >= 0 ? (row[nameIdx] ?? "").trim() : "";
      const thisGnId = thisName ? nodeNameToGnId.get(thisName) : undefined;

      if (!thisGnId) {
        // name がない行はエッジを張れないのでスキップ
        if (edgeColumns.length > 0) skippedEdges += edgeColumns.length;
        continue;
      }

      for (const ec of edgeColumns) {
        const colIdx = headers.indexOf(ec.column);
        if (colIdx < 0) continue;
        const targetName = (row[colIdx] ?? "").trim();
        if (!targetName) continue;

        const targetGnId = nodeNameToGnId.get(targetName);
        if (!targetGnId) {
          skippedEdges++;
          continue;
        }

        try {
          if (ec.direction === "out") {
            db.createEdge(thisGnId, targetGnId, ec.edgeType);
          } else {
            db.createEdge(targetGnId, thisGnId, ec.edgeType);
          }
          edgeCount++;
        } catch {
          skippedEdges++;
        }
      }
    }
  }

  return { nodeCount, edgeCount, skippedEdges };
}
