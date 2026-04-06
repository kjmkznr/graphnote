# graphnote

グラフ構造でノートを管理する Web アプリ。ノードとエッジで概念・人物・システムの関係を視覚的に表現できる。

## 特徴

- **マウス操作でグラフ編集** — ノード追加・エッジ接続をモード切り替えで直感的に操作
- **Cypher クエリ** — 下部パネルから Cypher を直接実行してデータを参照・編集
- **プロパティ & ノート編集** — ノード/エッジを選択してサイドバーからプロパティを編集。ノードには Markdown ノートを記述可能
- **ノードタイプ管理** — Company / Person / System など用途に合わせてタイプを追加・編集
- **自動保存** — localStorage にグラフデータ(ノード・エッジ・位置)を自動保存。リロードしても復元される
- **リサイズ可能なペイン** — サイドバー・Cypher パネルの幅/高さをドラッグで調整

## セットアップ

### 前提

- [egrph-wasm](https://github.com/kjmkznr/egrph) が `../egrph/egrph-wasm/pkg/` に built 済みであること
- Node.js (volta 管理推奨)

### インストール & 起動

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開く。

### ビルド

```bash
npm run build   # dist/ に出力
npm run preview # ビルド結果をローカルでプレビュー
```

## 操作方法

| 操作 | 説明 |
|------|------|
| **Select モード** (デフォルト) | ノード/エッジをクリックして選択、ドラッグで移動 |
| **+ Node モード** | キャンバスをクリックしてノードを作成 |
| **+ Edge モード** | ノードからドラッグして別ノードへ接続 |
| 右クリック | ノード/エッジの削除、背景からノード作成 |
| **Fit** ボタン (右上) | 全ノードが見えるようにビューを調整 |
| **Cypher** バー (下部) | クリックでクエリパネルを開閉、ドラッグで高さ調整 |
| **Types** ボタン | ノードタイプの追加・編集・削除 |
| **Reset** ボタン | グラフ全体を削除 (確認あり) |

## 技術スタック

| 役割 | ライブラリ |
|------|-----------|
| グラフ DB | [egrph-wasm](https://github.com/kjmkznr/egrph) (WebAssembly + Cypher) |
| グラフ可視化 | [Cytoscape.js](https://js.cytoscape.org/) |
| ビルド | [Vite](https://vitejs.dev/) + TypeScript |

フレームワーク不使用 (vanilla TypeScript)。

## データ永続化

- **保存先**: `localStorage` キー `graphnote:v1`
- **保存内容**: 全ノード・エッジのプロパティと Cytoscape 上の座標
- **タイプ一覧**: `localStorage` キー `graphnote:types`
- グラフ変更後 300 ms のデバウンスで自動保存

## egrph-wasm について

`vite-plugin-wasm` は使用しない。wasm-bindgen の `fetch(new URL('...wasm', import.meta.url))` パターンと競合するため、`optimizeDeps.exclude` と `server.fs.allow: ['..']` で対応している。
