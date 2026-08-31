# Project: OBench

Open-source AI intelligence, benchmark, and token pricing workbench powered by Artificial Analysis telemetry.

## Structure
- `src/pages/index.astro`: Main page layout entrypoint (Header, TabModels, ModelDrawer, MobileNav, Toast).
- `src/components/Header.astro`: Top navigation bar with ⌘K search, Compare toggle pill, live sync button, and dynamic theme switcher.
- `src/components/TabModels.astro`: Model workbench (Creator filters; Table, Cards, Scatter Plots, SOTA Timeline, Compare matrix).
- `src/components/ModelDrawer.astro`: In-place desktop docked side panel & mobile slide-over sheet with workload cost simulator.
- `src/components/MobileNav.astro`: Floating bottom navigation pill with WCAG compliant touch targets (>= 38px).
- `src/components/Toast.astro`: Severity-aware reactive notification toasts (`info`, `success`, `warning`, `error`).
- `src/components/Icons.astro`: Centralized SVG sprite symbols repository (strict zero-emoji policy).
- `src/server/app.ts`: Universal Hono API server (`/api/health`, `/api/models`, `/api/test-aa`, `/api/sync`).
- `functions/[[route]].ts`: Cloudflare Pages Functions adapter wrapping Hono.
- `src/charts/echartsRender.ts`: Modular Apache ECharts SVG scatter plot with Pareto Frontier and SOTA timeline.
- `src/store/appStore.ts`: Alpine client workbench store with lazy-loaded chart boundary and reactive theme/filter state.
- `src/store/compare.ts`: Side-by-side model comparison matrix and metric delta winner computations.
- `src/store/inspector.ts`: Viewport-aware focus trapping, focus restoration, and body scroll lock management.
- `src/utils/pricing.ts`: Blended (3:1) and effective token pricing formulas with discount simulation.
- `src/utils/aaNormalize.ts`: Normalizer for Artificial Analysis full telemetry records.
- `src/utils/frontier.ts`: Pareto efficiency frontier and SOTA milestone advancement algorithms.
- `src/utils/formatters.ts`: Compact date, currency, and score formatters (distinguishing `Free` from `--`).
- `src/utils/providers.ts`: Provider colors and SVG symbol references (`#icon-provider-*`).
- `scripts/verify_ui.py`: Playwright multi-viewport UI verification & bundle size (< 700KB) assertion suite.
- `tests/`: Pure TypeScript `bun test` suites (`aaNormalize`, `charts`, `formatters`, `server`, `store`, `uiMarkup`).

## Architecture & Commands
- Dev server: `bun run dev` (starts local Astro dev server at `http://localhost:4321`).
- Production build: `bun run build` (compiles static bundle into `/dist`).
- Preview server: `bun x astro preview --port 4399 --host 127.0.0.1`
- Type-check: `bun x tsc --noEmit`
- Project diagnostic check: `bun run check`
- Dead code / unused exports: `bun x knip`
- Unit/Integration tests: `bun test` (runs 55+ tests across 6 suites).
- Browser UI Verification: `python3 scripts/verify_ui.py` (checks bundle size budget, viewport layouts, and a11y).
- Cloudflare Pages: API key `AA_API_KEY` configured in server environment variables.

## Non-obvious Discoveries
- Alpine re-evaluates getters on every binding read; cache expensive model filters and update via `$watch` on joined filter keys.
- `backdrop-filter` is expensive on mobile; limit to fixed sticky surfaces (`header`, `drawer`) and avoid on repeating table rows.
- Select elements need `appearance-none` and `.field-select` custom styling to prevent native browser focus ring double borders.
- Drawer open locks body scroll (`document.body.style.overflow = 'hidden'`) only for mobile viewports (< 1024px); desktop remains docked.
- ECharts is dynamically imported via modular subpaths (`echarts/core`, `echarts/charts`, `echarts/components`, `echarts/renderers`), reducing initial JS bundle from ~1.39MB to ~257KB.
- Modular ECharts subpaths should be declared in `vite.optimizeDeps.include` in `astro.config.mjs` to avoid runtime dynamic pre-bundling latency.
- Playwright tests against Astro preview servers should use `astro preview` with a dedicated port (e.g. 4399) to avoid colliding with active dev servers.
