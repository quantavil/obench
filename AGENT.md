# Project: OBench

AI intelligence + pricing workbench. AA benchmarks + live OpenRouter pricing.

## Structure
- `src/pages/index.astro`: layout (Header, TabModels, ModelDrawer, MobileNav)
- `src/components/*`: Header sync, TabModels explorer (table/cards/plot/timeline/compare), ModelDrawer + ModelDrawerBody partial simulator
- `src/server/app.ts`: Hono API `/api/health|models|test-aa|sync`
- `src/server/aaService.ts`: paginated AA fetch (`MAX_SYNC_PAGES 25`, `MAX_RECORDS 10000`)
- `src/utils/aaNormalize.ts`: normalize AA records, derives cache `0.25*input`, batch `0.5*input` when absent, keeps `null` for missing IQ
- `src/utils/syncMerge.ts`: shared sync merge preserving OR-only models and existing benchmarks on live sync
- `src/utils/pricing.ts`: `cachedInput`/`batchInput`/`calculateModelCost` (blended 3:1)
- `src/utils/frontier.ts`: `computeEfficiencyFrontier` filters `cost>0` (0/null → -- excluded), `computeSotaProgression`, `parseReleaseTs`
- `src/utils/formatters.ts`: `fmtCost(null→--,0→Free)`, `fmt1`, `fmtDate`, `fmtContext(null→--)`
- `src/store/appStore.ts`: Alpine store, SORT_COLUMN_MAP sort, `mountCurrentChart` lazy-loads ECharts
- `src/charts/echartsRender.ts`: modular ECharts SVG, base option factory, click-to-inspect, zoom reset
- `src/data/models.json`: 759 pretty-printed (611 AA + 148 OR-only, `intelligence:null` excluded from charts)
- `scripts/merge-openrouter.mjs`: live OR merge — slug `normLast`, suffix-strip, longest-contains match; enrich pricing/context/modalities, add OR-only, derive cache/batch fallback, filter negative pricing, sort IQ desc
- `scripts/verify_ui.py`: Playwright bundle `<700KB` + viewport checks
- `tests/`: bun test

## Commands
- `bun run dev` → http://localhost:4321
- `bun scripts/merge-openrouter.mjs [--dry-run]`
- `bun test` (60 tests), `bun run check`, `bun x tsc --noEmit`, `bun x knip`, `bun run build`, `python3 scripts/verify_ui.py`

## Blunders & Discoveries
- Blunder: Stale client `localStorage` overwrote bundled dataset with null context/maxOut; dev proxy missed `/api/models`. Fixed via `mergeSyncedModels(defaultModels, ...)` healing in `appStore.ts` and `/api/*` Vite proxy.
- Discovery: AA API provides 11 frontier benchmarks (HLE, GPQA, TAU-2, TerminalBench, LiveCodeBench, SciCode, MATH-500, AIME 2025, IFBench, LCR, MMLU-Pro) and TTFAT (`median_time_to_first_answer_token`). Surface in `ModelDrawerBody.astro`.
- Data: `src/data/models.json` has 780 models (630 with frontier evals, 771 with contextWindow, 766 with maxOutputTokens, 188 with TTFAT).

## Notes
- Sync preserves benchmarks & OR-only models: live `null` coding/math/reasoning/speed keeps previous value, models absent upstream are retained.
- Pricing: AA `-- (null)` + OR `0.01` → picks OR live; `0` Free excluded from frontier.
- Docs folder removed; source JSON stays pretty (2-space) for git diff, dist is minified/gzipped.
- Windsurf: User does not use Windsurf; if CBM installer errors on rule limits, ensure stale `~/.codeium` is deleted.
- Mobile UI: Cards spotlight hero IQ score block (`hero-iq-box`) and 4-column key specs (`Context`/`Max Out`/`Speed`/`TTFT`) without benchmark sub-score slop; inspector drawer uses bottom sheet modal with unique `role="dialog"`.
