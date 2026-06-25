import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const result = JSON.parse(
  await readFile(resolve(root, "results/latest.json"), "utf8"),
);
const focusedComparison = JSON.parse(
  await readFile(resolve(root, "results/ace-ag-1.0.15.json"), "utf8"),
);
const interactionHealth = JSON.parse(
  await readFile(resolve(root, "results/interaction-health.json"), "utf8"),
);

const implementations = [
  ["ace-grid", "Ace Grid Core", "@ace-grid/core"],
  ["ag-grid", "AG Grid Community", "ag-grid-react"],
  ["mui", "MUI X Data Grid Community", "@mui/x-data-grid"],
  ["tanstack", "TanStack Table + Virtual", "@tanstack/react-table"],
  ["handsontable", "Handsontable", "handsontable"],
  ["react-data-grid", "React Data Grid", "react-data-grid"],
];
const compatibleImplementations = implementations.filter(
  ([id]) => result.comparability?.[id]?.runtimeComparable !== false,
);
const excludedImplementations = implementations.filter(
  ([id]) => result.comparability?.[id]?.runtimeComparable === false,
);

const fmt = (value) =>
  value == null || Number.isNaN(value)
    ? "n/a"
    : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });

const comparableIds = compatibleImplementations.map(([id]) => id);
const ranks = {
  gzip: rankValues(
    compatibleImplementations.map(([id]) => [id, result.bundles[id]?.gzipBytes]),
    "lower",
  ),
  ready: rankValues(
    comparableIds.map((id) => [id, result.runtime[id]?.readyMs?.median]),
    "lower",
  ),
  scroll: rankValues(
    comparableIds.map((id) => [id, result.runtime[id]?.scrollSettleMs?.median]),
    "lower",
  ),
  mounted: rankValues(
    comparableIds.map((id) => [id, result.runtime[id]?.mountedCells?.median]),
    "lower",
  ),
};

const tableRows = compatibleImplementations
  .map(([id, name, versionKey]) => {
    const bundle = result.bundles[id];
    const runtime = result.runtime[id];
    const version = result.versions[versionKey] ?? "see lockfile";
    const gzip = rankedMetricCell(
      fmt(bundle ? bundle.gzipBytes / 1024 : null),
      "KB",
      ranks.gzip.get(id),
    );

    return `<tr><th><a href="./demo.html?grid=${id}">${name}</a></th><td>${version}</td>${gzip}${rankedMetricCell(fmt(runtime?.readyMs.median), "ms", ranks.ready.get(id))}${rankedMetricCell(fmt(runtime?.scrollSettleMs.median), "ms", ranks.scroll.get(id))}${rankedMetricCell(fmt(runtime?.mountedCells.median), "", ranks.mounted.get(id))}</tr>`;
  })
  .join("\n");

const focusedRanks = Object.fromEntries(
  [
    ["readyMedian", "readyMs", "median"],
    ["readyP95", "readyMs", "p95"],
    ["scrollMedian", "scrollSettleMs", "median"],
    ["scrollP95", "scrollSettleMs", "p95"],
    ["mounted", "mountedCells", "median"],
  ].map(([rankKey, metric, statistic]) => [
    rankKey,
    rankValues(
      ["ace-grid", "ag-grid"].map((id) => [
        id,
        focusedComparison.summary[id][metric][statistic],
      ]),
      "lower",
    ),
  ]),
);
const focusedRows = [
  ["ace-grid", "Ace Grid Core"],
  ["ag-grid", "AG Grid Community"],
]
  .map(([id, name]) => {
    const sample = focusedComparison.summary[id];
    return `<tr><th>${name}</th>${rankedMetricCell(fmt(sample.readyMs.median), "ms", focusedRanks.readyMedian.get(id))}${rankedMetricCell(fmt(sample.readyMs.p95), "ms", focusedRanks.readyP95.get(id))}${rankedMetricCell(fmt(sample.scrollSettleMs.median), "ms", focusedRanks.scrollMedian.get(id))}${rankedMetricCell(fmt(sample.scrollSettleMs.p95), "ms", focusedRanks.scrollP95.get(id))}${rankedMetricCell(fmt(sample.mountedCells.median), "", focusedRanks.mounted.get(id))}</tr>`;
  })
  .join("\n");

