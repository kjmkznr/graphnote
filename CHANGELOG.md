# CHANGELOG

## [未リリース]

### 2026-04-18

#### コード品質改善
- Biome lint の警告をすべて修正（noVoidTypeReturn、noNonNullAssertion）

---

### 2026-04-17

#### バグ修正
- Cytoscape セレクタで無効な `:not()` 擬似クラスを使用していた問題を修正。`[!ghost]` / `[!edgeHandle]` 構文に置換し、コンソール警告を解消
- `borderColor` データを持たないノードに `data(borderColor)` マッピングが適用されコンソール警告が出ていた問題を修正。`node[borderColor]` セレクタに分離してスコープを限定
- `wheelSensitivity` にカスタム値を設定していたことによるコンソール警告を修正。プロパティ自体を削除しデフォルト値を使用

---

### 2026-04-16

#### 新機能
- グラフ名のインライン編集機能を追加。セレクトボックスのダブルクリックまたは✎ボタンでその場でグラフ名を変更可能に

#### UI改善
- グラフ作成・名前変更・削除ボタンのアイコンサイズ拡大およびボタンのパディングを除去して視認性を向上

#### バグ修正
- URLシェアで受け取ったグラフが既存の「デフォルト」グラフを上書きしていた問題を修正。新しいグラフとしてインポートするよう変更

---

### 2026-04-15

#### パフォーマンス改善
- `src/controllers/queryPanelController.ts` の `queryPanel.onExecute` に計測ポイントを追加し、`db.execute(query)` / `getAllNodes+getAllEdges` / `canvas.refreshGraph` / `highlightByGnId` / `enrichRowsWithEdges` / 全体処理時間を `console.info('[perf] queryPanel.onExecute', ...)` で個別に確認できるよう改善

### 2026-04-14

#### 新機能
- プロパティの型を自動検出し、専用の入力UIとバリデーションを提供する機能を追加
  - **日付 (date)**: キー名（`date`, `createdAt`, `birthday` など）または値パターン（`YYYY-MM-DD`）から検出。`<input type="date">` で日付ピッカーを表示
  - **URL**: キー名（`url`, `link`, `website` など）または値パターン（`https://...`）から検出。`<input type="url">` を使用し、値が設定済みの場合は「↗」リンクボタンを表示
  - **メール (email)**: キー名（`email`, `mail` など）または値パターンから検出。`<input type="email">` を使用
  - **数値 (number)**: 数値型の値から検出。`<input type="number">` を使用
  - **真偽値 (boolean)**: boolean 型の値から検出。チェックボックスで表示・編集
  - **文字列 (string)**: 上記以外はすべて通常のテキスト入力
- 型に応じたバリデーションを実装。不正な値を入力するとインライン エラーメッセージを表示し、無効な値はプロパティに反映しない
- プロパティキーの横に型バッジ（📅 🔗 ✉ # ☑）を表示し、型を視覚的に識別できるよう改善
- `src/ui/propertyInput.ts` を新規追加。型検出（`detectPropertyType`）・バリデーション（`validatePropertyValue`）・値変換（`parsePropertyValue` / `propertyValueToString`）・入力要素生成（`createPropertyInput`）を提供

---
### 2026-04-13

#### 新機能
- IndexedDB に複数グラフを名前付きで保存できる複数グラフ管理機能を追加
- ヘッダーにグラフ切替ドロップダウン（`#graph-select`）を追加。グラフを選択すると現在のグラフを保存してから切り替える
- 新規グラフ作成ボタン（＋）を追加。名前を入力して新しいグラフを作成し、即座に切り替える
- グラフリネームボタン（✎）を追加。現在のグラフ名をその場で変更できる
- グラフ削除ボタン（🗑）を追加。最後の1つは削除不可。削除後は別のグラフに自動切替
- `GraphManager` クラスを `src/graph/graphManager.ts` に新規追加。グラフ一覧の管理（作成・削除・リネーム・切替・保存）を担当
- `GraphSwitcher` クラスを `src/ui/graphSwitcher.ts` に新規追加。ヘッダーのグラフ切替UIを管理
- IndexedDB のスキーマバージョンを 2 → 3 に更新し、`graph-meta` オブジェクトストアを追加（グラフ一覧の永続化）
- `IndexedDBStorage` に `listGraphMeta` / `putGraphMeta` / `deleteGraphMeta` メソッドを追加
- `saveGraph` / `loadGraph` / `clearSaved` に `graphId` オプション引数を追加。グラフIDを指定するとキー `graph:{id}` で保存・読込・削除する
- 既存の `graphnote:v1` データは初回起動時に自動でデフォルトグラフとして移行する

