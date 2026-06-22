import { spawn } from "node:child_process";
import { platform } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const baseUrl = "http://127.0.0.1:4173/react-data-grid-benchmark/demo.html";
const warmups = Number(process.env.BENCH_WARMUPS ?? 3);
const rounds = Number(process.env.BENCH_RUNS ?? 10);
const ids = ["ace-grid", "ag-grid"];
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
  const browser = await chromium.launch({ headless: true, executablePath });
  const samples = Object.fromEntries(ids.map((id) => [id, []]));

  for (let round = 0; round < warmups + rounds; round += 1) {
    const order = round % 2 === 0 ? ids : [...ids].reverse();
    for (const id of order) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}?grid=${id}&round=${round}`, {
        waitUntil: "domcontentloaded"
      });
      await page.waitForFunction(
        () => window.__GRID_BENCHMARK__?.ready === true,
        undefined,
        { timeout: 30_000 }
      );
      const sample = await page.evaluate(async () => {
        const state = window.__GRID_BENCHMARK__;
        const scroller = state?.scrollSelector
          ? document.querySelector(state.scrollSelector)
          : null;
        const horizontalScroller = state?.horizontalScrollSelector
          ? document.querySelector(state.horizontalScrollSelector)
          : scroller;
        const started = performance.now();
        if (scroller instanceof HTMLElement) {
          scroller.scrollTop = Math.min(
            400_000,
            scroller.scrollHeight - scroller.clientHeight
          );
        }
        if (horizontalScroller instanceof HTMLElement) {
          horizontalScroller.scrollLeft = Math.min(
            1_400,
            horizontalScroller.scrollWidth - horizontalScroller.clientWidth
          );
        }
        await new Promise((resolveFrame) => requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
        ));
        const rootElement = document.querySelector("[data-benchmark-grid]");
        return {
          readyMs: state?.readyMs ?? null,
          scrollSettleMs: performance.now() - started,
          mountedCells: state?.mountedCellSelector
            ? rootElement?.querySelectorAll(state.mountedCellSelector).length ?? 0
            : null
        };
      });
      await context.close();
      if (round >= warmups) samples[id].push({ round, ...sample });
    }
  }

  await browser.close();
  const output = {
    label: process.env.BENCH_VARIANT_LABEL ?? "local",
    protocol: { warmups, rounds, alternatingOrder: true, freshContextPerSample: true },
    ...(process.env.BENCH_SUMMARY_ONLY === "1" ? {} : { samples }),
    summary: Object.fromEntries(ids.map((id) => [id, summarize(samples[id])]))
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} finally {
  server.kill("SIGTERM");
}

function summarize(samples) {
  return Object.fromEntries(
    ["readyMs", "scrollSettleMs", "mountedCells"].map((key) => {
      const values = samples
        .map((sample) => sample[key])
        .filter((value) => typeof value === "number")
        .sort((a, b) => a - b);
      return [key, {
        median: percentile(values, 0.5),
        p95: percentile(values, 0.95)
      }];
    })
  );
}

function percentile(values, quantile) {
  if (!values.length) return null;
  return Math.round(
    values[Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1)] * 100
  ) / 100;
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