const interactionComparableIds = comparableIds;
const interactionRanks = {
  heapReady: rankValues(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.afterReadyHeapBytes,
    ]),
    "lower",
  ),
  heapScroll: rankValues(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.afterScrollHeapBytes,
    ]),
    "lower",
  ),
  longTaskTotal: rankValues(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.longTaskTotalMs,
    ]),
    "lower",
  ),
  fps: rankValues(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.estimatedFps,
    ]),
    "higher",
  ),
  droppedFrames: rankValues(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.droppedFrameCount20ms,
    ]),
    "lower",
  ),
  heapDelta: rankValues(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.heapDeltaBytes,
    ]),
    "lower",
  ),
  worstLongTask: rankValues(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.worstLongTaskMs,
    ]),
    "lower",
  ),
  p95Frame: rankValues(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.p95FrameMs,
    ]),
    "lower",
  ),
  worstFrame: rankValues(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.worstFrameMs,
    ]),
    "lower",
  ),
};
const interactionRows = compatibleImplementations
  .map(([id, name]) => {
    const sample = interactionHealth.grids[id]?.median;
    if (!sample) return "";
    const cells = [
      rankedMetricCell(
        fmtBytes(sample.afterReadyHeapBytes),
        "",
        interactionRanks.heapReady.get(id),
      ),
      rankedMetricCell(
        fmtBytes(sample.afterScrollHeapBytes),
        "",
        interactionRanks.heapScroll.get(id),
      ),
      rankedMetricCell(
        fmt(sample.longTaskTotalMs),
        "ms",
        interactionRanks.longTaskTotal.get(id),
      ),
      rankedMetricCell(
        fmt(sample.estimatedFps),
        "FPS",
        interactionRanks.fps.get(id),
      ),
      rankedMetricCell(
        fmt(sample.droppedFrameCount20ms),
        "",
        interactionRanks.droppedFrames.get(id),
      ),
    ].join("");
    return `<tr><th>${name}</th>${cells}</tr>`;
  })
  .join("\n");
const interactionDetailRows = compatibleImplementations
  .map(([id, name]) => {
    const sample = interactionHealth.grids[id]?.median;
    if (!sample) return "";
    return `<tr><th>${name}</th>${rankedMetricCell(fmtBytes(sample.heapDeltaBytes), "", interactionRanks.heapDelta.get(id))}${rankedMetricCell(fmt(sample.worstLongTaskMs), "ms", interactionRanks.worstLongTask.get(id))}${rankedMetricCell(fmt(sample.p95FrameMs), "ms", interactionRanks.p95Frame.get(id))}${rankedMetricCell(fmt(sample.worstFrameMs), "ms", interactionRanks.worstFrame.get(id))}</tr>`;
  })
  .join("\n");

