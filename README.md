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

The report defines each metric in plain language and includes a separate
[Ace Grid buffer study](./results/ace-grid-buffer-study.json). That study shows
how `rowBufferPx` and `columnBufferPx` change mounted DOM and scroll work
without presenting an aggressive zero-buffer setup as a universal default.
An additional [optimization candidate study](./results/ace-grid-optimization-candidate.json)
keeps measurements from unreleased Ace Grid code separate from the published
package ranking.

## Why this exists

Opinion articles are useful for discovering options, but engineering decisions need inspectable evidence. This repository makes the fixture, adapters, package lock, raw samples, and report public so readers can challenge or reproduce every number.

Contributions that improve fairness or add an independently maintained adapter are welcome. Performance claims without reproducible samples are not.
