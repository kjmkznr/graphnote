/**
 * Cypher クエリのオートコンプリート候補を提供するモジュール。
 * タイプ名・プロパティ名・構文キーワードの補完をサポートする。
 */

export const CYPHER_KEYWORDS = [
  'MATCH',
  'OPTIONAL MATCH',
  'WHERE',
  'RETURN',
  'WITH',
  'UNWIND',
  'CREATE',
  'MERGE',
  'SET',
  'REMOVE',
  'DELETE',
  'DETACH DELETE',
  'ORDER BY',
  'LIMIT',
  'SKIP',
  'AS',
  'DISTINCT',
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS NULL',
  'IS NOT NULL',
  'CONTAINS',
  'STARTS WITH',
  'ENDS WITH',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'COLLECT',
  'EXISTS',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'true',
  'false',
  'null',
] as const;

export type CypherKeyword = (typeof CYPHER_KEYWORDS)[number];

export type CompletionKind = 'keyword' | 'nodeType' | 'edgeType' | 'property';

export interface CompletionItem {
  label: string;
  kind: CompletionKind;
}

export interface CompletionContext {
  nodeTypes: string[];
  edgeTypes: string[];
  propertyKeys: string[];
}

/** カーソル直前のトークン（補完対象の文字列）を取得する */
export function getTokenBeforeCursor(text: string, cursorPos: number): string {
  const before = text.slice(0, cursorPos);
  // ラベル `:Foo` や `[r:REL]` のコロン直後の識別子
  const labelMatch = /:[A-Za-z_]\w*$/.exec(before);
  if (labelMatch) return labelMatch[0].slice(1); // コロンを除いた部分
  // プロパティ `n.foo` のドット直後の識別子
  const propMatch = /\.\w*$/.exec(before);
  if (propMatch) return propMatch[0].slice(1); // ドットを除いた部分
  // 通常のキーワード・識別子
  const kwMatch = /[A-Za-z_]\w*$/.exec(before);
  if (kwMatch) return kwMatch[0];
  return '';
}

/**
 * カーソル位置のコンテキストを判定し、補完種別を返す。
 * - `:` 直後 → ノードラベルまたはエッジタイプ
 * - `[r:` や `-[:` 直後 → エッジタイプ
 * - `(n:` や `(:` 直後 → ノードタイプ
 * - `.` 直後 → プロパティ
 * - それ以外 → キーワード
 */
export type CompletionType = 'nodeType' | 'edgeType' | 'property' | 'keyword';

export function detectCompletionType(text: string, cursorPos: number): CompletionType {
  const before = text.slice(0, cursorPos);
  // プロパティ: `n.` の直後
  if (/\w\.\w*$/.test(before)) return 'property';
  // エッジタイプ: `[r:` か `-[:` か `[:` の直後
  if (/\[[\w]*:[\w]*$/.test(before)) return 'edgeType';
  // ノードタイプ: `(:` か `(n:` の直後
  if (/\([\w]*:[\w]*$/.test(before)) return 'nodeType';
  // コロン直後（曖昧な場合はノードタイプとエッジタイプ両方）
  if (/:[\w]*$/.test(before)) return 'nodeType';
  return 'keyword';
}

/** 補完候補リストを生成する */
export function getCompletions(
  text: string,
  cursorPos: number,
  context: CompletionContext,
): CompletionItem[] {
  const token = getTokenBeforeCursor(text, cursorPos).toLowerCase();
  const type = detectCompletionType(text, cursorPos);

  let candidates: CompletionItem[];

  if (type === 'nodeType') {
    candidates = context.nodeTypes.map((t) => ({
      label: t,
      kind: 'nodeType' as const,
    }));
  } else if (type === 'edgeType') {
    candidates = context.edgeTypes.map((t) => ({
      label: t,
      kind: 'edgeType' as const,
    }));
  } else if (type === 'property') {
    candidates = context.propertyKeys.map((k) => ({
      label: k,
      kind: 'property' as const,
    }));
  } else {
    candidates = CYPHER_KEYWORDS.map((k) => ({
      label: k,
      kind: 'keyword' as const,
    }));
  }

  if (!token) return candidates;
  return candidates.filter((c) => c.label.toLowerCase().startsWith(token));
}

/** トークンを補完テキストで置き換えた新しいテキストとカーソル位置を返す */
export function applyCompletion(
  text: string,
  cursorPos: number,
  completionLabel: string,
): { newText: string; newCursorPos: number } {
  const before = text.slice(0, cursorPos);
  const after = text.slice(cursorPos);

  // プロパティ補完: ドット直後のトークンを置き換え
  const propMatch = /\.\w*$/.exec(before);
  if (propMatch) {
    const start = cursorPos - propMatch[0].length + 1; // ドット直後から
    const newText = text.slice(0, start) + completionLabel + after;
    return { newText, newCursorPos: start + completionLabel.length };
  }

  // ラベル補完: コロン直後のトークンを置き換え
  const labelMatch = /:[A-Za-z_]\w*$/.exec(before);
  if (labelMatch) {
    const start = cursorPos - labelMatch[0].length + 1; // コロン直後から
    const newText = text.slice(0, start) + completionLabel + after;
    return { newText, newCursorPos: start + completionLabel.length };
  }

  // コロン直後（まだ文字が無い場合）: `:` 直後に挿入
  const colonMatch = /:$/.exec(before);
  if (colonMatch) {
    const newText = before + completionLabel + after;
    return { newText, newCursorPos: cursorPos + completionLabel.length };
  }

  // キーワード補完: 末尾の単語トークンを置き換え
  const kwMatch = /[A-Za-z_]\w*$/.exec(before);
  if (kwMatch) {
    const start = cursorPos - kwMatch[0].length;
    const newText = text.slice(0, start) + completionLabel + after;
    return { newText, newCursorPos: start + completionLabel.length };
  }

  // マッチなし: カーソル位置に挿入
  const newText = before + completionLabel + after;
  return { newText, newCursorPos: cursorPos + completionLabel.length };
}