const scoreMetrics = [
  {
    key: "gzip",
    label: "JS gzip",
    direction: "lower",
    values: comparableIds.map((id) => [id, result.bundles[id]?.gzipBytes]),
  },
  {
    key: "ready",
    label: "Ready",
    direction: "lower",
    values: comparableIds.map((id) => [id, result.runtime[id]?.readyMs?.median]),
  },
  {
    key: "jumpScroll",
    label: "Jump scroll",
    direction: "lower",
    values: comparableIds.map((id) => [
      id,
      result.runtime[id]?.scrollSettleMs?.median,
    ]),
  },
  {
    key: "mounted",
    label: "Mounted cells",
    direction: "lower",
    values: comparableIds.map((id) => [
      id,
      result.runtime[id]?.mountedCells?.median,
    ]),
  },
  {
    key: "heapReady",
    label: "Heap ready",
    direction: "lower",
    values: comparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.afterReadyHeapBytes,
    ]),
  },
  {
    key: "heapScroll",
    label: "Heap after scroll",
    direction: "lower",
    values: comparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.afterScrollHeapBytes,
    ]),
  },
  {
    key: "longTasks",
    label: "Long tasks",
    direction: "lower",
    values: comparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.longTaskTotalMs,
    ]),
  },
  {
    key: "fps",
    label: "Estimated FPS",
    direction: "higher",
    values: comparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.estimatedFps,
    ]),
  },
  {
    key: "droppedFrames",
    label: "Dropped frames",
    direction: "lower",
    values: comparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.droppedFrameCount20ms,
    ]),
  },
  {
    key: "p95Frame",
    label: "p95 frame",
    direction: "lower",
    values: comparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.p95FrameMs,
    ]),
  },
];
const metricRankMaps = Object.fromEntries(
  scoreMetrics.map((metric) => [
    metric.key,
    rankValues(metric.values, metric.direction),
  ]),
);
const medalRows = comparableIds
  .map((id) => {
    const score = scoreMetrics.reduce(
      (total, metric) => total + (metricRankMaps[metric.key].get(id) ?? comparableIds.length),
      0,
    );
    const firstPlaces = scoreMetrics
      .filter((metric) => metricRankMaps[metric.key].get(id) === 1)
      .map((metric) => metric.label);
    const bestMetric = firstPlaces.length
      ? firstPlaces.slice(0, 3).join(", ")
      : bestRankLabel(id);
    return { id, score, firstPlaces, bestMetric };
  })
  .sort((a, b) => a.score - b.score);
const medalTableRows = medalRows
  .map((entry, index) => {
    const name = implementations.find(([id]) => id === entry.id)?.[1] ?? entry.id;
    const medal = index < 3 ? medalBadge(["gold", "silver", "bronze"][index]) : "";
    return `<tr><th>${medal}${name}</th><td>${index + 1}</td><td>${entry.score}</td><td>${entry.bestMetric}</td><td>${analysisFor(entry.id)}</td></tr>`;
  })
  .join("\n");

const focusedAce = focusedComparison.summary["ace-grid"];
const focusedAg = focusedComparison.summary["ag-grid"];
const readyLead = percentReduction(
  focusedAce.readyMs.median,
  focusedAg.readyMs.median,
);
const scrollLead = percentReduction(
  focusedAce.scrollSettleMs.median,
  focusedAg.scrollSettleMs.median,
);

const command = [
  "git clone https://github.com/Vitashev/react-data-grid-benchmark.git",
  "cd react-data-grid-benchmark",
  "npm ci",
  "npm run benchmark",
  "npm run benchmark:interaction",
  "npm run report",
].join("\n");

const excludedNotice = excludedImplementations.length
  ? `<div class="notice"><strong>Excluded from ranked tables:</strong> ${excludedImplementations.map(([id, name]) => `${name} (${escapeHtml(result.comparability?.[id]?.reason ?? "different measured surface")})`).join("; ")}. Excluded adapters remain available in the live fixtures and raw JSON.</div>`
  : "";

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>React Data Grid Benchmark: Reproducible Comparison</title>
<meta name="description" content="A reproducible React data grid benchmark comparing bundle size, initial render, virtual scrolling, and mounted DOM with raw results.">
<style>${styles()}</style></head><body><main>
<header><span class="eyebrow">Open benchmark · June 2026</span><h1>React data grid benchmark</h1><p class="lede">Compatible React data grids ranked with one deterministic 50,000-row continuous-scroll fixture. Published packages, raw samples, exclusions, and limitations are included.</p><div class="actions"><a class="primary" href="#results">View results</a><a href="https://github.com/Vitashev/react-data-grid-benchmark">Source and raw data</a></div></header>

