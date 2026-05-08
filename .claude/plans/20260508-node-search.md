# ノード検索機能 (Ctrl+F) 実装計画

## 目的

グラフ上のノードを名前で検索し、マッチしたノードをハイライト表示する。Ctrl+F で検索パネルを開き、リアルタイム検索と結果間のナビゲーションを提供する。

## 変更対象

| ファイル | 操作 | 変更内容 |
|---------|------|---------|
| `index.html` | 編集 | 検索パネル用 HTML を `#canvas-wrap` 内に追加 |
| `src/ui/domIds.ts` | 編集 | 検索パネル関連の DOM ID 定数を追加 |
| `src/ui/searchPanel.ts` | 新規作成 | 検索パネル UI コンポーネント（入力欄、マッチ数表示、前へ/次へボタン） |
| `src/controllers/searchController.ts` | 新規作成 | Ctrl+F キーバインド、検索実行、ナビゲーションのコントローラー |
| `src/styles/main.css` | 編集 | 検索パネルのスタイルを追加 |
| `src/app.ts` | 編集 | 検索コントローラーの初期化を追加 |

## 実装手順

### Step 1: DOM ID 定数の追加

`src/ui/domIds.ts` に以下を追加:
- `searchPanel`, `searchInput`, `searchMatchCount`, `searchPrevBtn`, `searchNextBtn`, `searchCloseBtn`

### Step 2: 検索パネル HTML の追加

`index.html` の `#canvas-wrap` 内（`#cy` の後、`.canvas-toolbar` の前あたりに）検索パネル用 div を追加。

構造案:
```html
<div id="search-panel" class="search-panel" style="display:none">
  <svg class="search-icon">...</svg>
  <input id="search-input" class="search-input" placeholder="ノードを検索..." />
  <span id="search-match-count" class="search-match-count"></span>
  <button id="search-prev-btn" class="search-nav-btn" title="前へ">↑</button>
  <button id="search-next-btn" class="search-nav-btn" title="次へ">↓</button>
  <button id="search-close-btn" class="search-close-btn" title="閉じる">✕</button>
</div>
```

### Step 3: 検索パネル UI コンポーネントの作成

`src/ui/searchPanel.ts` を新規作成。

責務:
- 検索パネルの表示/非表示の切り替え
- 入力欄の値取得・設定・フォーカス
- マッチ数表示の更新
- 前へ/次へ/閉じるボタンのコールバック登録

インターフェース案:
```typescript
export class SearchPanel {
  show(): void
  hide(): void
  isVisible(): boolean
  getInputValue(): string
  setInputValue(value: string): void
  focusInput(): void
  setMatchCount(current: number, total: number): void
  setCallbacks(callbacks: { onInput: (v: string) => void; onNext: () => void; onPrev: () => void; onClose: () => void }): void
}
```

### Step 4: 検索コントローラーの作成

`src/controllers/searchController.ts` を新規作成。

責務:
- `document` の `keydown` で `Ctrl+F` / `Cmd+F` を検知して検索パネルを開く
- 検索パネルが既に開いている場合はフォーカスのみ
- 検索入力時に DB 内の全ノードを走査し、`name` プロパティまたはラベルで部分一致検索
- マッチしたノードの gnId セットを `canvas.highlightByGnId()` でハイライト
- 前へ/次へボタンでマッチ間をナビゲート（該当ノードまでパン + 選択）
- Escape で検索パネルを閉じ、ハイライトをクリア

必要なコンテキスト:
- `db: GraphDB` — ノード一覧の取得
- `canvas: Canvas` — ハイライト、パン、選択操作

### Step 5: CSS スタイルの追加

`src/styles/main.css` に検索パネルのスタイルを追加。

デザイン方針:
- キャンバス右上に浮遊するパネル（z-index: 20）
- `.canvas-toolbar` と似たスタイルで統一感を出す
- 幅 ~320px、コンパクトなレイアウト
- ダークテーマ対応（既存の CSS 変数を使用）

### Step 6: app.ts への組み込み

`src/app.ts` の `setupControllers()` に検索コントローラーの初期化を追加。

```typescript
import { setupSearch } from './controllers/searchController.js';
// ...
setupSearch(this);
```

必要なコンテキストインターフェースが足りなければ `appContext.ts` に追加。

## 検索仕様

| 項目 | 仕様 |
|------|------|
| 検索対象 | ノードの `name` プロパティ（大文字小文字を区別しない部分一致）。name が無い場合はラベル名で検索 |
| 検索トリガー | Ctrl+F / Cmd+F でパネル表示、入力ごとにリアルタイム検索（debounce 150ms） |
| ハイライト | 既存の `query-match` / `query-dimmed` クラスを流用 |
| ナビゲーション | 前へ/次へボタン + Enter(次へ) / Shift+Enter(前へ) |
| フォーカス移動 | 次へ/前へで該当ノードまで `cy.animate()` でパン |
| 閉じる | Escape キー、✕ ボタン、パネル外クリック |
| ノードタイプフィルターとの共存 | フィルターで非表示のノードは検索結果にも含めない |

## 検証方法

### Generator 自己チェック
- [ ] `tsc --noEmit` で型エラーがない
- [ ] Ctrl+F で検索パネルが表示され、入力欄にフォーカスが当たる
- [ ] 検索文字列を入力するとマッチノードがハイライトされ、マッチ数が表示される
- [ ] 前へ/次へボタンでマッチ間をナビゲートできる
- [ ] Escape でパネルが閉じ、ハイライトがクリアされる
- [ ] 検索パネル表示中に通常の Ctrl+F（ブラウザの検索）が発動しない
- [ ] ノードタイプフィルターで非表示にしたノードは検索結果に含まれない

### Evaluator 評価
- [ ] 既存の機能が壊れていない（ノード作成、エッジ作成、クエリ実行、Undo/Redo）
- [ ] レスポンシブ表示でも検索パネルが適切に表示される
- [ ] 大量ノード（1000+）でも検索がラグなく動作する

## リスク

| リスク | 対策 |
|-------|------|
| ブラウザ標準の Ctrl+F と競合 | `event.preventDefault()` でブラウザの検索を抑制 |
| 既存のキーバインド（Ctrl+Enter クエリ実行等）との衝突 | 検索パネル表示時のみ Ctrl+F をフック。パネル非表示時は既存の動作を維持 |
| ハイライト状態の競合（クエリ実行 → 検索 → クエリ実行） | 検索パネルを閉じる時に `clearHighlight()` を実行。クエリ実行時も最初に `clearHighlight()` しているため問題なし |
| ノードタイプフィルターとの整合性 | 検索時に `getFilteredNodes()` を使用し、フィルター済みのノードのみを対象にする |
