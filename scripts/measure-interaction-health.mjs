import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const baseUrl = "http://127.0.0.1:4173/react-data-grid-benchmark/demo.html";
const runs = Number(process.env.BENCH_RUNS ?? 5);
const warmups = Number(process.env.BENCH_WARMUPS ?? 1);
const ids = (process.env.BENCH_GRID?.split(",") ?? [
  "ace-grid",
  "ag-grid",
  "mui",
  "tanstack",
  "handsontable",
  "react-data-grid"
]).map((id) => id.trim()).filter(Boolean);

const server = spawn(
  process.execPath,
  [resolve(root, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1"],
  { cwd: root, stdio: "ignore" }
);

try {
  await waitForServer(baseUrl);
  const executablePath = platform() === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined;
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--enable-precise-memory-info"]
  });
  const browserVersion = browser.version();
  const grids = {};

  for (const id of ids) {
    const samples = [];
    for (let index = 0; index < warmups + runs; index += 1) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      await cdp.send("HeapProfiler.enable");

      await page.goto(`${baseUrl}?grid=${id}&interactionHealth=${index}`, {
        waitUntil: "domcontentloaded"
      });
      await page.waitForFunction(
        () => window.__GRID_BENCHMARK__?.ready === true,
        undefined,
        { timeout: 30_000 }
      );
      await page.waitForFunction(() => {
        const selector = window.__GRID_BENCHMARK__?.mountedCellSelector;
        return Boolean(selector && document.querySelector(selector));
      }, undefined, { timeout: 5_000 });

      await collectGarbage(cdp);
      const afterReadyHeapBytes = await jsHeapUsed(cdp);

      const scenario = await page.evaluate(async () => {
        const state = window.__GRID_BENCHMARK__;
        const scroller = state?.scrollSelector
          ? document.querySelector(state.scrollSelector)
          : null;
        const horizontalScroller = state?.horizontalScrollSelector
          ? document.querySelector(state.horizontalScrollSelector)
          : scroller;
        if (!(scroller instanceof HTMLElement)) {
          return {
            supported: false,
            reason: "No benchmark scroll element found.",
            longTasks: [],
            frames: []
          };
        }

        const longTasks = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longTasks.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration
            });
          }
        });
        observer.observe({ type: "longtask", buffered: true });

        const frames = [];
        const startTop = scroller.scrollTop;
        const startLeft = horizontalScroller instanceof HTMLElement ? horizontalScroller.scrollLeft : 0;
        const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        const maxLeft = horizontalScroller instanceof HTMLElement
          ? Math.max(0, horizontalScroller.scrollWidth - horizontalScroller.clientWidth)
          : 0;
        const targetTop = Math.min(maxTop, startTop + 400_000);
        const targetLeft = Math.min(maxLeft, startLeft + 1_400);
        const durationMs = 2_000;
        let previousTime = null;
        const startedAt = performance.now();

        await new Promise((resolveFrame) => {
          const step = (time) => {
            if (previousTime !== null) frames.push(time - previousTime);
            previousTime = time;
            const progress = Math.min(1, (time - startedAt) / durationMs);
            scroller.scrollTop = startTop + (targetTop - startTop) * progress;
            if (horizontalScroller instanceof HTMLElement) {
              horizontalScroller.scrollLeft = startLeft + (targetLeft - startLeft) * progress;
            }
            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
            }
          };
          requestAnimationFrame(step);
        });

        observer.disconnect();
        return {
          supported: true,
          elapsedMs: performance.now() - startedAt,
          frames,
          longTasks,
          scrollTop: scroller.scrollTop,
          scrollLeft: horizontalScroller instanceof HTMLElement ? horizontalScroller.scrollLeft : null,
          mountedCells: state?.mountedCellSelector
            ? document.querySelector("[data-benchmark-grid]")?.querySelectorAll(state.mountedCellSelector).length ?? null
            : null
        };
      });

      await collectGarbage(cdp);
      const afterScrollHeapBytes = await jsHeapUsed(cdp);

      await context.close();
      if (index >= warmups) {
        samples.push({
          afterReadyHeapBytes,
          afterScrollHeapBytes,
          heapDeltaBytes: afterScrollHeapBytes - afterReadyHeapBytes,
          ...summarizeScenario(scenario)
        });
      }
    }
    grids[id] = summarizeSamples(samples);
    process.stdout.write(`measured ${id}\n`);
  }

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    protocol: {
      warmups,
      runs,
      browser: `Chrome ${browserVersion}`,
      viewport: { width: 1280, height: 800 },
      continuousScrollDurationMs: 2_000,
      continuousScrollTarget: { y: 400_000, x: 1_400 },
      coldPagePerRun: true,
      forcedGarbageCollectionBeforeHeapReads: true
    },
    environment: {
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model ?? "unknown",
      cpuCount: cpus().length,
      memoryBytes: totalmem(),
      node: process.version
    },
    grids
  };
  await mkdir(resolve(root, "results"), { recursive: true });
  await writeFile(
    resolve(root, "results/interaction-health.json"),
    `${JSON.stringify(result, null, 2)}\n`
  );
  await writeFile(
    resolve(root, "results/interaction-health.local.json"),
    `${JSON.stringify(result, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
} finally {
  server.kill("SIGTERM");
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Vite preview did not start");
}

async function collectGarbage(cdp) {
  try {
    await cdp.send("HeapProfiler.collectGarbage");
  } catch {}
}

async function jsHeapUsed(cdp) {
  const result = await cdp.send("Performance.getMetrics");
  const metric = result.metrics.find((entry) => entry.name === "JSHeapUsedSize");
  return metric?.value ?? null;
}

function summarizeScenario(scenario) {
  if (!scenario.supported) return { supported: false, reason: scenario.reason };
  const longTaskDurations = scenario.longTasks.map((task) => task.duration);
  const frameDurations = scenario.frames;
  const droppedFrames = frameDurations.filter((duration) => duration > 20).length;
  const severeDroppedFrames = frameDurations.filter((duration) => duration > 50).length;
  return {
    supported: true,
    elapsedMs: scenario.elapsedMs,
    mountedCells: scenario.mountedCells,
    longTaskCount: longTaskDurations.length,
    longTaskTotalMs: sum(longTaskDurations),
    worstLongTaskMs: max(longTaskDurations),
    frameCount: frameDurations.length,
    averageFrameMs: average(frameDurations),
    p95FrameMs: percentile(frameDurations, 0.95),
    worstFrameMs: max(frameDurations),
    droppedFrameCount20ms: droppedFrames,
    severeFrameCount50ms: severeDroppedFrames,
    estimatedFps: frameDurations.length ? 1000 / average(frameDurations) : null,
    scrollTop: scenario.scrollTop,
    scrollLeft: scenario.scrollLeft
  };
}

function summarizeSamples(samples) {
  const keys = [
    "afterReadyHeapBytes",
    "afterScrollHeapBytes",
    "heapDeltaBytes",
    "elapsedMs",
    "mountedCells",
    "longTaskCount",
    "longTaskTotalMs",
    "worstLongTaskMs",
    "frameCount",
    "averageFrameMs",
    "p95FrameMs",
    "worstFrameMs",
    "droppedFrameCount20ms",
    "severeFrameCount50ms",
    "estimatedFps",
    "scrollTop",
    "scrollLeft"
  ];
  return {
    samples,
    median: Object.fromEntries(keys.map((key) => [key, percentile(samples.map((sample) => sample[key]), 0.5)])),
    p95: Object.fromEntries(keys.map((key) => [key, percentile(samples.map((sample) => sample[key]), 0.95)]))
  };
}

function percentile(values, quantile) {
  const sorted = values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const value = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)];
  return Math.round(value * 100) / 100;
}

function average(values) {
  const numeric = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!numeric.length) return null;
  return sum(numeric) / numeric.length;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function max(values) {
  if (!values.length) return 0;
  return Math.max(...values);
}
