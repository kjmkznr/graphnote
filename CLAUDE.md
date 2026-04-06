# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use `volta run` to prefix all Node.js commands (npm is not on PATH directly).

```bash
volta run npm run dev      # start Vite dev server at http://localhost:5173
volta run npm run build    # tsc + vite build
volta run npx tsc --noEmit # type-check only (no test runner exists)
```

Use `sed -i` (not `sed -i ''`) for in-place file edits on this machine.

## Architecture

**graphnote** is a single-page, frameworkless TypeScript app (Vite build) that combines an in-memory Cypher graph database with a visual canvas editor.

### Data layer (`src/graph/`)

- **`db.ts` (`GraphDB`)** — Wraps `WasmGraph` from `egrph-wasm`. All nodes and edges are assigned a stable `gnId` UUID property on creation. This UUID survives `WasmGraph` resets (which reset internal auto-increment IDs) and is the canonical identity used everywhere in the UI and persistence layer. All Cypher MATCH/SET/DELETE operations use `WHERE n.gnId = "..."`.
- **`persistence.ts`** — Serialises the full graph to `localStorage` (`graphnote:v1`) as `PersistedGraph`. On load, recreates nodes/edges by re-issuing CREATE statements; `gnId` props are preserved so edges can be re-linked without an ID remap table.
- **`typeRegistry.ts` (`TypeRegistry`)** — Stores the user-editable list of node types (Cypher labels) in `localStorage` (`graphnote:types`). Defaults: Company, Person, System, Service, Concept, Note.

### UI layer (`src/ui/`)

- **`canvas.ts` (`Canvas`)** — Owns the Cytoscape instance. Cytoscape node IDs equal `gnId`; edge IDs are `e-<gnId>`. `refreshGraph()` is the single method to rebuild the canvas from DB state; it captures current positions before clearing, then restores them. New nodes without a position are placed via `findFreePosition()` (spiral search from centroid). `hintPosition(gnId, pos)` lets callers pre-assign a position for a node about to be created.
- **`interactions.ts`** — There is no separate interactions module; all Cytoscape event bindings live inside `Canvas` constructor.
- **`sidebar.ts` (`Sidebar`)** — Shows properties and a markdown note for the selected node/edge. Internal properties (`gnId`) are hidden. Node type (Cypher label) is rendered as a `<select>` populated from `TypeRegistry`.
- **`queryPanel.ts` (`QueryPanel`)** — Cypher textarea + result table. Results are rendered as-is from `db.execute()`.
- **`resizer.ts`** — Manages both pane resizers. The horizontal handle (`#resize-h`) resizes the sidebar. The vertical toggle bar (`#query-toggle`) both toggles the Cypher panel open/closed on click and resizes it on drag.
- **`createNodeDialog.ts`** / **`typeManagerDialog.ts`** — Modal dialogs sharing a single `#dialog-overlay` element. `typeManagerDialog` temporarily hides `#create-node-dialog` rather than closing the overlay.

### Entry point (`src/main.ts`)

Wires all modules together. The async `main()` function:
1. Initialises WASM (`db.init()`)
2. Loads persisted graph (`loadGraph(db)`)
3. Constructs `Canvas`, `Sidebar`, `QueryPanel`
4. Registers event handlers
5. Calls `canvas.refreshGraph(...)` with saved positions

`refreshAndSave()` is the idiom used after any mutation: calls `canvas.refreshGraph(...)` then schedules a debounced `saveGraph(db, canvas.getPositions())`.

### egrph-wasm integration

The WASM package lives at `../egrph/egrph-wasm/pkg/` (outside this repo). Vite resolves `import ... from 'egrph-wasm'` via the alias in `vite.config.ts`. `server.fs.allow: ['..']` is required so Vite's dev server can serve the `.wasm` binary from the parent directory. `vite-plugin-wasm` is intentionally **not** used — it conflicts with wasm-bindgen's `fetch(new URL(..., import.meta.url))` loading pattern.

### Layout

CSS Grid on `#app`: `[canvas 1fr] [resize-h 4px] [sidebar var(--sidebar-w)]` × `[header 48px] [canvas 1fr] [query-toggle 28px] [query-panel var(--query-h)]`. Pane sizes are CSS custom properties updated by `resizer.ts`. The sidebar spans rows 2–4.