<section class="setup" aria-label="Benchmark setup"><div><b>50,000</b><span>rows</span></div><div><b>20</b><span>columns</span></div><div><b>1,200 × 600</b><span>viewport</span></div><div><b>${result.protocol.runs}</b><span>measured runs</span></div></section>

<section id="results"><div class="section-heading"><div><span class="eyebrow">Measured output</span><h2>Compatible continuous-scroll results</h2></div><p>Gold, silver, and bronze mark the three best values in each compatible metric. Lower is better except estimated FPS.</p></div><div class="table-wrap"><table><caption>Production-build measurements on this machine</caption><thead><tr><th>Library</th><th>Version</th><th>JS gzip</th><th>Ready median</th><th>Scroll settle</th><th>Mounted cells</th></tr></thead><tbody>${tableRows}</tbody></table></div>${excludedNotice}<p class="environment">${escapeHtml(result.environment.cpu)} · ${result.protocol.browser} · generated ${new Date(result.generatedAt).toLocaleDateString("en-US", { dateStyle: "long" })}</p></section>

<section id="scorecard"><div class="section-heading"><div><span class="eyebrow">Scorecard</span><h2>Gold, silver, bronze</h2></div><p>Rank points across 10 compatible metrics. Lower score wins. Incompatible adapters are excluded from scoring instead of being mixed into the ranking.</p></div><div class="table-wrap"><table><caption>Overall medal ranking across compatible metrics</caption><thead><tr><th>Library</th><th>Rank</th><th>Score</th><th>Category wins or best rank</th><th>Analysis</th></tr></thead><tbody>${medalTableRows}</tbody></table></div></section>

<section aria-labelledby="metric-title"><div class="section-heading compact"><div><span class="eyebrow">Metric guide</span><h2 id="metric-title">What the numbers mean</h2></div></div><dl class="metric-grid"><div><dt>JS gzip</dt><dd>Reachable JavaScript after gzip. Lower means less code to download and parse. CSS is excluded.</dd></div><div><dt>Ready median</dt><dd>The middle of 10 runs from navigation until the adapter mounts and two animation frames pass. Lower is better.</dd></div><div><dt>Scroll settle</dt><dd>Time for one large vertical and horizontal scroll jump plus three animation frames. It is not an FPS score.</dd></div><div><dt>Mounted cells</dt><dd>Body cells in the DOM after the scroll. Fewer cells reduce DOM work, but very low overscan can expose blank edges.</dd></div></dl></section>

<section id="methodology"><div class="section-heading compact"><div><span class="eyebrow">Methodology</span><h2>Same fixture, repeatable protocol</h2></div></div><div class="method-grid"><article><h3>Shared fixture</h3><ul><li>50,000 deterministic rows and 20 fixed-width columns</li><li>36 px rows in a 1,200 × 600 px viewport</li><li>Two editable columns, sorting, filtering, and virtual scrolling</li><li>No network requests, grouping, images, or paid-only features</li></ul></article><article><h3>Measurement protocol</h3><ul><li>Production bundles in headless Chrome</li><li>Three warmups discarded, then 10 fresh browser contexts</li><li>The same vertical and horizontal scroll jump for compatible grids</li><li>Every raw sample committed with exact package versions</li></ul></article></div>${excludedNotice}</section>

<section id="ace-ag-verification"><div class="section-heading"><div><span class="eyebrow">Published-package verification</span><h2>Ace Grid 1.0.15 vs AG Grid</h2></div><p>Thirty alternating-order runs, five discarded warmups, and a fresh browser context for every sample.</p></div><div class="table-wrap"><table><caption>Focused 30-run comparison</caption><thead><tr><th>Library</th><th>Ready median</th><th>Ready p95</th><th>Scroll median</th><th>Scroll p95</th><th>Mounted cells</th></tr></thead><tbody>${focusedRows}</tbody></table></div><div class="result-note"><strong>On this machine:</strong> Ace Grid reached ready ${readyLead}% sooner, settled the scripted scroll ${scrollLead}% sooner, and mounted ${fmt(focusedAg.mountedCells.median - focusedAce.mountedCells.median)} fewer cells. <a href="https://github.com/Vitashev/react-data-grid-benchmark/blob/main/results/ace-ag-1.0.15.json">View all raw samples</a>.</div></section>

