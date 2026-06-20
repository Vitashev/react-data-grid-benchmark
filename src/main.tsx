import { StrictMode, Suspense, useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createRows, COLUMN_COUNT, GRID_HEIGHT, GRID_WIDTH, ROW_COUNT } from "./fixture";
import { grids } from "./registry";
import type { ReadyDetails } from "./types";
import "./styles.css";

declare global {
  interface Window {
    __GRID_BENCHMARK__?: {
      grid: string;
      ready: boolean;
      readyMs: number | null;
      mountedCells: number | null;
      mountedCellSelector: string | null;
      scrollSelector: string | null;
      horizontalScrollSelector: string | null;
    };
  }
}

const params = new URLSearchParams(window.location.search);
const requested = params.get("grid") ?? "ace-grid";
const activeGrid = grids.find((grid) => grid.id === requested) ?? grids[0];
const startedAt = performance.now();
window.__GRID_BENCHMARK__ = { grid: activeGrid.id, ready: false, readyMs: null, mountedCells: null, mountedCellSelector: null, scrollSelector: null, horizontalScrollSelector: null };

function App() {
  const rows = useMemo(() => createRows(), []);
  const [ready, setReady] = useState(false);
  const Adapter = useMemo(() => {
    const Lazy = React.lazy(activeGrid.importer);
    return Lazy;
  }, []);

  const handleReady = useCallback((details: ReadyDetails) => {
    const root = document.querySelector("[data-benchmark-grid]");
    const state = window.__GRID_BENCHMARK__;
    if (!state || state.ready) return;
    state.ready = true;
    state.readyMs = performance.now() - startedAt;
    state.mountedCells = root?.querySelectorAll(details.mountedCellSelector).length ?? 0;
    state.mountedCellSelector = details.mountedCellSelector;
    state.scrollSelector = details.scrollSelector;
    state.horizontalScrollSelector = details.horizontalScrollSelector ?? details.scrollSelector;
    setReady(true);
  }, []);

  return (
    <main className="benchmark-shell">
      <header>
        <div>
          <span className="eyebrow">Reproducible fixture</span>
          <h1>{activeGrid.name}</h1>
          <p>{ROW_COUNT.toLocaleString()} rows × {COLUMN_COUNT} columns · {GRID_WIDTH} × {GRID_HEIGHT}px viewport</p>
        </div>
        <nav aria-label="Grid implementations">
          {grids.map((grid) => <a className={grid.id === activeGrid.id ? "active" : ""} href={`?grid=${grid.id}`} key={grid.id}>{grid.name}</a>)}
        </nav>
      </header>
      <section className="scenario-bar" aria-label="Scenario contract">
        <span>2 editable columns</span><span>sorting</span><span>filtering</span><span>virtual scrolling</span><span data-ready={ready}>{ready ? "ready" : "loading"}</span>
      </section>
      <div className="grid-frame" data-benchmark-grid>
        <Suspense fallback={<div className="loading">Loading adapter…</div>}>
          <Adapter rows={rows} onReady={handleReady} />
        </Suspense>
      </div>
      <footer>Inspect the source, raw samples, methodology, and limitations before using any result.</footer>
    </main>
  );
}

import React from "react";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
