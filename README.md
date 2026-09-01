# OBench

Open-source intelligence and token pricing workbench for AI language models. Benchmark telemetry from **Artificial Analysis**, live pricing/context from **OpenRouter**.

Built with TypeScript, Astro, Hono, Tailwind CSS v4, Alpine.js, and Apache ECharts.

---

## Features

- **Neutral Precision Workbench**: neutral palette with restrained accent `#c8ff00` (lime), dense data display for engineers.
- **759 Models**: 611 AA benchmarked + 148 OpenRouter-only (pricing/context only, `intelligence:null` excluded from charts).
- **Live Pricing Merge**: `scripts/merge-openrouter.mjs` fetches `GET https://openrouter.ai/api/v1/models`, converts per-token `*1e6` pricing, enriches AA cache/batch/context/modalities. AA `--` + OR `0.01` → picks OR; `0` (`Free`) and `null` (`--`) both excluded from IQ vs Cost frontier (`frontier.ts:18` `cost>0`).
- **Benchmark Preservation**: `AA sync` (`/api/sync`) merges live AA but keeps previous `coding/math/reasoning/speed` when live returns `null` (`appStore.ts:803`).
- **Pricing Fallbacks**: cache `0.25×input`, batch `0.5×input` when absent (matches `pricing.ts:3`), so table never shows `--` when derivable.
- **Charts**: lazy-loaded ECharts SVG scatter (IQ vs Cost with Pareto frontier, IQ vs Speed, TTFT vs Speed) and SOTA timeline staircase, `~317K` initial JS.
- **Comparator & Simulator**: VS matrix (Δ IQ, 100k cost) + workload presets (Chat/Agent/RAG/Batch) with caching/batch toggles.
- **Accessible, responsive**: keyboard, ARIA, focus trap, `>=38px` touch targets.
- **Hono API** on Bun + Cloudflare Pages Functions, zero-DB, bundled dataset.

---

## Project Structure

```
src/
  charts/echartsRender.ts    # ECharts scatter + SOTA timeline
  components/Header.astro, TabModels.astro, ModelDrawer.astro, MobileNav.astro, Toast.astro
  data/models.json           # 759 models (pretty 2-space, not minified)
  pages/index.astro
  server/app.ts, aaService.ts
  store/appStore.ts, compare.ts, config.ts, inspector.ts
  styles/index.css
  types/model.ts
  utils/aaNormalize.ts, pricing.ts, frontier.ts, formatters.ts, providers.ts, aaSync.ts
scripts/
  merge-openrouter.mjs       # live OR merge (keep IQ, update pricing/context)
  verify_ui.py               # Playwright bundle + viewport checks
tests/                       # bun test (aaNormalize, charts, formatters, server, store, uiMarkup)
```

---

## Getting Started

```bash
git clone https://github.com/username/obench.git
cd obench
bun install
bun run dev # http://localhost:4321
```

### Scripts

```bash
bun scripts/merge-openrouter.mjs          # merge live OR pricing
bun scripts/merge-openrouter.mjs --dry-run
bun test
bun run check
bun x tsc --noEmit
bun x knip
bun run build
python3 scripts/verify_ui.py
```

---

## API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | health + `AA_API_KEY` check |
| `GET` | `/api/models` | bundled `models.json` |
| `POST` | `/api/sync` | live AA paginated normalize (`AA_API_KEY` env) |
| `POST` | `/api/test-aa` | validate AA key |

---

## Deployment (Cloudflare Pages)

1. Framework: Astro, Build `bun run build`, Output `dist`
2. Env `AA_API_KEY` for live sync

---

## License

MIT — see `LICENSE`.
