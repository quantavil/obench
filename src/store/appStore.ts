import defaultModels from '../data/models.json';
import {
  PRICE_RANGES,
  COST_BASIS_OPTIONS,
  MODEL_VIEW_MODES,
  PLOT_METRIC_MODES,
  SORT_OPTIONS,
  SORT_COLUMN_MAP,
  CAPABILITY_FILTERS,
  WORKLOAD_PRESETS,
  costBasisShortLabel,
} from '../utils/config';
import {
  providerColor,
  providerSvg,
  extractModelBadges,
  modelHasVision,
  modelHasReasoning,
} from '../utils/providers';
import {
  computeEfficiencyFrontier,
  computeSotaProgression,
} from '../utils/frontier';
import {
  calculateModelCost,
  cachedInput,
  batchInput,
  batchOutput,
} from '../utils/pricing';
import { comparisonWinners } from './compare';
import {
  recordInspectorTrigger,
  restoreInspectorFocus,
  reconcileInspectorScrollLock,
  trapFocus,
  focusFirstElement,
} from './inspector';
import {
  fmt1,
  fmtCost,
  fmtContext,
  fmtDateTimeCompact,
} from '../utils/formatters';
import { fetchAaModels } from '../utils/aaSync';
import { mergeSyncedModels } from '../utils/syncMerge';
import type { ModelRecord, CostBasis, ModelViewMode, PlotMetricMode } from '../types/model';

let chartModulePromise: Promise<typeof import('../charts/echartsRender')> | null = null;

function loadCharts() {
  if (!chartModulePromise) {
    chartModulePromise = import('../charts/echartsRender').catch((err) => {
      chartModulePromise = null;
      throw err;
    });
  }
  return chartModulePromise;
}

const PAGE_STEP = 200;

export type ToastSeverity = 'info' | 'success' | 'warning' | 'error';

