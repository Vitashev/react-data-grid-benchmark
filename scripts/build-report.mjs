import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const result = JSON.parse(await readFile(resolve(root, "results/latest.json"), "utf8"));
const names = { "ace-grid": "Ace Grid Core", "ag-grid": "AG Grid Community", mui: "MUI X Data Grid", tanstack: "TanStack Table + Virtual", handsontable: "Handsontable", "react-data-grid": "React Data Grid" };
const versionKeys = { "ace-grid": "@ace-grid/core", "ag-grid": "ag-grid-react", mui: "@mui/x-data-grid", tanstack: "@tanstack/react-table", handsontable: "handsontable", "react-data-grid": "react-data-grid" };
const fmt = (value) => value == null || Number.isNaN(value) ? "n/a" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
const tableRows = Object.entries(names).map(([id, name]) => {
  const bundle = result.bundles[id];
  const runtime = result.runtime[id];
  return `<tr><th><a href="./demo.html?grid=${id}">${name}</a></th><td>${result.versions[versionKeys[id]] ?? "see lockfile"}</td><td>${fmt(bundle ? bundle.gzipBytes / 1024 : null)} KB</td><td>${fmt(runtime?.readyMs.median)} ms</td><td>${fmt(runtime?.scrollSettleMs.median)} ms</td><td>${fmt(runtime?.mountedCells.median)}</td></tr>`;
}).join("\n");

const command = [
  "git clone https://github.com/Vitashev/react-data-grid-benchmark.git",
  "cd react-data-grid-benchmark",
  "npm ci",
  "npm run benchmark",
  "npm run report"
].join("\n");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>React Data Grid Benchmark: Reproducible Comparison</title>
<meta name="description" content="A reproducible React data grid benchmark comparing bundle size, initial render, virtual scrolling, and mounted DOM with raw results.">
<style>${styles()}</style></head><body><main>
<header><span class="eyebrow">Open benchmark · June 2026</span><h1>React data grids, tested in the same room.</h1><p class="lede">Six implementations. One deterministic 50,000 × 20 fixture. Raw samples, pinned versions, source code, and limitations included.</p><div class="actions"><a class="primary" href="https://github.com/Vitashev/react-data-grid-benchmark">Inspect the repository</a><a href="#results">See results</a></div></header>
<section class="contract"><div><b>50,000</b><span>rows</span></div><div><b>20</b><span>columns</span></div><div><b>1,200 × 600</b><span>viewport</span></div><div><b>${result.protocol.runs}</b><span>measured runs</span></div></section>
<section id="results"><div class="section-heading"><div><span class="eyebrow">Measured output</span><h2>Results on this machine</h2></div><p>Medians are useful for orientation, not universal rankings. Runtime depends on browser, hardware, configuration, and product workload.</p></div><div class="table-wrap"><table><thead><tr><th>Implementation</th><th>Version</th><th>JS gzip</th><th>Ready median</th><th>Scroll settle</th><th>Mounted cells</th></tr></thead><tbody>${tableRows}</tbody></table></div><p class="environment">${escapeHtml(result.environment.cpu)} · ${result.protocol.browser} · generated ${new Date(result.generatedAt).toLocaleDateString("en-US", { dateStyle: "long" })}</p></section>
<section class="notes"><article><span class="eyebrow">What this tests</span><h2>A controlled engineering fixture</h2><p>Every adapter receives the same generated rows, column count, viewport, row height, two editable columns, sorting, filtering, and virtual scrolling target. Each implementation remains available as a live fixture.</p></article><article><span class="eyebrow">What this does not prove</span><h2>No universal “fastest grid” claim</h2><p>This does not measure your application, server data model, feature depth, accessibility, support, or total migration cost. Read <a href="https://github.com/Vitashev/react-data-grid-benchmark/blob/main/LIMITATIONS.md">the limitations</a> before citing a number.</p></article></section>
<section class="method"><h2>Reproduce it</h2><pre><code>${command}</code></pre><p>Committed results include every raw sample. The lockfile preserves exact transitive dependencies.</p></section>
</main></body></html>`;

await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(resolve(root, "dist/index.html"), html);
await copyFile(resolve(root, "results/latest.json"), resolve(root, "dist/results.json"));

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function styles() {
  return `:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f4f7fb}*{box-sizing:border-box}body{margin:0}main{max-width:1180px;margin:auto;padding:32px 24px 72px}header{padding:72px 64px;border:1px solid #d8e0ed;border-radius:28px;background:linear-gradient(135deg,#fff 0%,#edf4ff 100%)}.eyebrow{color:#2762db;text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:800}h1{font-size:clamp(44px,7vw,82px);line-height:.96;letter-spacing:-.055em;max-width:920px;margin:18px 0 24px}h2{font-size:32px;letter-spacing:-.035em;margin:8px 0 12px}.lede{font-size:21px;line-height:1.55;color:#526074;max-width:760px}.actions{display:flex;gap:12px;margin-top:30px}.actions a{padding:13px 18px;border:1px solid #c9d4e5;border-radius:12px;color:#17305c;text-decoration:none;font-weight:700;background:#fff}.actions .primary{background:#2866dd;color:#fff;border-color:#2866dd}.contract{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin:24px 0;background:#d8e0ed;border:1px solid #d8e0ed;border-radius:18px;overflow:hidden}.contract div{padding:22px;background:#fff}.contract b,.contract span{display:block}.contract b{font-size:26px}.contract span{color:#6a7688;font-size:13px;margin-top:4px}section:not(.contract){margin-top:72px}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:40px}.section-heading p{max-width:480px;color:#627087;line-height:1.6}.table-wrap{overflow:auto;border:1px solid #d8e0ed;border-radius:18px;background:#fff}table{border-collapse:collapse;width:100%;min-width:900px}th,td{text-align:left;padding:17px 18px;border-bottom:1px solid #e4e9f1}thead th{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#68758a}tbody th a{color:#1e57bc}.environment{font-size:13px;color:#6a7688}.notes{display:grid;grid-template-columns:1fr 1fr;gap:20px}.notes article,.method{padding:32px;border:1px solid #d8e0ed;border-radius:20px;background:#fff}.notes p,.method p{color:#5c697d;line-height:1.65}.notes a{color:#205cc8}.method pre{padding:20px;border-radius:12px;overflow:auto;background:#101827;color:#dce7f7;line-height:1.7}@media(max-width:760px){main{padding:16px}header{padding:42px 24px}.contract{grid-template-columns:1fr 1fr}.notes{grid-template-columns:1fr}.section-heading{display:block}.actions{flex-direction:column}}`;
}
