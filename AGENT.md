# Project: OBench

Open-source AI intelligence, benchmark, and token pricing workbench powered by Artificial Analysis data.

## Structure
- `src/pages/index.astro`: Main page layout entrypoint (Header, TabModels, ModelDrawer, MobileNav, Toast).
- `src/components/Header.astro`: OBench top navigation bar with brand mark, ⌘K search bar, live sync button, and theme switcher.
- `src/components/TabModels.astro`: Pro model workbench (Creator filter chips with SVG logos, View switchers: Table, Cards, Scatter Plots, SOTA Timeline, Compare VS; Sortable table headers, Capability filter, Price brackets, Cost basis).
- `src/components/ModelDrawer.astro`: Slide-over model inspector sheet with full telemetry gauges (Speed TPS, TTFT, Context, Coding), Workload Cost Simulator presets, and 1-click copy.
- `src/server/app.ts`: Universal Hono API server (`/api/health`, `/api/models`, `/api/test-aa`, `/api/sync`).
- `functions/[[route]].ts`: Cloudflare Pages Functions adapter wrapping Hono.
- `src/types/model.ts`: Strict TypeScript interfaces for models, benchmarks, pricing, and configurations.
- `src/charts/echartsRender.ts`: Apache ECharts interactive vector SVG scatter plot with Pareto Frontier and SOTA timeline.
- `src/utils/aaNormalize.ts`: Normalizer for Artificial Analysis full telemetry data.
- `src/utils/frontier.ts`: Pareto efficiency frontier and SOTA milestone calculations.
- `src/utils/formatters.ts`: Formats costs, dates, numbers.
- `src/utils/providers.ts`: SVG brandmarks and color lookups for Anthropic, OpenAI, Google Gemini, Meta, DeepSeek, Mistral, xAI, Qwen, etc.
- `scripts/verify_ui.py`: Playwright automated UI verification and multi-viewport screenshot capture suite.
- `tests/`: Pure TypeScript `bun test` suites (`aaNormalize`, `charts`, `formatters`, `server`, `store`).

## Architecture & Commands
- Dev server: `bun run dev` (starts local Astro dev server at `http://localhost:4321`).
- Build command: `bun run build` (compiles production bundle into `/dist`).
- Type-check: `bun x tsc --noEmit`
- Dead code / unused exports: `bun x knip`
- Tests: `bun test` (runs all unit and integration tests).
- UI Verification & Screenshots: `python3 scripts/verify_ui.py`
- Cloudflare Pages: API key `AA_API_KEY` configured in server environment variables.

## Non-obvious Discoveries
- Alpine re-evaluates getters on every binding read; cache expensive model filters and update via `$watch` on a joined `modelFilterKey`.
- `backdrop-filter` is expensive on mobile; limit to fixed sticky surfaces (`header`, `drawer`) and avoid on repeating table rows.
- Select elements need `appearance-none` and `.field-select` custom styling to prevent native browser focus ring double borders.
- Drawer open locks body scroll (`document.body.style.overflow = 'hidden'`) to prevent background scrolling on touch devices.
- Playwright tests against Astro/Vite dev servers must wait on `domcontentloaded` + selector rather than `networkidle` due to persistent Vite HMR WebSockets.