<section id="interaction-health"><div class="section-heading"><div><span class="eyebrow">Interaction health</span><h2>Memory, long tasks, and smoothness</h2></div><p>Five measured runs after one warmup. Each run performs a two-second continuous scroll in a fresh Chrome context.</p></div><div class="table-wrap"><table><caption>Continuous scroll interaction measurements</caption><thead><tr><th>Library</th><th>Heap ready</th><th>Heap after scroll</th><th>Long-task total</th><th>Estimated FPS</th><th>Dropped frames &gt;20ms</th></tr></thead><tbody>${interactionRows}</tbody></table></div><div class="table-wrap secondary-table"><table><caption>Additional interaction measurements</caption><thead><tr><th>Library</th><th>Heap delta</th><th>Worst long task</th><th>p95 frame</th><th>Worst frame</th></tr></thead><tbody>${interactionDetailRows}</tbody></table></div><p class="environment">${escapeHtml(interactionHealth.environment.cpu)} · ${interactionHealth.protocol.browser} · generated ${new Date(interactionHealth.generatedAt).toLocaleDateString("en-US", { dateStyle: "long" })} · <a href="https://github.com/Vitashev/react-data-grid-benchmark/blob/main/results/interaction-health.json">View raw samples</a></p></section>

<section id="analysis"><div class="section-heading compact"><div><span class="eyebrow">Analysis</span><h2>What the results show</h2></div></div><div class="analysis-grid"><article><h3>Fastest interactive path</h3><p>React Data Grid leads the overall scorecard because it combines the smallest runtime heap, no median long-task time, and near-120 FPS continuous scrolling.</p></article><article><h3>Ace Grid vs AG Grid</h3><p>Ace Grid remains ahead of AG Grid on ready median, jump-scroll settle, mounted cells, continuous-scroll FPS, and dropped frames. AG Grid currently uses less heap and posts lower long-task totals.</p></article><article><h3>Memory-sensitive apps</h3><p>Heap-ready and heap-after-scroll numbers favor React Data Grid, followed by AG Grid. Ace Grid's current row-adapter path trades more heap for fewer mounted cells and smoother continuous scrolling.</p></article><article><h3>Compatibility rule</h3><p>Libraries are ranked only when they expose the same continuous 50,000-row virtualized surface. Pagination-limited adapters stay in raw data, not the leaderboard.</p></article></div></section>

<section class="footer-grid"><article><span class="eyebrow">Limits</span><h2>Not a universal ranking</h2><p>Results depend on hardware, browser, configuration, enabled features, and application workload. This benchmark does not measure accessibility, support, feature depth, server data, or migration cost.</p><a href="https://github.com/Vitashev/react-data-grid-benchmark/blob/main/LIMITATIONS.md">Read limitations</a></article><article><span class="eyebrow">Reproduce</span><h2>Run it yourself</h2><pre><code>${command}</code></pre></article></section>
</main></body></html>`;

await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(resolve(root, "dist/index.html"), html);
await copyFile(
  resolve(root, "results/latest.json"),
  resolve(root, "dist/results.json"),
);
await copyFile(
  resolve(root, "results/ace-ag-1.0.15.json"),
  resolve(root, "dist/ace-ag-1.0.15.json"),
);
await copyFile(
  resolve(root, "results/interaction-health.json"),
  resolve(root, "dist/interaction-health.json"),
);

function rankValues(entries, direction) {
  const sorted = entries
    .filter(([, value]) => Number.isFinite(value))
    .sort((a, b) =>
      direction === "higher" ? b[1] - a[1] : a[1] - b[1],
    );
  const ranks = new Map();
  let previousValue;
  let previousRank = 0;
  sorted.forEach(([id, value], index) => {
    const rank = value === previousValue ? previousRank : index + 1;
    ranks.set(id, rank);
    previousValue = value;
    previousRank = rank;
  });
  return ranks;
}

function bestRankLabel(id) {
  let best = { rank: Infinity, labels: [] };
  for (const metric of scoreMetrics) {
    const rank = metricRankMaps[metric.key].get(id);
    if (!rank) continue;
    if (rank < best.rank) best = { rank, labels: [metric.label] };
    else if (rank === best.rank) best.labels.push(metric.label);
  }
  return best.labels.length
    ? `Best rank #${best.rank}: ${best.labels.slice(0, 3).join(", ")}`
    : "No comparable score";
}

