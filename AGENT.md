# Project: OBench

AI intelligence + pricing workbench. AA benchmarks + live OpenRouter pricing.

## Structure
- `src/pages/index.astro`: layout (Header, TabModels, ModelDrawer, MobileNav)
- `src/components/*`: Header sync, TabModels explorer (table/cards/plot/timeline/compare), ModelDrawer simulator
- `src/server/app.ts`: Hono API `/api/health|models|test-aa|sync`
- `src/server/aaService.ts`: paginated AA fetch (`MAX_SYNC_PAGES 25`, `MAX_RECORDS 10000`)
- `src/utils/aaNormalize.ts`: normalize AA records, derives cache `0.25*input`, batch `0.5*input` when absent, keeps `null` for missing IQ
- `src/utils/pricing.ts`: `cachedInput`/`batchInput`/`calculateModelCost` (blended 3:1)
- `src/utils/frontier.ts`: `computeEfficiencyFrontier` filters `cost>0` (0/null → -- excluded), `computeSotaProgression`
- `src/utils/formatters.ts`: `fmtCost(null→--,0→Free)`, `fmt1`, `fmtDate`
- `src/store/appStore.ts`: Alpine store, `syncModels` merges prev benchmarks when live returns null, `mountCurrentChart` lazy-loads ECharts
- `src/charts/echartsRender.ts`: modular ECharts SVG, log cost axis, frontier dashed
- `src/data/models.json`: 759 pretty-printed (611 AA + 148 OR-only, `intelligence:null` excluded from charts)
- `scripts/merge-openrouter.mjs`: live OR merge — slug `normLast`, suffix-strip, longest-contains match; enrich pricing/context/modalities, add OR-only, derive cache/batch fallback, filter negative pricing, sort IQ desc
- `scripts/verify_ui.py`: Playwright bundle `<700KB` + viewport checks
- `tests/`: bun test

## Commands
- `bun run dev` → http://localhost:4321
- `bun scripts/merge-openrouter.mjs [--dry-run]`
- `bun test` (55 tests), `bun run check`, `bun x tsc --noEmit`, `bun x knip`, `bun run build`, `python3 scripts/verify_ui.py`

## Notes
- Sync preserves benchmarks: live `null` coding/math/reasoning/speed keeps previous value.
- Pricing: AA `-- (null)` + OR `0.01` → picks OR live; `0` Free excluded from frontier.
- Docs folder removed; source JSON stays pretty (2-space) for git diff, dist is minified/gzipped.
