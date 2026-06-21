# Methodology

This repository compares implementation output, not marketing claims.

## Fixture

- 50,000 deterministic rows generated in the browser from committed code
- 20 columns with fixed 140 px widths
- 1,200 × 600 px grid viewport
- 36 px row height
- two editable text columns
- sorting and filtering enabled where the community package provides them
- vertical and horizontal virtual scrolling enabled where supported

The fixture deliberately avoids network requests, images, custom cell renderers, grouping, aggregation, and paid-only features.

## Measurements

`npm run benchmark` builds production assets and opens every adapter in headless Chrome.

1. Three warm-up runs are discarded.
2. Ten measured runs use a fresh browser context and page.
3. `readyMs` measures navigation start through two animation frames after the adapter mounts.
4. `scrollSettleMs` measures three animation frames after a programmatic vertical and horizontal scroll.
5. `mountedCells` counts mounted body cells after the benchmark scroll jump.
6. Bundle bytes include the shared benchmark runtime and the selected adapter's reachable JavaScript chunks. Gzip is computed with Node's default gzip settings.

Raw samples, medians, and p95 values are written to `results/latest.json`.

## Ace Grid buffer study

`results/ace-grid-buffer-study.json` records a separate configuration-sensitivity
study for Ace Grid. It uses the same fixture and protocol while changing only
`rowBufferPx` and `columnBufferPx`.

- Larger buffers keep more offscreen rows and columns mounted, which can reduce
  blank edges during fast or touch-driven scrolling.
- Smaller buffers reduce DOM work, but zero overscan is an aggressive benchmark
  setting rather than a general production recommendation.
- Buffer changes did not materially improve initial readiness in this fixture,
  so startup work must be investigated separately.

Infinite-scroll thresholds are not rendering overscan. They decide when an
application requests more data and do not directly reduce mounted DOM.

## Ace Grid optimization candidate

`results/ace-grid-optimization-candidate.json` records a separate run against
an unreleased local Ace Grid build. It is deliberately excluded from the main
ranking because `npm ci` cannot reproduce unpublished package code. The study
exists to prevent a small internal optimization from being presented as a
released-package performance claim.

## Reproduction

Use a quiet machine, record the hardware and Chrome version, and avoid comparing results produced on different environments.

```bash
npm ci
npm run benchmark
npm run report
```

The benchmark does not apply statistical significance tests. Treat small differences as noise unless repeated on multiple machines.