function analysisFor(id) {
  const notes = {
    "ace-grid": "Strong on ready time, scroll settle, low DOM count, and smooth continuous scroll; memory is the main gap.",
    "ag-grid": "Balanced memory profile and low long-task cost, but continuous-scroll FPS trails the leaders.",
    tanstack: "Smooth continuous scrolling, but heap growth is high for this fixture.",
    handsontable: "Lowest mounted-cell count, but startup and long tasks are expensive here.",
    "react-data-grid": "Best overall in this fixture: smallest bundle, lowest heap, lowest long-task time, and top smoothness.",
  };
  return notes[id] ?? "";
}

function medalBadge(kind) {
  const labels = { gold: "Gold", silver: "Silver", bronze: "Bronze" };
  return `<span class="medal medal-${kind}">${labels[kind]}</span>`;
}

function rankedMetricCell(value, unit, rank) {
  const medal = rank <= 3 ? metricMedal(rank) : "";
  const className = rank <= 3 ? ` class="ranked ranked-${rank}"` : "";
  return `<td${className}>${medal}<span>${value}${unit ? ` ${unit}` : ""}</span></td>`;
}

function metricMedal(rank) {
  const names = { 1: "Gold", 2: "Silver", 3: "Bronze" };
  const classes = { 1: "gold", 2: "silver", 3: "bronze" };
  return `<span class="metric-medal metric-medal-${classes[rank]}" aria-label="${names[rank]} award" title="${names[rank]} award">${names[rank]}</span>`;
}

function percentReduction(value, baseline) {
  return fmt(((baseline - value) / baseline) * 100);
}