/** Cost per request given the simulator state; shared by run + monthly estimates. */
function estimateCost(model: ModelRecord, inputTokens: number, outputTokens: number, useCache: boolean, useBatch: boolean): number | null {
  if (model.price1mInput === null && model.price1mOutput === null) return null;
  let inputP = model.price1mInput;
  let outputP = model.price1mOutput;
  if (useCache) inputP = cachedInput(model);
  if (useBatch) {
    inputP = batchInput(model);
    outputP = batchOutput(model);
  }
  if (inputP === null && outputP === null) return null;
  const inRate = inputP ?? outputP ?? 0;
  const outRate = outputP ?? inputP ?? 0;
  return (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
}

export function bench() {
  return {
    // ---------------------------------------------------- constants
    PRICE_RANGES,
    COST_BASIS_OPTIONS,
    MODEL_VIEW_MODES,
    PLOT_METRIC_MODES,
    SORT_OPTIONS,
    CAPABILITY_FILTERS,
    WORKLOAD_PRESETS,

    // ---------------------------------------------------- state
    inspectedModel: null as ModelRecord | null,
    copiedModelId: null as string | null,

    syncing: false,
    search: '',
    mobileFilterOpen: false,

    // Theme state
    isDark: true,

    // Models filter & sort state
    modelsViewMode: 'table' as ModelViewMode,
    plotMetric: 'iq-cost' as PlotMetricMode,
    plotScale: 'log' as 'log' | 'linear',
    sortBy: 'iq-desc',
    selectedModelProviders: [] as string[],
    selectedPriceRanges: [] as string[],
    selectedCapability: 'all',
    costBasis: 'blended' as CostBasis,
    customMinPrice: '',
    customMaxPrice: '',
    modelsPage: 1,
    modelsPageSize: 100,

    // Side-by-Side Model Comparison State
    showCompareCol: false,
    comparedModelIds: [] as string[],

    // Token Cost Calculator state
    calcInputTokens: 1500,
    calcOutputTokens: 500,
    dailyRequests: 1000,
    usePromptCaching: false,
    useBatchPricing: false,

    // Cached derivations
    cachedFilteredModels: [] as ModelRecord[],
    cachedModelRows: [] as Array<{ model: ModelRecord }>,
    cachedPaginatedModels: [] as Array<{ model: ModelRecord }>,
    cachedBestModel: null as ModelRecord | null,
    cachedOptimalModels: [] as ModelRecord[],

    // Toast notifications
    toastMsg: '',
    toastSeverity: 'info' as ToastSeverity,
    toastTimer: null as any,

    // Dataset
    data: {
      models: (defaultModels as ModelRecord[]) || [],
      lastSyncedAt: null as number | null,
      datasetStale: false,
    },

    // ---------------------------------------------------- init
    async init(this: any) {
      const savedTheme = localStorage.getItem('bench-theme');
      this.isDark = savedTheme !== 'light';

      // Load saved models if present in localStorage (offline fallback, KV is primary)
      try {
        const stored = localStorage.getItem('bench-models');
        const storedSync = localStorage.getItem('bench-last-synced');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Heal stored models with defaultModels so contextWindow, maxOutputTokens, pricing, and new models are never lost
            const healed = mergeSyncedModels(defaultModels as ModelRecord[], parsed as ModelRecord[]);
            this.data.models = healed;
            if (storedSync) {
              this.data.lastSyncedAt = Number(storedSync);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load stored models from localStorage', e);
      }

      try {
        const res = await fetch('/api/models', { headers: { Accept: 'application/json' } });
        const json: any = await res.json().catch(() => ({}));
        if (res.ok && json?.ok && Array.isArray(json.models) && json.models.length > 0) {
          const kvSyncedAt = typeof json.syncedAt === 'number' ? json.syncedAt : 0;
          const localSyncedAt = this.data.lastSyncedAt ?? 0;
          const useKv = kvSyncedAt >= localSyncedAt || (defaultModels as ModelRecord[]).length === 0;
          if (useKv) {
            const merged = mergeSyncedModels(defaultModels as ModelRecord[], json.models as ModelRecord[]);
            this.data.models = merged;
            this.data.lastSyncedAt = kvSyncedAt || null;
            this.data.datasetStale = Boolean(json.stale);
            try {
              localStorage.setItem('bench-models', JSON.stringify(merged));
              if (kvSyncedAt) localStorage.setItem('bench-last-synced', String(kvSyncedAt));
            } catch {}
          }
        }
      } catch (e) {
        console.warn('Failed to fetch models from /api/models, keeping local/bundled fallback', e);
      }

      if (typeof window !== 'undefined') {
        this.initHashRouting();

        window.addEventListener('keydown', (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            this.focusSearch();
          }
          if (e.key === 'Escape') {
            if (this.inspectedModel) {
              this.closeModelDrawer();
            } else if (this.mobileFilterOpen) {
              this.closeMobileFilter();
            } else if (this.search) {
              this.search = '';
            }
          }
        });

        let resizeTimer: any = null;
        window.addEventListener('resize', () => {
          reconcileInspectorScrollLock(this.inspectedModel !== null);
          if (this.modelsViewMode === 'plot' || this.modelsViewMode === 'timeline') {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(async () => {
              const charts = await loadCharts();
              charts.resizeActiveChart();
            }, 100);
          }
        });
      }

      // Watchers for reactive derivations
      if (typeof this.$watch === 'function') {
        this.$watch('modelFilterKey', () => {
          this.modelsPage = 1;
          this.modelsPageSize = 100;
          this.updateModelRows();
          this.$nextTick?.(() => {
            this.mountCurrentChart();
          });
        });

        this.$watch('modelsViewMode', () => {
          this.syncViewHash();
          this.updateOptimalModels();
          this.$nextTick?.(() => {
            this.mountCurrentChart();
          });
        });

        this.$watch('plotMetric', () => {
          this.$nextTick?.(() => {
            this.mountCurrentChart();
          });
        });

        this.$watch('plotScale', () => {
          this.$nextTick?.(() => {
            this.mountCurrentChart();
          });
        });

        this.$watch('costBasis', () => {
          this.updateOptimalModels();
          this.$nextTick?.(() => {
            this.mountCurrentChart();
          });
        });

        this.$watch('inspectedModel', () => {
          this.$nextTick?.(() => {
            if (this.modelsViewMode === 'plot' || this.modelsViewMode === 'timeline') {
              this.mountCurrentChart();
            }
          });
        });
      }

      // Initial compute & mount
      this.updateModelRows();
      if (typeof this.$nextTick === 'function') {
        this.$nextTick(() => {
          this.mountCurrentChart();
        });
      }
    },

    initHashRouting(this: any) {
      const applyHash = () => {
        const h = (window.location.hash || '').replace(/^#\/?/, '').toLowerCase();
        if (h === 'plot' || h === 'timeline' || h === 'compare' || h === 'table') {
          this.modelsViewMode = h;
        }
      };
      window.addEventListener('hashchange', applyHash);
      applyHash();
    },

    /** Keep the URL in sync so views are shareable and reload-safe. */
    syncViewHash(this: any) {
      const h = (window.location.hash || '').replace(/^#\/?/, '').toLowerCase();
      if (h !== this.modelsViewMode) {
        history.replaceState(null, '', `#${this.modelsViewMode}`);
      }
    },

    // ---------------------------------------------------- watchers & derivations
    get modelFilterKey(): string {
      const self = this as any;
      return [
        self.sortBy,
        self.search,
        self.selectedModelProviders.slice().sort().join(','),
        self.selectedPriceRanges.slice().sort().join(','),
        self.selectedCapability,
        self.costBasis,
        self.customMinPrice,
        self.customMaxPrice,
        self.data.models.length,
        self.data.lastSyncedAt,
      ].join('|');
    },

    updateModelRows(this: any) {
      const q = this.search.trim().toLowerCase();
      const providersSet = new Set(this.selectedModelProviders);
      const hasProviderFilter = providersSet.size > 0;
      const hasPriceFilter = this.selectedPriceRanges.length > 0;

      const activeRanges = this.selectedPriceRanges.map((id: string) => {
        if (id === 'custom') {
          const min = this.customMinPrice !== '' ? Number(this.customMinPrice) : -Infinity;
          const max = this.customMaxPrice !== '' ? Number(this.customMaxPrice) : Infinity;
          return { min, max };
        }
        return PRICE_RANGES.find((r) => r.id === id);
      }).filter(Boolean);

      const filtered = (this.data.models || []).filter((m: ModelRecord) => {
        if (!m) return false;
        if (hasProviderFilter && !providersSet.has(m.provider)) return false;

        if (q) {
          const haystacks = [
            m.name && m.name.toLowerCase(),
            m.provider && m.provider.toLowerCase(),
            m.id && m.id.toLowerCase(),
          ];
          // Capability keywords — search matches what the filters can express
          const isFree = (m.price1mInput === 0 && m.price1mOutput === 0);
          const capabilityHaystack = [
            modelHasVision(m) ? 'vision multimodal' : '',
            modelHasReasoning(m) ? 'reasoning thinking' : '',
            (m.speedTps ?? 0) >= 100 ? 'fast speed' : '',
            (m.contextWindow ?? 0) >= 200000 ? 'long context 1m 200k' : '',
            m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k` : '',
            m.maxOutputTokens ? `${Math.round(m.maxOutputTokens / 1000)}k out` : '',
            m.isOpenWeights ? 'open weights' : '',
            isFree ? 'free' : '',
          ].join(' ').toLowerCase();
          const matches = haystacks.some((h: string) => h && h.includes(q)) || capabilityHaystack.includes(q);
          if (!matches) return false;
        }

        if (this.selectedCapability !== 'all') {
          if (this.selectedCapability === 'reasoning') {
            if (!modelHasReasoning(m)) return false;
          } else if (this.selectedCapability === 'vision') {
            if (!modelHasVision(m)) return false;
          } else if (this.selectedCapability === 'fast') {
            if ((m.speedTps ?? 0) < 100) return false;
          } else if (this.selectedCapability === 'long-ctx') {
            if ((m.contextWindow ?? 0) < 200000) return false;
          } else if (this.selectedCapability === 'open-weights') {
            if (!m.isOpenWeights) return false;
          }
        }

        if (hasPriceFilter) {
          const cost = calculateModelCost(m, this.costBasis);
          const inAnyRange = activeRanges.some((r: any) => {
            if (r.id === 'free') return cost === 0;
            if (cost === null) return false;
            return cost >= r.min && cost <= r.max;
          });
          if (!inAnyRange) return false;
        }

        return true;
      });

      filtered.sort((a: ModelRecord, b: ModelRecord) => this.sortComparator(a, b));

      this.cachedFilteredModels = filtered;
      this.cachedModelRows = filtered.map((m: ModelRecord) => ({ model: m }));
      this.cachedPaginatedModels = this.cachedModelRows.slice(0, this.modelsPageSize);

      let best: ModelRecord | null = null;
      for (const m of filtered) {
        if (m.intelligence != null && (best?.intelligence == null || m.intelligence > best.intelligence)) {
          best = m;
        }
      }
      this.cachedBestModel = best;
      this.updateOptimalModels();
    },

    sortComparator(this: any, a: ModelRecord, b: ModelRecord): number {
      const costOf = (m: ModelRecord) => calculateModelCost(m, this.costBasis);
      switch (this.sortBy) {
        case 'iq-asc': return (a.intelligence ?? 999) - (b.intelligence ?? 999);
        case 'speed-desc': return (b.speedTps ?? -1) - (a.speedTps ?? -1);
        case 'speed-asc': return (a.speedTps ?? 9999) - (b.speedTps ?? 9999);
        case 'ttft-asc': return (a.latencyTtft ?? Infinity) - (b.latencyTtft ?? Infinity);
        case 'coding-desc': return (b.codingIndex ?? -1) - (a.codingIndex ?? -1);
        case 'context-desc': return (b.contextWindow ?? 0) - (a.contextWindow ?? 0);
        case 'max-output-desc': return (b.maxOutputTokens ?? 0) - (a.maxOutputTokens ?? 0);
        case 'price-asc': return (costOf(a) ?? Infinity) - (costOf(b) ?? Infinity);
        case 'price-desc': return (costOf(b) ?? -1) - (costOf(a) ?? -1);
        case 'prompt-asc': return (a.price1mInput ?? Infinity) - (b.price1mInput ?? Infinity);
        case 'prompt-desc': return (b.price1mInput ?? -1) - (a.price1mInput ?? -1);
        case 'output-asc': return (a.price1mOutput ?? Infinity) - (b.price1mOutput ?? Infinity);
        case 'output-desc': return (b.price1mOutput ?? -1) - (a.price1mOutput ?? -1);
        case 'name-asc': return (a.name || '').localeCompare(b.name || '');
        case 'name-desc': return (b.name || '').localeCompare(a.name || '');
        case 'date-desc': return (Date.parse(b.releasedAt || '0') || 0) - (Date.parse(a.releasedAt || '0') || 0);
        case 'iq-desc':
        default: return (b.intelligence ?? -1) - (a.intelligence ?? -1);
      }
    },

    updateOptimalModels(this: any) {
      const models: ModelRecord[] = this.cachedFilteredModels || [];
      if (this.modelsViewMode === 'plot') {
        this.cachedOptimalModels = computeEfficiencyFrontier(models, this.costBasis);
      } else if (this.modelsViewMode === 'timeline') {
        this.cachedOptimalModels = computeSotaProgression(models);
      } else {
        this.cachedOptimalModels = [];
      }
    },

    async mountCurrentChart(this: any) {
      const chartEl = document.getElementById('echarts-container');
      if (!chartEl) return;

      if (this.modelsViewMode === 'plot' || this.modelsViewMode === 'timeline') {
        const isDark = document.documentElement.classList.contains('dark');
        const charts = await loadCharts();
        const render = () => {
          const openModel = (m: ModelRecord) => this.openModelDrawer(m, null);
          if (this.modelsViewMode === 'plot') {
            charts.renderEChartsPlot(chartEl, this.filteredModels, this.costBasis, this.plotMetric, isDark, this.plotScale, openModel);
          } else if (this.modelsViewMode === 'timeline') {
            charts.renderEChartsTimeline(chartEl, this.filteredModels, isDark, openModel);
          }
        };
        if (typeof window !== 'undefined' && window.requestAnimationFrame) {
          window.requestAnimationFrame(() => render());
        } else {
          render();
        }
      } else if (chartModulePromise) {
        const charts = await loadCharts();
        charts.destroyActiveChart();
      }
    },

    async resetPlotZoom(this: any) {
      const charts = await loadCharts();
      charts.resetActiveChartZoom();
    },

    // Table header sort toggle, driven by SORT_COLUMN_MAP
    toggleSort(this: any, col: string) {
      const spec = SORT_COLUMN_MAP[col];
      if (!spec) return;
      const initial = spec.initial ?? 'desc';
      if (this.sortBy === spec.desc) {
        this.sortBy = spec.asc ?? spec.fallback ?? spec.desc;
      } else if (spec.asc && this.sortBy === spec.asc) {
        this.sortBy = spec.desc;
      } else {
        this.sortBy = initial === 'asc' && spec.asc ? spec.asc : spec.desc;
      }
    },

    getAriaSort(this: any, col: string): 'ascending' | 'descending' | 'none' {
      const spec = SORT_COLUMN_MAP[col];
      if (!spec) return 'none';
      if (this.sortBy === spec.desc) return 'descending';
      if (spec.asc && this.sortBy === spec.asc) return 'ascending';
      return 'none';
    },

    getSortIcon(this: any, col: string): string {
      const spec = SORT_COLUMN_MAP[col];
      if (!spec) return '';
      if (this.sortBy === spec.desc) return '↓';
      if (spec.asc && this.sortBy === spec.asc) return '↑';
      return '';
    },

    // ---------------------------------------------------- getters
    get activeFiltersCount(): number {
      const self = this as any;
      let count = 0;
      if (self.search.trim()) count++;
      if (self.selectedModelProviders.length > 0) count += self.selectedModelProviders.length;
      if (self.selectedPriceRanges.length > 0) count += self.selectedPriceRanges.length;
      if (self.selectedCapability !== 'all') count++;
      return count;
    },

    get availableModelProviders(): string[] {
      const self = this as any;
      const counts = new Map<string, number>();
      for (const m of (self.data.models || [])) {
        if (m && m.provider) {
          counts.set(m.provider, (counts.get(m.provider) || 0) + 1);
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([provider]) => provider);
    },

    get providerCount(): (name: string) => number {
      const self = this as any;
      const counts = new Map<string, number>();
      for (const m of (self.data.models || [])) {
        if (m && m.provider) counts.set(m.provider, (counts.get(m.provider) || 0) + 1);
      }
      return (name: string) => counts.get(name) ?? 0;
    },

    get filteredModels(): ModelRecord[] {
      return (this as any).cachedFilteredModels || [];
    },

    get rankedModelsByIntelligence(): Array<{ model: ModelRecord }> {
      return (this as any).cachedModelRows;
    },

    get paginatedModels(): Array<{ model: ModelRecord }> {
      return (this as any).cachedPaginatedModels || [];
    },

    get comparedModels(): ModelRecord[] {
      const self = this as any;
      return self.comparedModelIds
        .map((id: string) => self.data.models.find((m: ModelRecord) => m.id === id))
        .filter(Boolean);
    },

    get bestModelInRange(): ModelRecord | null {
      return (this as any).cachedBestModel;
    },

    get optimalModels(): ModelRecord[] {
      return (this as any).cachedOptimalModels || [];
    },

    get comparisonWinners(): Record<string, { iq: boolean; speed: boolean; cost: boolean; ttft: boolean }> {
      const self = this as any;
      return comparisonWinners(self.comparedModels, self.costBasis);
    },

    get costBasisLabel(): string {
      return costBasisShortLabel(this.costBasis);
    },

    get estimatedRunCost(): string {
      const self = this as any;
      if (!self.inspectedModel) return '--';
      const cost = estimateCost(self.inspectedModel, Number(self.calcInputTokens), Number(self.calcOutputTokens), self.usePromptCaching, self.useBatchPricing);
      if (cost === null) return '--';
      if (cost === 0) return 'Free';
      if (cost < 0.0001) return '< $0.0001';
      return `$${cost.toFixed(4)}`;
    },

    get estimatedMonthlyCost(): string {
      const self = this as any;
      if (!self.inspectedModel) return '--';
      const cost = estimateCost(self.inspectedModel, Number(self.calcInputTokens), Number(self.calcOutputTokens), self.usePromptCaching, self.useBatchPricing);
      if (cost === null) return '--';
      if (cost === 0) return 'Free';
      const monthly = cost * Number(self.dailyRequests) * 30;
      return `$${monthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    // ---------------------------------------------------- actions
    openModelDrawer(this: any, model: ModelRecord, triggerEl?: HTMLElement | null) {
      recordInspectorTrigger(triggerEl);
      this.inspectedModel = model;
      reconcileInspectorScrollLock(true);
      this.$nextTick(() => {
        // Desktop docked panel vs mobile bottom-sheet dialog
        const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
        const dialog = isDesktop
          ? (document.getElementById('inspector-panel') as HTMLElement | null)
          : (document.querySelector("div[role='dialog']") as HTMLElement | null);
        if (dialog) {
          focusFirstElement(dialog);
        }
      });
    },

    closeModelDrawer(this: any) {
      this.inspectedModel = null;
      reconcileInspectorScrollLock(false);
      restoreInspectorFocus();
    },

    handleInspectorTrap(this: any, event: KeyboardEvent, dialog: HTMLElement) {
      trapFocus(event, dialog);
    },

    applyWorkloadPreset(this: any, preset: string) {
      const p = WORKLOAD_PRESETS.find((w) => w.id === preset);
      if (!p) return;
      this.calcInputTokens = p.inputTokens;
      this.calcOutputTokens = p.outputTokens;
    },

    toggleProvider(this: any, p: string) {
      const idx = this.selectedModelProviders.indexOf(p);
      if (idx > -1) {
        this.selectedModelProviders.splice(idx, 1);
      } else {
        this.selectedModelProviders.push(p);
      }
    },

    isProviderSelected(this: any, p: string) {
      return this.selectedModelProviders.includes(p);
    },

    toggleMobileFilter(this: any) {
      this.mobileFilterOpen = !this.mobileFilterOpen;
    },

    closeMobileFilter(this: any) {
      this.mobileFilterOpen = false;
    },

    toggleCompareCol(this: any) {
      this.showCompareCol = !this.showCompareCol;
      if (this.showCompareCol && this.modelsViewMode !== 'table') {
        this.modelsViewMode = 'table';
      }
    },

    applyComparison(this: any) {
      if (this.comparedModelIds.length < 2) {
        this.toast('Select at least 2 models to compare', 'warning');
        return;
      }
      this.modelsViewMode = 'compare';
    },

    toggleCompareModel(this: any, model: ModelRecord) {
      if (!model) return;
      const idx = this.comparedModelIds.indexOf(model.id);
      if (idx > -1) {
        this.comparedModelIds.splice(idx, 1);
      } else {
        if (this.comparedModelIds.length >= 4) {
          this.toast('You can compare up to 4 models simultaneously', 'warning');
          return;
        }
        this.comparedModelIds.push(model.id);
        this.toast(`Added ${model.name} to comparison`, 'info');
      }
    },

    isModelCompared(this: any, model: ModelRecord) {
      return model ? this.comparedModelIds.includes(model.id) : false;
    },

    clearComparison(this: any) {
      this.comparedModelIds = [];
      this.toast('Comparison cleared', 'info');
    },

    /** Reveal the next PAGE_STEP rows instead of dumping every model at once. */
    loadMoreModels(this: any) {
      this.modelsPageSize = Math.min(this.modelsPageSize + PAGE_STEP, this.cachedModelRows.length);
      this.cachedPaginatedModels = this.cachedModelRows.slice(0, this.modelsPageSize);
    },

    focusSearch() {
      const el = document.getElementById('search-input');
      if (el) {
        el.focus();
        (el as HTMLInputElement).select();
      }
    },

    clearFilters(this: any) {
      this.search = '';
      this.selectedModelProviders = [];
      this.selectedPriceRanges = [];
      this.selectedCapability = 'all';
      this.customMinPrice = '';
      this.customMaxPrice = '';
      this.toast('Filters reset', 'info');
    },

    async copyToClipboard(this: any, text: string, id: string) {
      const done = () => {
        this.copiedModelId = id;
        this.toast(`Copied "${text}"`, 'success');
        setTimeout(() => {
          if (this.copiedModelId === id) this.copiedModelId = null;
        }, 2000);
      };

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        }
        done();
      } catch {
        done();
      }
    },

    toggleTheme(this: any) {
      this.isDark = document.documentElement.classList.toggle('dark');
      try {
        localStorage.setItem('bench-theme', this.isDark ? 'dark' : 'light');
      } catch {}
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', this.isDark ? '#090d10' : '#f8fafc');
      }
      this.$nextTick(() => {
        this.mountCurrentChart();
      });
    },

    async syncModels(this: any) {
      if (this.syncing) return;
      this.syncing = true;
      try {
        const freshModels = await fetchAaModels();
        if (Array.isArray(freshModels) && freshModels.length > 0) {
          const base = mergeSyncedModels(defaultModels as ModelRecord[], (this.data.models as ModelRecord[]) || []);
          const merged = mergeSyncedModels(base, freshModels as ModelRecord[]);
          this.data.models = merged;
          this.data.lastSyncedAt = Date.now();
          this.data.datasetStale = false;
          try {
            localStorage.setItem('bench-models', JSON.stringify(merged));
            localStorage.setItem('bench-last-synced', String(this.data.lastSyncedAt));
          } catch (e) {
            console.warn('localStorage quota exceeded, skipping persist', e);
          }
          this.toast(`Synced ${merged.length} models successfully!`, 'success');
          this.updateModelRows();
          this.$nextTick(() => {
            this.mountCurrentChart();
          });
        } else {
          throw new Error('No models returned from Artificial Analysis.');
        }
      } catch (err: any) {
        console.error('Sync failed:', err);
        this.toast(
          err.message || 'Sync failed. Ensure AA_API_KEY is configured in Cloudflare.',
          'error',
        );
      } finally {
        this.syncing = false;
      }
    },

    // ---------------------------------------------------- formatting & color helpers
    providerColor(name: string) {
      return providerColor(name);
    },

    providerSvg(name: string, size = 16) {
      return providerSvg(name, size);
    },

    extractModelBadges(model: ModelRecord) {
      return extractModelBadges(model);
    },

    getModelCost(this: any, m: ModelRecord) {
      return calculateModelCost(m, this.costBasis);
    },

    fmtCost(val: number | null | undefined) {
      return fmtCost(val);
    },

    fmt1(val: number | null | undefined) {
      return fmt1(val);
    },

    fmtDateTimeCompact(ts: any) {
      return fmtDateTimeCompact(ts);
    },

    fmtContext(tokens: number | null | undefined) {
      return fmtContext(tokens);
    },

    costBasisShortLabel(basis: any) {
      return costBasisShortLabel(basis);
    },

    toast(this: any, msg: string, severity: ToastSeverity = 'info') {
      this.toastMsg = msg;
      this.toastSeverity = severity;
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.toastMsg = '';
      }, 4000);
    },
  };
}
