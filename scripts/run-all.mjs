import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ids = ["ace-grid", "ag-grid", "mui", "tanstack", "handsontable", "react-data-grid"];

if (!process.env.BENCH_MERGE_ONLY) {
  for (const id of ids) {
    await run(process.execPath, [resolve(root, "scripts/measure.mjs")], {
      ...process.env,
      BENCH_GRID: id
    });
  }
}

const partials = await Promise.all(ids.map(async (id) => JSON.parse(await readFile(resolve(root, `results/partials/${id}.json`), "utf8"))));
const result = {
  ...partials[0],
  generatedAt: new Date().toISOString(),
  versions: Object.assign({}, ...partials.map((partial) => partial.versions)),
  comparability: Object.assign({}, ...partials.map((partial) => partial.comparability)),
  bundles: Object.assign({}, ...partials.map((partial) => partial.bundles)),
  runtime: Object.assign({}, ...partials.map((partial) => partial.runtime))
};
await writeFile(resolve(root, "results/latest.local.json"), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(resolve(root, "results/latest.json"), `${JSON.stringify(result, null, 2)}\n`);

function run(command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => code === 0 ? resolveRun() : rejectRun(new Error(`Benchmark child exited with ${code ?? signal}`)));
  });
}
