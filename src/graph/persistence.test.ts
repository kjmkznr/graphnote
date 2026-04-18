import { describe, it, expect, vi } from "vitest";
import {
  saveGraph,
  loadGraph,
  clearSaved,
  migrateFromLocalStorage,
  type IAsyncStorage,
} from "./persistence";
import { GraphDB, type IGraphExecutor } from "./db";

function makeExecutor(executeResult = "[]"): IGraphExecutor {
  return {
    execute: vi.fn().mockReturnValue(executeResult),
    exportCypher: vi.fn().mockReturnValue(""),
    nodeCount: vi.fn(),
    edgeCount: vi.fn(),
    reset: vi.fn(),
  };
}

function makeStorage(initial: Record<string, string> = {}): IAsyncStorage {
  const store = { ...initial };
  return {
    getItem: vi.fn(async (key: string) => store[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn(async (key: string) => {
      delete store[key];
    }),
  };
}

describe("persistence", () => {
  it("saveGraph should call storage.setItem", async () => {
    const db = new GraphDB();
    db.setExecutor(makeExecutor());
    const mockStorage = makeStorage();

    await saveGraph(db, {}, undefined, mockStorage);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      "graphnote:v1",
      expect.any(String),
    );
  });

  it("loadGraph should call storage.getItem and restore data", async () => {
    const mockExecutor = makeExecutor();
    const db = new GraphDB();
    db.setExecutor(mockExecutor);

    const savedData = JSON.stringify({
      version: 1,
      nodes: [{ id: "n1", labels: ["Person"], properties: { gnId: "n1" } }],
      edges: [],
      positions: { n1: { x: 10, y: 20 } },
    });

    const mockStorage = makeStorage({ "graphnote:v1": savedData });

    const result = await loadGraph(db, mockStorage);
    expect(mockStorage.getItem).toHaveBeenCalledWith("graphnote:v1");
    expect(result.positions).toEqual({ n1: { x: 10, y: 20 } });
    expect(mockExecutor.execute).toHaveBeenCalledWith(
      expect.stringContaining('CREATE (:Person {gnId: "n1"})'),
    );
  });

  it("clearSaved should call storage.removeItem", async () => {
    const mockStorage = makeStorage({ "graphnote:v1": "{}" });
    await clearSaved(mockStorage);
    expect(mockStorage.removeItem).toHaveBeenCalledWith("graphnote:v1");
  });

  it("migrateFromLocalStorage should move data from localStorage to IAsyncStorage", async () => {
    const localStorageMock: Record<string, string> = {
      "graphnote:v1": '{"version":1,"nodes":[],"edges":[],"positions":{}}',
    };
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => localStorageMock[key] ?? null,
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
    });

    const mockStorage = makeStorage();
    await migrateFromLocalStorage(mockStorage);

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      "graphnote:v1",
      expect.any(String),
    );
    expect(localStorageMock["graphnote:v1"]).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("migrateFromLocalStorage should skip if IndexedDB already has data", async () => {
    const mockStorage = makeStorage({ "graphnote:v1": "existing" });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue("localdata"),
      removeItem: vi.fn(),
    });

    await migrateFromLocalStorage(mockStorage);
    expect(mockStorage.setItem).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
