import type { GnId } from '../types.js';
import type { GraphDB } from './db.js';
import {
  clearSaved,
  type GraphMeta,
  IndexedDBStorage,
  loadGraph,
  saveGraph,
} from './persistence.js';

export interface GraphSwitchResult {
  positions: Record<GnId, { x: number; y: number }>;
  viewport?: { pan: { x: number; y: number }; zoom: number };
}

/**
 * 複数グラフの管理（作成・削除・リネーム・切替）を担当するクラス。
 */
export class GraphManager {
  private storage: IndexedDBStorage;
  private _currentGraphId: string = '';
  private _graphs: GraphMeta[] = [];

  constructor(storage: IndexedDBStorage = new IndexedDBStorage()) {
    this.storage = storage;
  }

  get currentGraphId(): string {
    return this._currentGraphId;
  }

  get graphs(): GraphMeta[] {
    return this._graphs;
  }

  get currentGraph(): GraphMeta | undefined {
    return this._graphs.find((g) => g.id === this._currentGraphId);
  }

  /**
   * 初期化: グラフ一覧を読み込み、必要に応じてデフォルトグラフを作成する。
   * 旧データ（graphnote:v1）が存在する場合はデフォルトグラフとして移行する。
   */
  async init(): Promise<void> {
    this._graphs = await this.storage.listGraphMeta();

    if (this._graphs.length === 0) {
      // 旧データの移行: graphnote:v1 が存在すればデフォルトグラフとして登録
      const legacyData = await this.storage.getItem('graphnote:v1');
      const defaultMeta: GraphMeta = {
        id: crypto.randomUUID(),
        name: 'デフォルト',
        createdAt: Date.now(),
      };
      await this.storage.putGraphMeta(defaultMeta);
      if (legacyData) {
        // 旧データを新キーにコピー
        await this.storage.setItem(`graph:${defaultMeta.id}`, legacyData);
      }
      this._graphs = [defaultMeta];
    }

    this._currentGraphId = this._graphs[0]?.id ?? '';
  }

  /**
   * 新しいグラフを作成して切り替える。
   */
  async createGraph(name: string): Promise<GraphMeta> {
    const meta: GraphMeta = {
      id: crypto.randomUUID(),
      name: name.trim() || '新しいグラフ',
      createdAt: Date.now(),
    };
    await this.storage.putGraphMeta(meta);
    this._graphs.push(meta);
    return meta;
  }

  /**
   * グラフを削除する。最後の1つは削除できない。
   */
  async deleteGraph(id: string): Promise<void> {
    if (this._graphs.length <= 1) {
      throw new Error('最後のグラフは削除できません');
    }
    await this.storage.deleteGraphMeta(id);
    await clearSaved(this.storage, id);
    this._graphs = this._graphs.filter((g) => g.id !== id);
  }

  /**
   * グラフ名を変更する。
   */
  async renameGraph(id: string, newName: string): Promise<void> {
    const meta = this._graphs.find((g) => g.id === id);
    if (!meta) throw new Error('グラフが見つかりません');
    meta.name = newName.trim() || meta.name;
    await this.storage.putGraphMeta(meta);
  }

  /**
   * 現在のグラフを保存する。
   */
  async saveCurrentGraph(
    db: GraphDB,
    positions: Record<GnId, { x: number; y: number }>,
    viewport?: { pan: { x: number; y: number }; zoom: number },
  ): Promise<void> {
    await saveGraph(db, positions, viewport, this.storage, this._currentGraphId);
  }

  /**
   * 指定グラフに切り替えてデータを読み込む。
   */
  async switchGraph(id: string, db: GraphDB): Promise<GraphSwitchResult> {
    this._currentGraphId = id;
    return loadGraph(db, this.storage, id);
  }

  /**
   * 現在のグラフIDを設定する（初期ロード後の切替に使用）。
   */
  setCurrentGraphId(id: string): void {
    this._currentGraphId = id;
  }
}
