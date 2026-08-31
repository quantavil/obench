# OBench

OBench is an open-source, high-performance intelligence and token pricing workbench for AI language models, powered by benchmark telemetry from Artificial Analysis.

Built with TypeScript, Astro, Hono, Tailwind CSS v4, Alpine.js, and Apache ECharts.

---

## Features

- **Neutral Precision Workbench**: Professional typography, neutral palette with a restrained signal accent (`#c8ff00` electric lime), and dense data display tailored for engineers and researchers.
- **High-Density Model Explorer**: Explore 600+ LLMs with real-time Quality (IQ), Coding index, throughput speed (tokens/sec), first-token latency (TTFT), context window limits, and token pricing.
- **Rigorous Cost Semantics**: Clear distinction between free models (`Free` / `$0.00`) and unpriced/unreported models (`--` / `Unpriced`).
- **Modular Lazy-Loaded Charts**: Apache ECharts modular SVG scatter plots and SOTA progression timeline dynamically loaded on demand, keeping the initial JS bundle under 260 KB (< 700 KB budget).
- **Multi-Metric Scatter Plots & Pareto Frontier**: Interactive scatter plots for Quality vs Cost (with Pareto efficiency frontier), Quality vs Speed (TPS), and Latency (TTFT) vs Throughput.
- **SOTA Timeline Progression**: Chronological state-of-the-art advancement staircase tracking frontier breakthroughs over time.
- **Side-by-Side Comparator (VS)**: Direct spec matrix comparing up to 4 models simultaneously, including IQ deltas and simulated 100k query cost projections.
- **Workload Cost Simulator**: Model inspector with presets for Chat, Autonomous Agents, RAG pipelines, and Batch processing, complete with Prompt Caching and Batch API discount toggles.
- **Accessible & Responsive**: Keyboard-first navigation, ARIA sorting, focus trapping & restoration, and responsive layouts across desktop, tablet, and mobile with compliant touch targets (>= 38px).
- **Universal Hono API**: Unified web-standard API running locally on Bun and deployed seamlessly on Cloudflare Pages Functions.
- **Zero-Database Serverless Architecture**: Instant offline startup via bundled dataset, with server-side live synchronization from Artificial Analysis using Cloudflare environment variables.

---

## Project Structure

```
.
├── src/
│   ├── charts/
│   │   └── echartsRender.ts    # Modular Apache ECharts scatter plot & SOTA timeline renderers
│   ├── components/
│   │   ├── Header.astro        # Top navigation bar with ⌘K search & live sync trigger
│   │   ├── TabModels.astro     # Explorer views (Table, Cards, Scatter Plots, Timeline, Compare)
│   │   ├── ModelDrawer.astro   # In-place desktop side panel & mobile slide-over inspector sheet
│   │   ├── MobileNav.astro     # Responsive floating mobile navigation bar
│   │   ├── Toast.astro         # Real-time status notifications
│   │   └── Icons.astro         # Reusable SVG icon symbols
│   ├── data/
│   │   └── models.json         # Pre-bundled dataset (600+ models with full telemetry)
│   ├── pages/
│   │   └── index.astro         # Astro root application entrypoint
│   ├── server/
│   │   └── app.ts              # Universal Hono API application
│   ├── store/
│   │   ├── appStore.ts         # Alpine.js reactive client workbench store
│   │   ├── compare.ts          # Comparison logic & winner computations
│   │   ├── config.ts           # Presets, price brackets, and capability filters
│   │   └── inspector.ts        # Focus trapping and scroll-lock management
│   ├── styles/
│   │   └── index.css           # Design tokens, themes (dark/light), and custom styles
│   ├── types/
│   │   └── model.ts            # Strict TypeScript interfaces & schema definitions
│   └── utils/
│       ├── aaNormalize.ts      # Telemetry normalizer for Artificial Analysis records
│       ├── aaSync.ts           # Server synchronization client helper
│       ├── formatters.ts       # Compact date, currency, and numerical formatters
│       ├── frontier.ts         # Pareto efficiency frontier & SOTA progression algorithms
│       ├── pricing.ts          # Blended and effective token pricing formulas
│       └── providers.ts        # Creator brand colors and vector logos
├── functions/
│   └── [[route]].ts            # Cloudflare Pages Functions adapter wrapping Hono
├── scripts/
│   ├── verify_ui.py            # Playwright automated UI verification & screenshot suite
│   └── screenshots/            # Verified multi-viewport screenshots
├── tests/                      # Bun test suites (100% TypeScript)
│   ├── aaNormalize.test.ts
│   ├── charts.test.ts
│   ├── formatters.test.ts
│   ├── server.test.ts
│   ├── store.test.ts
│   └── uiMarkup.test.ts
├── astro.config.mjs
├── knip.json                   # Dead code and unused export validation config
├── package.json
├── tsconfig.json
└── README.md
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.1+ recommended)
- [Python 3](https://python.org) (v3.10+ for Playwright UI verification)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/username/obench.git
cd obench
bun install
```

### Development Server

Start the local development server:

```bash
bun run dev
```

Open `http://localhost:4321` in your browser.

---

## Testing & Verification Suite

OBench includes a full automated test matrix covering units, integrations, type safety, bundle sizes, accessibility, and multi-viewport rendering:

```bash
# 1. Run unit and integration test suites (55+ tests)
bun test

# 2. Astro project diagnostic checks
bun run check

# 3. TypeScript strict type checks
bun x tsc --noEmit

# 4. Dead code and unused export scanner
bun x knip

# 5. Production build (Vite + Astro)
bun run build

# 6. Bundle budget & multi-viewport Playwright browser verification
python3 scripts/verify_ui.py
```

### Bundle Size Budget

- Entry JS Chunk Budget: `< 700 KB`
- Measured Initial Chunk: `~257 KB` (modular ECharts loaded asynchronously upon chart view activation)

---

## Deployment (Cloudflare Pages)

OBench is designed for zero-config deployment on Cloudflare Pages:

1. Connect your repository in the **Cloudflare Pages Dashboard**.
2. Set the build settings:
   - **Framework preset**: Astro
   - **Build command**: `bun run build`
   - **Build output directory**: `dist`
3. Add your environment variable (optional, for live sync):
   - **Settings** > **Environment Variables** > Add `AA_API_KEY` with your Artificial Analysis API key.
4. Deploy! All API routes under `/api/*` are handled by Cloudflare Pages Functions via Hono.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status and API key configuration check |
| `GET` | `/api/models` | Returns bundled model records with full telemetry |
| `POST` | `/api/sync` | Fetches, paginates, and normalizes live data from Artificial Analysis using `AA_API_KEY` |
| `POST` | `/api/test-aa` | Validates API connectivity with Artificial Analysis |

---

## License

MIT
