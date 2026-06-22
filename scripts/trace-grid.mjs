import { spawn } from "node:child_process";
import { platform } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const grid = process.env.BENCH_GRID ?? "ace-grid";
const baseUrl = "http://127.0.0.1:4173/react-data-grid-benchmark/demo.html";
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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}?grid=${grid}&trace=scroll`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForFunction(
    () => window.__GRID_BENCHMARK__?.ready === true,
    undefined,
    { timeout: 30_000 }
  );

  const cdp = await context.newCDPSession(page);
  await cdp.send("Tracing.start", {
    categories: [
      "devtools.timeline",
      "disabled-by-default-devtools.timeline",
      "blink.user_timing"
    ].join(","),
    transferMode: "ReturnAsStream"
  });

  const scrollResult = await page.evaluate(async () => {
    const state = window.__GRID_BENCHMARK__;
    const scroller = state?.scrollSelector
      ? document.querySelector(state.scrollSelector)
      : null;
    const horizontalScroller = state?.horizontalScrollSelector
      ? document.querySelector(state.horizontalScrollSelector)
      : scroller;
    const started = performance.now();
    if (scroller instanceof HTMLElement) scroller.scrollTop = 400_000;
    if (horizontalScroller instanceof HTMLElement) horizontalScroller.scrollLeft = 1_400;
    await new Promise((resolveFrame) => requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
    ));
    return { elapsedMs: performance.now() - started };
  });

  const completed = new Promise((resolveComplete) =>
    cdp.once("Tracing.tracingComplete", resolveComplete)
  );
  await cdp.send("Tracing.end");
  const { stream } = await completed;
  let traceJson = "";
  while (true) {
    const chunk = await cdp.send("IO.read", { handle: stream });
    traceJson += chunk.data;
    if (chunk.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });

  const totals = new Map();
  const events = JSON.parse(traceJson).traceEvents;
  for (const event of events) {
    if (event.ph !== "X" || typeof event.dur !== "number") continue;
    totals.set(event.name, (totals.get(event.name) ?? 0) + event.dur / 1_000);
  }
  const summary = [...totals.entries()]
    .map(([name, totalMs]) => ({
      name,
      totalMs: Math.round(totalMs * 10) / 10
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 50);
  const longEvents = events
    .filter((event) => event.ph === "X" && (event.dur ?? 0) >= 2_000)
    .map((event) => ({
      name: event.name,
      durationMs: Math.round(event.dur / 100) / 10,
      data: event.args?.data
    }))
    .slice(0, 50);

  process.stdout.write(`${JSON.stringify({ grid, scrollResult, summary, longEvents }, null, 2)}\n`);
  await context.close();
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