#### パフォーマンス改善
- ノード選択時のハイライト処理を最適化。`highlightConnected` の可変長パス走査クエリ（`[*0..]` / `UNION MATCH (n)-[*1..]-()-[r]-()` ）を直接隣接ノード・エッジのみ取得するクエリ（`MATCH (n)--(m)` / `MATCH (n)-[r]-()` ）に変更し、ノード数増加時の指数的な計算量増大を解消
- `GraphRenderer.highlightByGnId` で `cy.edges().forEach()` による全エッジ走査を `cy.edges().filter()` に変更し、Cytoscapeのコレクション操作として一括処理するよう改善

---

### 2026-04-13

#### 新機能
- グラフキャンバスにレイアウトプリセット切り替えボタンを追加。右上の「Layout ▾」ボタンにホバーすると cose / circle / concentric / grid / breadthfirst の5種類のサブボタンが現れ、即時適用できる
- `Canvas.applyLayout()` メソッドを追加し、Cytoscape 内蔵レイアウトをアニメーション付きで実行
- よく使う Cypher クエリに名前を付けて保存・再実行できる「保存済みクエリ（Bookmarks）」機能を追加。QueryPanel のブックマークバーのドロップダウンから選択して即時ロード、★保存ボタンで現在のクエリを登録、✕削除ボタンで選択中のブックマークを削除できる
- `BookmarkStore` クラスを `src/graph/bookmarkStore.ts` に新規追加。IndexedDB（`graphnote` DB の `bookmarks` オブジェクトストア）でブックマークを永続化
- IndexedDB のスキーマバージョンを 1 → 2 に更新し、`bookmarks` オブジェクトストアを追加（`persistence.ts` / `bookmarkStore.ts` の `onupgradeneeded` で対応）
- グラフデータの保存先を localStorage（5MB 制限）から IndexedDB に移行し、大規模グラフに対応
- 既存の localStorage データを初回起動時に自動で IndexedDB へ移行する `migrateFromLocalStorage` を追加
- `IAsyncStorage` インターフェースと `IndexedDBStorage` クラスを新規追加。`saveGraph` / `loadGraph` / `clearSaved` を非同期 API に変更

#### セキュリティ
- `sidebar.ts` と `scrapbook.ts` で marked の出力を `DOMPurify.sanitize()` でサニタイズし、XSS 脆弱性を修正
- `canvasEventController.ts` のホバーツールチップで、ノードの `note` プロパティを marked でレンダリングした後に `DOMPurify.sanitize()` を適用し、XSS 脆弱性を修正