function fmtBytes(value) {
  return value == null || Number.isNaN(value)
    ? "n/a"
    : `${fmt(value / 1024 / 1024)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function styles() {
  return `:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f5f7fb}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0}main{max-width:1180px;margin:auto;padding:24px 24px 64px}header{padding:52px;border:1px solid #d9e1ed;border-radius:24px;background:#fff}h1{font-size:clamp(42px,6vw,68px);line-height:1;letter-spacing:-.05em;margin:12px 0 18px}h2{font-size:clamp(28px,3vw,38px);letter-spacing:-.035em;margin:7px 0 0}h3{margin:0 0 14px;font-size:18px}.eyebrow{color:#2864d7;text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:800}.lede{max-width:760px;margin:0;color:#55647a;font-size:20px;line-height:1.55}.actions{display:flex;gap:10px;margin-top:26px}.actions a,.footer-grid a,.environment a{color:#1e56b9;font-weight:750}.actions a{padding:11px 16px;border:1px solid #cbd6e6;border-radius:10px;text-decoration:none;background:#fff}.actions .primary{color:#fff;background:#2864d7;border-color:#2864d7}.setup{display:grid;grid-template-columns:repeat(4,1fr);margin:16px 0 0;border:1px solid #d9e1ed;border-radius:16px;background:#fff;overflow:hidden}.setup div{padding:17px 20px;border-right:1px solid #e3e8f0}.setup div:last-child{border:0}.setup b,.setup span{display:block}.setup b{font-size:22px}.setup span{margin-top:2px;color:#6a778b;font-size:13px}section:not(.setup){margin-top:56px}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:40px;margin-bottom:18px}.section-heading.compact{margin-bottom:16px}.section-heading p{max-width:520px;margin:0;color:#627087;line-height:1.55}.table-wrap{overflow:auto;border:1px solid #d9e1ed;border-radius:16px;background:#fff}.secondary-table{margin-top:14px}table{width:100%;min-width:900px;border-collapse:collapse}caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}th,td{padding:16px;border-bottom:1px solid #e4e9f1;text-align:left;white-space:nowrap}thead th{color:#68758a;font-size:12px;text-transform:uppercase;letter-spacing:.08em}tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}tbody th a{color:#1f59bd}.not-comparable{color:#6b7280;background:#fffaf2}.inline-note{display:inline-block;margin-left:7px;color:#7b4d17;font-size:12px;font-weight:700}.ranked{font-weight:750}.ranked-1{background:#fff8dc}.ranked-2{background:#f5f7fb}.ranked-3{background:#fff1e7}.metric-medal,.medal{display:inline-flex;align-items:center;height:24px;margin-right:9px;padding:0 9px;border:1px solid transparent;border-radius:999px;font-size:12px;font-weight:850;letter-spacing:.02em}.medal-gold,.metric-medal-gold{color:#5e3b00;background:#ffe8a3;border-color:#e1b842}.medal-silver,.metric-medal-silver{color:#3f4a5c;background:#edf1f6;border-color:#c9d2df}.medal-bronze,.metric-medal-bronze{color:#603414;background:#f6d0b5;border-color:#d69666}.environment{margin:10px 3px 0;color:#6a778b;font-size:13px}.metric-grid,.analysis-grid{display:grid;grid-template-columns:repeat(2,1fr);margin:0;border:1px solid #d9e1ed;border-radius:16px;background:#fff;overflow:hidden}.metric-grid div,.analysis-grid article{padding:22px;border-right:1px solid #e4e9f1;border-bottom:1px solid #e4e9f1}.metric-grid div:nth-child(2n),.analysis-grid article:nth-child(2n){border-right:0}.metric-grid div:nth-last-child(-n+2),.analysis-grid article:nth-last-child(-n+2){border-bottom:0}.metric-grid dt{font-size:17px;font-weight:800}.metric-grid dd,.analysis-grid p{margin:7px 0 0;color:#5d6a7e;line-height:1.55}.method-grid,.footer-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.method-grid article,.footer-grid article{padding:25px;border:1px solid #d9e1ed;border-radius:16px;background:#fff}.method-grid ul{margin:0;padding-left:20px;color:#56657a;line-height:1.75}.notice,.result-note{margin-top:14px;padding:17px 19px;border-radius:12px;background:#eaf1ff;color:#53637a;line-height:1.55}.notice{border-left:4px solid #2864d7}.result-note a{color:#1f59bd}.footer-grid p{color:#5d6a7e;line-height:1.6}.footer-grid pre{margin:14px 0 0;padding:17px;border-radius:10px;overflow:auto;background:#111a2b;color:#dce7f7;line-height:1.6;font-size:12px}@media(max-width:760px){main{padding:14px 14px 48px}header{padding:34px 24px}.setup,.metric-grid,.analysis-grid,.method-grid,.footer-grid{grid-template-columns:1fr 1fr}.section-heading{display:block}.section-heading p{margin-top:10px}.actions{flex-direction:column}.setup div:nth-child(2){border-right:0}.setup div:nth-child(-n+2){border-bottom:1px solid #e3e8f0}}@media(max-width:520px){.metric-grid,.analysis-grid,.method-grid,.footer-grid{grid-template-columns:1fr}.metric-grid div,.analysis-grid article{border-right:0}.metric-grid div:nth-last-child(2),.analysis-grid article:nth-last-child(2){border-bottom:1px solid #e4e9f1}}`;
}
