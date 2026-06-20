# Limitations

This benchmark is intentionally narrow.

- It is not proof that one grid is universally faster.
- It measures one client-side React workload on one machine.
- It does not measure accessibility quality, keyboard completeness, documentation, support, feature depth, paid features, server-side data, or migration cost.
- Package architectures differ. TanStack Table is headless, while the other packages ship rendered grid UI. Its adapter necessarily includes benchmark-owned rendering code.
- Handsontable runs with its documented non-commercial/evaluation key. Production licensing differs from the MIT packages.
- The MUI and AG Grid entries use their community packages only.
- Initial readiness is an instrumented lifecycle boundary, not a Core Web Vital.
- Scroll settling is a browser scheduling proxy, not a complete measure of perceived smoothness.
- Bundle totals include shared React benchmark code because that code is required to run each fixture. They do not include CSS bytes.
- Feature configuration aims for a common scenario, not identical internal behavior.

If you cite a result, include the commit SHA, browser, hardware, package versions, fixture dimensions, and this limitations file.
