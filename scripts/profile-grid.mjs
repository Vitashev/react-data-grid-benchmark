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
  const cdp = await context.newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 1_000 });

  process.stderr.write(`[profile] ${grid}: startup\n`);
  await cdp.send("Profiler.start");
  await page.goto(`${baseUrl}?grid=${grid}&profile=startup`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForFunction(
    () => window.__GRID_BENCHMARK__?.ready === true,
    undefined,
    { timeout: 30_000 }
  );
  const startup = await cdp.send("Profiler.stop");

  process.stderr.write(`[profile] ${grid}: scroll\n`);
  await cdp.send("Profiler.start");
  const scrollResult = await page.evaluate(async () => {
    const state = window.__GRID_BENCHMARK__;
    const scroller = state?.scrollSelector
      ? document.querySelector(state.scrollSelector)
      : null;
    const horizontalScroller = state?.horizontalScrollSelector
      ? document.querySelector(state.horizontalScrollSelector)
      : scroller;
    const frameTimes = [];
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
    for (let index = 0; index < 6; index += 1) {
      await new Promise((resolveFrame) => requestAnimationFrame((time) => {
        frameTimes.push(time - started);
        resolveFrame();
      }));
    }
    return { elapsedMs: performance.now() - started, frameTimes };
  });
  const scroll = await cdp.send("Profiler.stop");
  process.stderr.write(`[profile] ${grid}: summarize\n`);

  process.stdout.write(`${JSON.stringify({
    grid,
    readyMs: await page.evaluate(() => window.__GRID_BENCHMARK__?.readyMs),
    scrollResult,
    startup: summarizeProfile(startup.profile),
    scroll: summarizeProfile(scroll.profile)
  }, null, 2)}\n`);

  await context.close();
  await browser.close();
} finally {
  server.kill("SIGTERM");
}

function summarizeProfile(profile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map();
  for (const node of profile.nodes) {
    for (const childId of node.children ?? []) parents.set(childId, node.id);
  }
  const selfTotals = new Map();
  const inclusiveTotals = new Map();
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  for (let index = 0; index < samples.length; index += 1) {
    let node = nodes.get(samples[index]);
    if (!node) continue;
    const deltaMs = (deltas[index] ?? 0) / 1000;
    const selfKey = frameKey(node.callFrame);
    selfTotals.set(selfKey, (selfTotals.get(selfKey) ?? 0) + deltaMs);
    while (node) {
      const key = frameKey(node.callFrame);
      inclusiveTotals.set(key, (inclusiveTotals.get(key) ?? 0) + deltaMs);
      node = nodes.get(parents.get(node.id));
    }
  }
  return [...inclusiveTotals.entries()]
    .map(([frame, inclusiveMs]) => ({
      frame,
      inclusiveMs: Math.round(inclusiveMs * 10) / 10,
      selfMs: Math.round((selfTotals.get(frame) ?? 0) * 10) / 10
    }))
    .filter((entry) => !entry.frame.startsWith("(root)"))
    .sort((a, b) => b.inclusiveMs - a.inclusiveMs)
    .slice(0, 50);
}

function frameKey(frame) {
  return `${frame.functionName || "(anonymous)"} @ ${shortUrl(frame.url)}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
}

function shortUrl(url) {
  if (!url) return "native";
  const marker = "/assets/";
  const index = url.indexOf(marker);
  return index >= 0 ? url.slice(index + 1) : url;
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