#### リファクタリング
- `App.initUI()` と `App.setupControllers()` を `private` に変更し、外部から誤って再呼び出しされないよう保護
- `App.init()` を `initData()` / `initUI()` / `setupControllers()` の3メソッドに分割し、責務を明確化
- `Canvas.initRegistries()` を削除。コンストラクタ末尾で `applyStyles()` を直接呼ぶよう変更し、`afterNextPaint` 内での冗長な再初期化を除去
- `appContext.ts` の `captureForUndo` / `scheduleSave` / `refreshAndSave` の重複定義を解消。共通メソッドを `AppOperations` インターフェースに抽出し、各コンテキストインターフェース（`SidebarContext`, `QueryPanelContext`, `UndoContext`, `ToolbarContext`, `CanvasEventContext`）で `Pick<AppOperations, ...>` を使って必要なメソッドのみ継承するよう変更
- `sidebar.ts` の `marked(value)` を非推奨の関数呼び出しから `marked.parse(value)` に統一
- `scrapbook.ts` の `buildGraphSection` を `src/ui/scrapbookMiniGraph.ts` の `buildMiniGraph` 関数として独立モジュールに切り出し
- `scrapbook.ts` の `makeMarkdownEditor` と `sidebar.ts` の Markdown レンダリングロジックを `src/ui/markdownEditor.ts` に統合。`makeMarkdownEditor`（エディタ＋プレビューペア生成）と `renderMarkdownContent`（marked+DOMPurify によるレンダリング）を共有ユーティリティとしてエクスポート
- `scrapbook.ts` の責務過多を解消。Markdown セル・QueryResult セル・Section セル・Snapshot セルのレンダリング、ドラッグ&ドロップ、セルヘルパーをそれぞれ `src/ui/scrapbook/` 配下の独立モジュール（`markdownCell.ts` / `queryResultCell.ts` / `sectionCell.ts` / `snapshotCell.ts` / `dragDrop.ts` / `cellHelpers.ts`）に分離し、`scrapbook.ts` を薄いオーケストレーターに変更
- `queryResultCell.ts` の `buildChartSection` 内で `innerHTML = ''` を使用していた箇所を `clearChildren()` ユーティリティに統一
- `scrapbook.ts` の `renderCells` 内で `innerHTML = ''` を使用していた箇所を `clearChildren()` ユーティリティに統一

#### バグ修正
- Bookmarks ドロップダウンで項目を選択してもクエリ入力欄が変化しない問題を修正。`change` イベントハンドラで `setQuery()` の呼び出しが `onSelectBookmarkCb` の存在チェックの内側にあったため、コールバック未登録時に入力欄が更新されなかった。`setQuery()` を条件外で先に呼ぶよう変更
- `app.ts` の `byId('loading')?.remove()` を `document.getElementById('loading')?.remove()` に変更。`byId` は要素が見つからない場合に例外を投げるため `?.` との組み合わせが矛盾していた
- `queryPanelController.ts` で読み取り専用クエリ（MATCH のみ）でも `captureForUndo` が実行されていた問題を修正。`CREATE` / `MERGE` / `SET` / `DELETE` / `DETACH` / `REMOVE` / `DROP` などの変更系キーワードを含むクエリのみ undo スタックに積むよう変更
- `queryPanelController.ts` で全クエリが無条件にスクラップブックへ追加されていた問題を修正。書き込み系クエリ（`CREATE` / `MERGE` / `SET` / `DELETE` / `DETACH` / `REMOVE` / `DROP`）のみスクラップブックに保存するよう変更
- `queryPanelController.ts` の `isWriteQuery` で文字列リテラル内の書き込みキーワード（例: `MATCH (n) WHERE n.note CONTAINS "SET password"`）を誤って書き込みと判定していた問題を修正。クエリから文字列リテラルを除去してからキーワードマッチを行うよう変更

---

### 2026-04-12

#### 新機能
- CSV の行をノード、列をプロパティとして一括取り込み。関係列からエッジも自動生成する CSV インポート機能を追加
- ノード・エッジホバー時にプロパティとノートの概要をポップアップ表示
- バックグラウンドタップ時の処理と接続ノードのハイライト表示を追加
- Scrapbook セルヘッダーにメモボタンと Markdown サポートを追加
- Scrapbook セルにメモ機能と Markdown サポートを追加
- Scrapbook にセクションセルとドラッグ＆ドロップによる並び替えを追加
- ノートの Markdown プレビューとトグル機能を追加
- モバイル向けレスポンシブサイドバーとタッチ操作サポートを追加
- ダッシュボードタブとデータ可視化機能を追加
- ノードタイプのスタイリングと管理機能を追加
- ノードタイプのフィルタリング機能を追加

#### バグ修正
- `Canvas.updateNodeStyles()` が `GraphRenderer` を毎回再生成して `positionHints` が消える問題を修正。`GraphRenderer.setRegistry()` メソッドを追加し、インスタンスを再利用するよう変更
- `Sidebar` の `registry` フィールドを `TypeRegistry!`（definite assignment）から `TypeRegistry | undefined` に変更し、`?.` による optional chaining との矛盾を解消

