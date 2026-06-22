# React Data Grid Benchmark

A reproducible React data grid comparison using one deterministic fixture, pinned package versions, production bundles, raw browser samples, and explicit limitations.

**Live report:** https://vitashev.github.io/react-data-grid-benchmark/

## Compared implementations

- Ace Grid Core
- AG Grid Community
- MUI X Data Grid community tier
- TanStack Table with TanStack Virtual
- Handsontable using its non-commercial/evaluation key
- React Data Grid

## Run it

```bash
npm ci
npm run benchmark
npm run report
npm run preview
```

Open `http://localhost:4173/react-data-grid-benchmark/` for the report or `http://localhost:4173/react-data-grid-benchmark/demo.html?grid=ace-grid` for a fixture.

Read [METHODOLOGY.md](./METHODOLOGY.md) and [LIMITATIONS.md](./LIMITATIONS.md) before interpreting or citing the output.

MUI X Community remains available as a live fixture and bundle measurement,
but its runtime values are excluded from the continuous-dataset comparison.
The community package forces pagination and caps each page at 100 rows, so its
scroll surface is not equivalent to the 50,000-row virtualized fixtures.

The report defines each metric in plain language and includes a separate
[Ace Grid buffer study](./results/ace-grid-buffer-study.json). That study shows
how `rowBufferPx` and `columnBufferPx` change mounted DOM and scroll work
without presenting an aggressive zero-buffer setup as a universal default.
The [published Ace Grid 1.0.15 versus AG Grid study](./results/ace-ag-1.0.15.json)
adds 30 alternating-order runs with fresh browser contexts. It records median,
p95, and every raw sample separately from the six-library orientation table.

## Why this exists

Opinion articles are useful for discovering options, but engineering decisions need inspectable evidence. This repository makes the fixture, adapters, package lock, raw samples, and report public so readers can challenge or reproduce every number.

Contributions that improve fairness or add an independently maintained adapter are welcome. Performance claims without reproducible samples are not.
