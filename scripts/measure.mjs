import { spawn } from "node:child_process";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const baseUrl = "http://127.0.0.1:4173/react-data-grid-benchmark/demo.html";
const warmups = Number(process.env.BENCH_WARMUPS ?? 3);
const runs = Number(process.env.BENCH_RUNS ?? 10);
const allAdapters = [
  ["ace-grid", "src/adapters/AceGridAdapter.tsx"],
  ["ag-grid", "src/adapters/AgGridAdapter.tsx"],
  ["mui", "src/adapters/MuiGridAdapter.tsx"],
  ["tanstack", "src/adapters/TanStackAdapter.tsx"],
  ["handsontable", "src/adapters/HandsontableAdapter.tsx"],
  ["react-data-grid", "src/adapters/ReactDataGridAdapter.tsx"]
];
const adapters = process.env.BENCH_GRID ? allAdapters.filter(([id]) => id === process.env.BENCH_GRID) : allAdapters;

const server = spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });

try {
  await waitForServer(baseUrl);
  const executablePath = platform() === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined;
  let browserVersion = "unknown";
  const runtime = {};
  for (const [id] of adapters) {
    if (id === "mui") {
      runtime[id] = {
        excluded: true,
        reason: "MUI X Community forces pagination and limits pages to 100 rows."
      };
      process.stdout.write(`excluded ${id} runtime (forced pagination)\n`);
      continue;
    }
    const browser = await chromium.launch({ headless: true, executablePath });
    browserVersion = browser.version();
    const samples = [];
    for (let index = 0; index < warmups + runs; index += 1) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(`${baseUrl}?grid=${id}&run=${index}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GRID_BENCHMARK__?.ready === true, undefined, { timeout: 30_000 });
      await page.waitForFunction(() => {
        const selector = window.__GRID_BENCHMARK__?.mountedCellSelector;
        return Boolean(selector && document.querySelector(selector));
      }, undefined, { timeout: 5_000 });
      const sample = await page.evaluate(async () => {
        const state = window.__GRID_BENCHMARK__;
        const scroller = state?.scrollSelector ? document.querySelector(state.scrollSelector) : null;
        const horizontalScroller = state?.horizontalScrollSelector ? document.querySelector(state.horizontalScrollSelector) : scroller;
        let scrollSettleMs = null;
        if (scroller instanceof HTMLElement) {
          const started = performance.now();
          scroller.scrollTop = Math.min(400_000, scroller.scrollHeight - scroller.clientHeight);
          if (horizontalScroller instanceof HTMLElement) horizontalScroller.scrollLeft = Math.min(1_400, horizontalScroller.scrollWidth - horizontalScroller.clientWidth);
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
          scrollSettleMs = performance.now() - started;
        }
        const root = document.querySelector("[data-benchmark-grid]");
        const mountedCells = state?.mountedCellSelector ? root?.querySelectorAll(state.mountedCellSelector).length ?? 0 : null;
        return { readyMs: state?.readyMs ?? null, mountedCells, scrollSettleMs };
      });
      await context.close();
      if (index >= warmups) samples.push(sample);
    }
    runtime[id] = summarizeSamples(samples);
    await browser.close();
    process.stdout.write(`measured ${id}\n`);
  }

  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const result = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    fixture: { rows: 50_000, columns: 20, viewport: { width: 1200, height: 600 }, editableColumns: 2 },
    protocol: { warmups, runs, browser: `Chrome ${browserVersion}`, coldPagePerRun: true },
    environment: { platform: platform(), release: release(), cpu: cpus()[0]?.model ?? "unknown", cpuCount: cpus().length, memoryBytes: totalmem(), node: process.version },
    versions: Object.fromEntries(Object.entries(packageJson.dependencies).filter(([name]) => ["@ace-grid/core", "ag-grid-react", "@mui/x-data-grid", "@tanstack/react-table", "handsontable", "react-data-grid", "react"].includes(name))),
    comparability: Object.fromEntries(adapters.map(([id]) => [id, id === "mui"
      ? { datasetMode: "forced-pagination", runtimeComparable: false, reason: "MUI X Community forces pagination and limits pages to 100 rows." }
      : { datasetMode: "continuous-virtual", runtimeComparable: true }])),
    bundles: await bundleSizes(),
    runtime
  };
  const outputName = process.env.BENCH_GRID ? `partials/${process.env.BENCH_GRID}.json` : "latest.json";
  await mkdir(resolve(root, "results/partials"), { recursive: true });
  await writeFile(resolve(root, "results", outputName), `${JSON.stringify(result, null, 2)}\n`);
} finally {
  server.kill("SIGTERM");
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Vite preview did not start");
}

function summarizeSamples(samples) {
  const summarize = (key) => {
    const values = samples.map((sample) => sample[key]).filter((value) => typeof value === "number").sort((a, b) => a - b);
    return { median: percentile(values, 0.5), p95: percentile(values, 0.95), samples: values };
  };
  return { readyMs: summarize("readyMs"), scrollSettleMs: summarize("scrollSettleMs"), mountedCells: summarize("mountedCells") };
}

function percentile(values, quantile) {
  if (!values.length) return null;
  return Math.round(values[Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1)] * 100) / 100;
}

async function bundleSizes() {
  const manifest = JSON.parse(await readFile(resolve(root, "dist/.vite/manifest.json"), "utf8"));
  const results = {};
  for (const [id, adapterKey] of adapters) {
    const files = new Set();
    collectFiles(manifest, "demo.html", files);
    collectFiles(manifest, adapterKey, files);
    let rawBytes = 0;
    let gzipBytes = 0;
    for (const file of files) {
      if (!file.endsWith(".js")) continue;
      const body = await readFile(resolve(root, "dist", file));
      rawBytes += body.byteLength;
      gzipBytes += gzipSync(body).byteLength;
    }
    results[id] = { rawBytes, gzipBytes, files: [...files].filter((file) => file.endsWith(".js")).sort() };
  }
  return results;
}

function collectFiles(manifest, key, files, seen = new Set()) {
  if (seen.has(key) || !manifest[key]) return;
  seen.add(key);
  const entry = manifest[key];
  if (entry.file) files.add(entry.file);
  for (const dependency of entry.imports ?? []) collectFiles(manifest, dependency, files, seen);
}