#### リファクタリング
- `scrapbook.ts` の `buildGraphSection` 内にハードコードされていた `PALETTE` 配列を `src/utils/colors.ts` の `DEFAULT_NODE_COLORS` 定数に切り出し、`typeRegistry.ts` と共有するよう変更（重複定義を解消）
- `Canvas.bindEvents()` をイベントグループ別に `bindTapEvents()` / `bindHoverEvents()` / `bindEdgeDragEvents()` / `bindDeleteKeyEvent()` の4メソッドに分割し、可読性を向上
- `GraphDB.deleteNode()` の2段階削除（エッジ削除→ノード削除）を `DETACH DELETE` による1クエリに統合（egrph-wasm は `DETACH DELETE` をサポート）
- `Canvas` の `nodeRegistry` / `edgeRegistryRef` フィールドを nullable から non-null に変更。コンストラクタで `TypeRegistry` と `EdgeTypeRegistry` を受け取るようにし、`!` アサーションを除去。`initRegistries()` は `GraphRenderer.setRegistry()` を呼ぶだけに簡略化
- `enrichRowsWithEdges` の Cypher クエリで gnId を直接埋め込んでいた箇所を `escStr` 関数を使用するよう修正
- `CanvasEventController.highlightConnected()` で手書きしていたエスケープ処理を `escStr()` に置き換え（重複排除）
- `NodeTypeStyleDialog` と `EdgeTypeStyleDialog` の共通ロジック（`showError`, `clearError`, `onAdd`, `onClose`, `onOverlayClick`, `onKeydown`）を `typeStyleDialogBase.ts` の `createTypeStyleDialogBase` に抽出し、構造的重複を解消
- `persistence.ts` の `importFromFile` からDOM操作を除去し、JSONを受け取る純粋関数 `loadFromJson` に変更。ファイル選択UI（`openFilePicker`）は `app.ts` に移動（関心の分離）
- チャート描画ロジックを `src/ui/charts.ts` に独立モジュールとして抽出。`Scrapbook`（縦棒・折れ線チャート）と `Dashboard`（水平バーチャート）の両方から共有利用するよう変更し、重複実装を解消
- チャート初期化の共通ロジックを `buildChartBase` ヘルパーに抽出
- エッジ検出ロジックを `isEdgeValue` ヘルパーに抽出
- `TypeRegistry` と `EdgeTypeRegistry` の重複実装をジェネリクス基底クラス `BaseTypeRegistry<TStyle>` に統合（`src/graph/baseTypeRegistry.ts` 新規作成）
- `App` クラスの責務をコントローラー単位に分割し、`app.ts` を薄いオーケストレーターへ再構成（`appContext.ts` と `src/controllers/` 配下モジュールを追加）
- `scheduleSave()` から `refreshCompletionContext()` の呼び出しを除去し、`refreshAndSave()` 内で明示的に呼ぶよう変更（保存とオートコンプリートコンテキスト更新の関心を分離）
- `AppContext` をコントローラー毎の最小サブインターフェース（`CanvasEventContext`, `SidebarContext`, `QueryPanelContext`, `UndoContext`, `ToolbarContext`, `NodeTypeFilterContext`）に分割し、各コントローラーが必要な依存のみを受け取るよう変更（依存関係の明確化）
- `makeMemoSection()` と `renderMarkdownCell()` で重複していたプレビュー／エディタ切り替えロジックを `makeMarkdownEditor()` ヘルパーに抽出し、重複を解消

#### メンテナンス
- `typescript` を v6 にアップグレード
- `@kjmkznr/egrph-wasm` を v0.2.1 にアップグレード

---

### 2026-04-11

#### 新機能
- エッジタイプのスタイリングと管理機能を追加
- URL によるグラフ共有機能を追加
- アンドゥ／リドゥ機能を追加
- グラフキャンバスにインタラクティブなミニマップを追加
- 選択したノードとエッジの一括削除をサポート
- タブナビゲーションのディープリンクとブラウザ履歴更新を有効化
- クライアント座標からキャンバス座標への変換によるノード配置ロジックを追加

#### バグ修正
- Scrapbook の行フラット化処理でエッジのみの行を除外するよう修正

