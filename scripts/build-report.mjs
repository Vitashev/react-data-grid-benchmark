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

const fmt = (value) =>
  value == null || Number.isNaN(value)
    ? "n/a"
    : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });

const comparableIds = implementations
  .filter(([id]) => result.comparability?.[id]?.runtimeComparable !== false)
  .map(([id]) => id);
const winners = {
  gzip: lowestIds(
    implementations.map(([id]) => [id, result.bundles[id]?.gzipBytes]),
  ),
  ready: lowestIds(
    comparableIds.map((id) => [id, result.runtime[id]?.readyMs?.median]),
  ),
  scroll: lowestIds(
    comparableIds.map((id) => [id, result.runtime[id]?.scrollSettleMs?.median]),
  ),
  mounted: lowestIds(
    comparableIds.map((id) => [id, result.runtime[id]?.mountedCells?.median]),
  ),
};

const tableRows = implementations
  .map(([id, name, versionKey]) => {
    const bundle = result.bundles[id];
    const runtime = result.runtime[id];
    const comparable = result.comparability?.[id]?.runtimeComparable !== false;
    const version = result.versions[versionKey] ?? "see lockfile";
    const gzip = metricCell(
      fmt(bundle ? bundle.gzipBytes / 1024 : null),
      "KB",
      winners.gzip.has(id),
    );

    if (!comparable) {
      return `<tr class="not-comparable"><th><a href="./demo.html?grid=${id}">${name}</a></th><td>${version}</td>${gzip}<td colspan="3"><strong>Not comparable:</strong> Community tier uses 100-row pagination.</td></tr>`;
    }

    return `<tr><th><a href="./demo.html?grid=${id}">${name}</a></th><td>${version}</td>${gzip}${metricCell(fmt(runtime?.readyMs.median), "ms", winners.ready.has(id))}${metricCell(fmt(runtime?.scrollSettleMs.median), "ms", winners.scroll.has(id))}${metricCell(fmt(runtime?.mountedCells.median), "", winners.mounted.has(id))}</tr>`;
  })
  .join("\n");

const focusedWinners = Object.fromEntries(
  [
    ["readyMedian", "readyMs", "median"],
    ["readyP95", "readyMs", "p95"],
    ["scrollMedian", "scrollSettleMs", "median"],
    ["scrollP95", "scrollSettleMs", "p95"],
    ["mounted", "mountedCells", "median"],
  ].map(([winnerKey, metric, statistic]) => [
    winnerKey,
    lowestIds(
      ["ace-grid", "ag-grid"].map((id) => [
        id,
        focusedComparison.summary[id][metric][statistic],
      ]),
    ),
  ]),
);
const focusedRows = [
  ["ace-grid", "Ace Grid Core"],
  ["ag-grid", "AG Grid Community"],
]
  .map(([id, name]) => {
    const sample = focusedComparison.summary[id];
    return `<tr><th>${name}</th>${metricCell(fmt(sample.readyMs.median), "ms", focusedWinners.readyMedian.has(id))}${metricCell(fmt(sample.readyMs.p95), "ms", focusedWinners.readyP95.has(id))}${metricCell(fmt(sample.scrollSettleMs.median), "ms", focusedWinners.scrollMedian.has(id))}${metricCell(fmt(sample.scrollSettleMs.p95), "ms", focusedWinners.scrollP95.has(id))}${metricCell(fmt(sample.mountedCells.median), "", focusedWinners.mounted.has(id))}</tr>`;
  })
  .join("\n");

const interactionComparableIds = implementations
  .filter(([id]) => result.comparability?.[id]?.runtimeComparable !== false)
  .map(([id]) => id);
const interactionWinners = {
  heapReady: lowestIds(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.afterReadyHeapBytes,
    ]),
  ),
  heapScroll: lowestIds(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.afterScrollHeapBytes,
    ]),
  ),
  longTaskTotal: lowestIds(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.longTaskTotalMs,
    ]),
  ),
  fps: highestIds(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.estimatedFps,
    ]),
  ),
  droppedFrames: lowestIds(
    interactionComparableIds.map((id) => [
      id,
      interactionHealth.grids[id]?.median?.droppedFrameCount20ms,
    ]),
  ),
};
const interactionRows = implementations
  .map(([id, name]) => {
    const sample = interactionHealth.grids[id]?.median;
    const comparable = result.comparability?.[id]?.runtimeComparable !== false;
    if (!sample) return "";
    const cells = [
      metricCell(
        fmtBytes(sample.afterReadyHeapBytes),
        "",
        comparable && interactionWinners.heapReady.has(id),
      ),
      metricCell(
        fmtBytes(sample.afterScrollHeapBytes),
        "",
        comparable && interactionWinners.heapScroll.has(id),
      ),
      metricCell(
        fmt(sample.longTaskTotalMs),
        "ms",
        comparable && interactionWinners.longTaskTotal.has(id),
      ),
      metricCell(
        fmt(sample.estimatedFps),
        "FPS",
        comparable && interactionWinners.fps.has(id),
      ),
      metricCell(
        fmt(sample.droppedFrameCount20ms),
        "",
        comparable && interactionWinners.droppedFrames.has(id),
      ),
    ].join("");
    const note = comparable
      ? ""
      : ' <span class="inline-note">pagination-limited</span>';
    return `<tr${comparable ? "" : ' class="not-comparable"'}><th>${name}${note}</th>${cells}</tr>`;
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
  "npm run report",
].join("\n");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>React Data Grid Benchmark: Reproducible Comparison</title>
<meta name="description" content="A reproducible React data grid benchmark comparing bundle size, initial render, virtual scrolling, and mounted DOM with raw results.">
<style>${styles()}</style></head><body><main>
<header><span class="eyebrow">Open benchmark · June 2026</span><h1>React data grid benchmark</h1><p class="lede">Six libraries tested with one deterministic 50,000-row fixture. Published packages, raw samples, and limitations are included.</p><div class="actions"><a class="primary" href="#results">View results</a><a href="https://github.com/Vitashev/react-data-grid-benchmark">Source and raw data</a></div></header>

<section class="setup" aria-label="Benchmark setup"><div><b>50,000</b><span>rows</span></div><div><b>20</b><span>columns</span></div><div><b>1,200 × 600</b><span>viewport</span></div><div><b>${result.protocol.runs}</b><span>measured runs</span></div></section>

<section id="results"><div class="section-heading"><div><span class="eyebrow">Measured output</span><h2>Continuous dataset</h2></div><p><span class="crown" aria-hidden="true">♛</span> marks the lowest measured value in each comparable category.</p></div><div class="table-wrap"><table><caption>Production-build measurements on this machine</caption><thead><tr><th>Library</th><th>Version</th><th>JS gzip</th><th>Ready median</th><th>Scroll settle</th><th>Mounted cells</th></tr></thead><tbody>${tableRows}</tbody></table></div><p class="environment">${escapeHtml(result.environment.cpu)} · ${result.protocol.browser} · generated ${new Date(result.generatedAt).toLocaleDateString("en-US", { dateStyle: "long" })}</p></section>

<section aria-labelledby="metric-title"><div class="section-heading compact"><div><span class="eyebrow">Metric guide</span><h2 id="metric-title">What the numbers mean</h2></div></div><dl class="metric-grid"><div><dt>JS gzip</dt><dd>Reachable JavaScript after gzip. Lower means less code to download and parse. CSS is excluded.</dd></div><div><dt>Ready median</dt><dd>The middle of 10 runs from navigation until the adapter mounts and two animation frames pass. Lower is better.</dd></div><div><dt>Scroll settle</dt><dd>Time for one large vertical and horizontal scroll jump plus three animation frames. It is not an FPS score.</dd></div><div><dt>Mounted cells</dt><dd>Body cells in the DOM after the scroll. Fewer cells reduce DOM work, but very low overscan can expose blank edges.</dd></div></dl></section>

<section id="methodology"><div class="section-heading compact"><div><span class="eyebrow">Methodology</span><h2>Same fixture, repeatable protocol</h2></div></div><div class="method-grid"><article><h3>Shared fixture</h3><ul><li>50,000 deterministic rows and 20 fixed-width columns</li><li>36 px rows in a 1,200 × 600 px viewport</li><li>Two editable columns, sorting, filtering, and virtual scrolling</li><li>No network requests, grouping, images, or paid-only features</li></ul></article><article><h3>Measurement protocol</h3><ul><li>Production bundles in headless Chrome</li><li>Three warmups discarded, then 10 fresh browser contexts</li><li>The same vertical and horizontal scroll jump for comparable grids</li><li>Every raw sample committed with exact package versions</li></ul></article></div><div class="notice"><strong>MUI X Community is excluded from runtime ranking.</strong> Its 100-row pagination creates a different scroll surface. Bundle size and the live fixture remain available.</div></section>

<section id="ace-ag-verification"><div class="section-heading"><div><span class="eyebrow">Published-package verification</span><h2>Ace Grid 1.0.15 vs AG Grid</h2></div><p>Thirty alternating-order runs, five discarded warmups, and a fresh browser context for every sample.</p></div><div class="table-wrap"><table><caption>Focused 30-run comparison</caption><thead><tr><th>Library</th><th>Ready median</th><th>Ready p95</th><th>Scroll median</th><th>Scroll p95</th><th>Mounted cells</th></tr></thead><tbody>${focusedRows}</tbody></table></div><div class="result-note"><strong>On this machine:</strong> Ace Grid reached ready ${readyLead}% sooner, settled the scripted scroll ${scrollLead}% sooner, and mounted ${fmt(focusedAg.mountedCells.median - focusedAce.mountedCells.median)} fewer cells. <a href="https://github.com/Vitashev/react-data-grid-benchmark/blob/main/results/ace-ag-1.0.15.json">View all raw samples</a>.</div></section>

<section id="interaction-health"><div class="section-heading"><div><span class="eyebrow">Interaction health</span><h2>Memory, long tasks, and smoothness</h2></div><p>Five measured runs after one warmup. Each run performs a two-second continuous scroll in a fresh Chrome context.</p></div><div class="table-wrap"><table><caption>Continuous scroll interaction measurements</caption><thead><tr><th>Library</th><th>Heap ready</th><th>Heap after scroll</th><th>Long-task total</th><th>Estimated FPS</th><th>Dropped frames &gt;20ms</th></tr></thead><tbody>${interactionRows}</tbody></table></div><p class="environment">${escapeHtml(interactionHealth.environment.cpu)} · ${interactionHealth.protocol.browser} · generated ${new Date(interactionHealth.generatedAt).toLocaleDateString("en-US", { dateStyle: "long" })} · <a href="https://github.com/Vitashev/react-data-grid-benchmark/blob/main/results/interaction-health.json">View raw samples</a></p></section>

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

function lowestIds(entries) {
  const numeric = entries.filter(([, value]) => Number.isFinite(value));
  const lowest = Math.min(...numeric.map(([, value]) => value));
  return new Set(
    numeric.filter(([, value]) => value === lowest).map(([id]) => id),
  );
}

function highestIds(entries) {
  const numeric = entries.filter(([, value]) => Number.isFinite(value));
  const highest = Math.max(...numeric.map(([, value]) => value));
  return new Set(
    numeric.filter(([, value]) => value === highest).map(([id]) => id),
  );
}

function metricCell(value, unit, winner) {
  const crown = winner
    ? '<span class="crown" role="img" aria-label="Lowest measured value" title="Lowest measured value">♛</span>'
    : "";
  return `<td${winner ? ' class="winner"' : ""}>${crown}<span>${value}${unit ? ` ${unit}` : ""}</span></td>`;
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
  return `:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f5f7fb}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0}main{max-width:1180px;margin:auto;padding:24px 24px 64px}header{padding:52px;border:1px solid #d9e1ed;border-radius:24px;background:#fff}h1{font-size:clamp(42px,6vw,68px);line-height:1;letter-spacing:-.05em;margin:12px 0 18px}h2{font-size:clamp(28px,3vw,38px);letter-spacing:-.035em;margin:7px 0 0}h3{margin:0 0 14px;font-size:18px}.eyebrow{color:#2864d7;text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:800}.lede{max-width:720px;margin:0;color:#55647a;font-size:20px;line-height:1.55}.actions{display:flex;gap:10px;margin-top:26px}.actions a,.footer-grid a,.environment a{color:#1e56b9;font-weight:750}.actions a{padding:11px 16px;border:1px solid #cbd6e6;border-radius:10px;text-decoration:none;background:#fff}.actions .primary{color:#fff;background:#2864d7;border-color:#2864d7}.setup{display:grid;grid-template-columns:repeat(4,1fr);margin:16px 0 0;border:1px solid #d9e1ed;border-radius:16px;background:#fff;overflow:hidden}.setup div{padding:17px 20px;border-right:1px solid #e3e8f0}.setup div:last-child{border:0}.setup b,.setup span{display:block}.setup b{font-size:22px}.setup span{margin-top:2px;color:#6a778b;font-size:13px}section:not(.setup){margin-top:56px}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:40px;margin-bottom:18px}.section-heading.compact{margin-bottom:16px}.section-heading p{max-width:480px;margin:0;color:#627087;line-height:1.55}.table-wrap{overflow:auto;border:1px solid #d9e1ed;border-radius:16px;background:#fff}table{width:100%;min-width:900px;border-collapse:collapse}caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}th,td{padding:16px;border-bottom:1px solid #e4e9f1;text-align:left;white-space:nowrap}thead th{color:#68758a;font-size:12px;text-transform:uppercase;letter-spacing:.08em}tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}tbody th a{color:#1f59bd}.not-comparable td[colspan]{color:#7b4d17;background:#fff8eb}.inline-note{display:inline-block;margin-left:7px;color:#7b4d17;font-size:12px;font-weight:700}.winner{background:#f6f9ff;font-weight:750}.winner>span:last-child{color:#163f8f}.crown{display:inline-grid;place-items:center;margin-right:7px;color:#d99b16;font-size:18px;line-height:1;vertical-align:-1px}.environment{margin:10px 3px 0;color:#6a778b;font-size:13px}.metric-grid{display:grid;grid-template-columns:repeat(2,1fr);margin:0;border:1px solid #d9e1ed;border-radius:16px;background:#fff;overflow:hidden}.metric-grid div{padding:22px;border-right:1px solid #e4e9f1;border-bottom:1px solid #e4e9f1}.metric-grid div:nth-child(2n){border-right:0}.metric-grid div:nth-last-child(-n+2){border-bottom:0}.metric-grid dt{font-size:17px;font-weight:800}.metric-grid dd{margin:7px 0 0;color:#5d6a7e;line-height:1.55}.method-grid,.footer-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.method-grid article,.footer-grid article{padding:25px;border:1px solid #d9e1ed;border-radius:16px;background:#fff}.method-grid ul{margin:0;padding-left:20px;color:#56657a;line-height:1.75}.notice,.result-note{margin-top:14px;padding:17px 19px;border-radius:12px;background:#eaf1ff;color:#53637a;line-height:1.55}.notice{border-left:4px solid #2864d7}.result-note a{color:#1f59bd}.footer-grid p{color:#5d6a7e;line-height:1.6}.footer-grid pre{margin:14px 0 0;padding:17px;border-radius:10px;overflow:auto;background:#111a2b;color:#dce7f7;line-height:1.6;font-size:12px}@media(max-width:760px){main{padding:14px 14px 48px}header{padding:34px 24px}.setup,.metric-grid,.method-grid,.footer-grid{grid-template-columns:1fr 1fr}.section-heading{display:block}.section-heading p{margin-top:10px}.actions{flex-direction:column}.setup div:nth-child(2){border-right:0}.setup div:nth-child(-n+2){border-bottom:1px solid #e3e8f0}}@media(max-width:520px){.metric-grid,.method-grid,.footer-grid{grid-template-columns:1fr}.metric-grid div{border-right:0}.metric-grid div:nth-last-child(2){border-bottom:1px solid #e4e9f1}}`;
}