#### リファクタリング
- `Scrapbook` から `GraphDB` 依存を除去し、エッジ補完処理を `App` に集約

#### メンテナンス
- `vite` を v8.0.5、`vitest` を v3.2.4 にアップグレード
- `@kjmkznr/egrph-wasm` を v0.2.0 にアップグレード

---

### 2026-04-10

#### 新機能
- エッジタイプを動的に管理する `EdgeTypeRegistry` を導入
- ノートブックセルにネットワークグラフとチャートのレンダリングを追加

#### バグ修正
- `png()` メソッドのフルレンダリング無効化とスケーリング・サイズ制限の調整
- エッジ取得ロジックで `_src` と `_dst` を保存済みノード ID にマッピングするよう修正

#### リファクタリング
- Scrapbook のスナップショットクリック処理をモーダル表示に変更
- `Notebook` を `Scrapbook` に名称変更

---

### 2026-04-09

#### 新機能
- Markdown セルのライブレンダリングとエディタトグルを追加
- ビューポートの永続化とキャンバスリサイズロジックを改善
- Notebook 機能（Markdown・クエリ結果・スナップショット）を導入
- Cypher エクスポート、成功トースト通知、ドロップダウン UI を追加

#### バグ修正
- バッククォートエスケープをバリデーションに置き換え（パーサー非対応のため）
- Cypher インジェクションを防ぐためラベル・タイプ・プロパティキーをバッククォートエスケープ

#### リファクタリング
- `document.getElementById` を `byId` ユーティリティに統一
- ネストした rAF を `afterNextPaint` に置き換え
- 未使用の `activeTab` プロパティを削除

#### メンテナンス
- GitHub Pages デプロイ用 GitHub Actions ワークフローを追加
- `.idea` フォルダを削除し `.gitignore` に追加
- CSS のオーバーフローと高さプロパティを調整
- フォールバック `monospace` フォントを追加
- CSS 値を正規化

---

### 2026-04-08

#### メンテナンス
- `@kjmkznr/egrph-wasm` npm パッケージへ移行し WASM 統合を簡素化
- View/Edit トグルを削除しインタラクションモードを簡素化
- Vitest テストフレームワークを導入し初期テストカバレッジを追加

---

### 2026-04-07

#### 新機能
- View/Edit 2モード統合とホバーハンドルによるエッジ作成
- グラフのエクスポート／インポート機能を追加
- クエリにマッチしたノード／エッジのキャンバスハイライト表示

#### バグ修正
- クエリハイライト: マッチしたノード間のエッジのみをハイライトするよう修正
- Cypher 文字列の改行・復帰・タブのエスケープを修正
- ノートの保存競合を修正（即時 DB 書き込みと debounce 保存の組み合わせ）
- ノード作成モードでのノードドラッグを有効化

#### リファクタリング
- Canvas を GraphRenderer と cytoscapeStyles に分割
- GnId ブランド型を導入し O(n) ルックアップを修正
- App クラスを main.ts から抽出
- キャンバスリフレッシュに差分更新を実装
- `db.execute` をジェネリック化: `execute<T = unknown>(cypher): T[]`
- `window.prompt` をカスタムエッジタイプダイアログに置き換え
- innerHTML+エスケープの重複を排除し、エスケープ漏れを修正

---

### 2026-04-06

#### 新機能
- Cypher パネルをデフォルトで折りたたみ、トグルバーを追加
- ノードタイプセレクターと管理ダイアログを追加
- graphnote ウェブアプリの初期実装

#### バグ修正
- 新規ノードを重ならない位置に配置するよう修正

#### リファクタリング
- Fit ボタンをヘッダーからキャンバスオーバーレイに移動
- CSS を index.html から src/styles/main.css に分離

#### メンテナンス
- トースト通知によるユーザー向けエラー表示を追加
- Nix 開発環境のマルチプラットフォームサポートとドキュメント更新
- ビルド時のチャンクサイズ警告を解消（manualChunks と chunkSizeWarningLimit を設定）
- README.md を追加
- CLAUDE.md（アーキテクチャと開発コマンド）を追加

---

### 2026-04-05

#### その他
- 初回コミット
