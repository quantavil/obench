import defaultModels from '../data/models.json';
import {
  PRICE_RANGES,
  COST_BASIS_OPTIONS,
  MODEL_VIEW_MODES,
  PLOT_METRIC_MODES,
  SORT_OPTIONS,
  POPULAR_CREATORS,
  CAPABILITY_FILTERS,
  WORKLOAD_PRESETS,
} from '../utils/config';
import {
  renderEChartsPlot,
  renderEChartsTimeline,
  destroyActiveChart,
} from '../charts/echartsRender';
import {
  providerColor,
  providerSvg,
  extractModelBadges,
} from '../utils/providers';
import {
  computeEfficiencyFrontier,
  computeSotaProgression,
  calculateModelCost,
} from '../utils/frontier';
import {
  fmt1,
  fmtCost,
  fmtDate,
  fmtDateTime,
  fmtDateTimeCompact,
} from '../utils/formatters';
import {
  fetchAaModels,
} from '../utils/aaSync';
import type { ModelRecord, CostBasis, ModelViewMode, PlotMetricMode } from '../types/model';

export function bench() {
  return {
    // ---------------------------------------------------- constants
    PRICE_RANGES,
    COST_BASIS_OPTIONS,
    MODEL_VIEW_MODES,
    PLOT_METRIC_MODES,
    SORT_OPTIONS,
    POPULAR_CREATORS,
    CAPABILITY_FILTERS,
    WORKLOAD_PRESETS,

    // ---------------------------------------------------- state
    tab: 'models',
    inspectedModel: null as ModelRecord | null,
    copiedModelId: null as string | null,

    loading: false,
    syncing: false,
    syncProgress: '',
    search: '',

    // Models filter & sort state
    modelsViewMode: 'table' as ModelViewMode,
    plotMetric: 'iq-cost' as PlotMetricMode,
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
    comparedModelIds: [] as string[],

    // Token Cost Calculator state
    calcInputTokens: 1500,
    calcOutputTokens: 500,
    dailyRequests: 1000,
    usePromptCaching: false,
    useBatchPricing: false,

    // Cached derivations
    cachedModelRows: [] as Array<{ model: ModelRecord }>,

    // Toast notifications
    toastMsg: '',
    toastTimer: null as any,

    // Dataset
    data: {
      models: (defaultModels as ModelRecord[]) || [],
      lastSyncedAt: null as number | null,
    },

    // ---------------------------------------------------- init
    async init(this: any) {
      // Load saved theme
      const savedTheme = localStorage.getItem('bench-theme');
      if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }

      // Load saved models if present in localStorage
      try {
        const stored = localStorage.getItem('bench-models');
        const storedSync = localStorage.getItem('bench-last-synced');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (storedSync) {
              this.data.models = parsed;
              this.data.lastSyncedAt = Number(storedSync);
            } else if (parsed.length >= (defaultModels || []).length) {
              this.data.models = parsed;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load stored models from localStorage', e);
      }

      // Load default compared models if available
      if (this.data.models && this.data.models.length > 2) {
        this.comparedModelIds = [this.data.models[0].id, this.data.models[1].id, this.data.models[4]?.id].filter(Boolean);
      }

      // Handle URL hash routing
      const applyHash = () => {
        const h = (window.location.hash || '').replace(/^#\/?/, '').toLowerCase();
        if (h === 'plot') {
          this.modelsViewMode = 'plot';
        } else if (h === 'timeline') {
          this.modelsViewMode = 'timeline';
        } else if (h === 'cards') {
          this.modelsViewMode = 'cards';
        } else if (h === 'compare') {
          this.modelsViewMode = 'compare';
        } else if (h === 'table') {
          this.modelsViewMode = 'table';
        }
      };
      window.addEventListener('hashchange', applyHash);
      applyHash();

      // Keyboard shortcuts
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          this.focusSearch();
        }
        if (e.key === 'Escape') {
          if (this.inspectedModel) this.closeModelDrawer();
          if (this.search) this.search = '';
        }
      });

      // Window resize chart handler
      window.addEventListener('resize', () => {
        if (this.modelsViewMode === 'plot' || this.modelsViewMode === 'timeline') {
          this.mountCurrentChart();
        }
      });

      // Watchers for reactive derivations
      this.$watch('modelFilterKey', () => {
        this.modelsPage = 1;
        this.modelsPageSize = 100;
        this.updateModelRows();
        this.$nextTick(() => {
          this.mountCurrentChart();
        });
      });

      this.$watch('modelsViewMode', () => {
        this.$nextTick(() => {
          this.mountCurrentChart();
        });
      });

      this.$watch('plotMetric', () => {
        this.$nextTick(() => {
          this.mountCurrentChart();
        });
      });

      this.$watch('inspectedModel', () => {
        this.$nextTick(() => {
          if (this.modelsViewMode === 'plot' || this.modelsViewMode === 'timeline') {
            this.mountCurrentChart();
          }
        });
      });

      // Initial compute & mount
      this.updateModelRows();
      this.$nextTick(() => {
        this.mountCurrentChart();
      });
    },

    // ---------------------------------------------------- watchers & derivations
    get modelFilterKey(): string {
      const self = this as any;
      return [
        self.modelsViewMode,
        self.plotMetric,
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
          const nameMatch = m.name && m.name.toLowerCase().includes(q);
          const provMatch = m.provider && m.provider.toLowerCase().includes(q);
          const idMatch = m.id && m.id.toLowerCase().includes(q);
          if (!nameMatch && !provMatch && !idMatch) return false;
        }

        // Capability filter - precise matching without false negatives
        if (this.selectedCapability !== 'all') {
          const nameTokens = new Set((m.name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
          const idTokens = new Set((m.id || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
          const hasVision = m.modalities && m.modalities.includes('vision');
          if (this.selectedCapability === 'reasoning') {
            const isReasoning =
              nameTokens.has('reasoning') ||
              nameTokens.has('thinking') ||
              nameTokens.has('effort') ||
              nameTokens.has('r1') ||
              nameTokens.has('o1') ||
              nameTokens.has('o3') ||
              idTokens.has('r1') ||
              idTokens.has('o1') ||
              idTokens.has('o3') ||
              (m.name || '').toLowerCase().includes('reasoning') ||
              (m.name || '').toLowerCase().includes('thinking');
            if (!isReasoning) return false;
          } else if (this.selectedCapability === 'vision') {
            const isVision = hasVision || nameTokens.has('vision') || nameTokens.has('multimodal') || nameTokens.has('vl') || idTokens.has('vl') || nameTokens.has('omni') || nameTokens.has('4o');
            if (!isVision) return false;
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
            if (r.id === 'free') return cost === 0 || cost === null;
            if (cost === null) return false;
            return cost >= r.min && cost <= r.max;
          });
          if (!inAnyRange) return false;
        }

        return true;
      });

      // Sorting
      filtered.sort((a: ModelRecord, b: ModelRecord) => {
        if (this.sortBy === 'iq-desc') {
          return (b.intelligence ?? -1) - (a.intelligence ?? -1);
        }
        if (this.sortBy === 'iq-asc') {
          return (a.intelligence ?? 999) - (b.intelligence ?? 999);
        }
        if (this.sortBy === 'speed-desc') {
          return (b.speedTps ?? -1) - (a.speedTps ?? -1);
        }
        if (this.sortBy === 'speed-asc') {
          return (a.speedTps ?? 9999) - (b.speedTps ?? 9999);
        }
        if (this.sortBy === 'ttft-asc') {
          const ttftA = a.latencyTtft ?? Infinity;
          const ttftB = b.latencyTtft ?? Infinity;
          return ttftA - ttftB;
        }
        if (this.sortBy === 'coding-desc') {
          return (b.codingIndex ?? -1) - (a.codingIndex ?? -1);
        }
        if (this.sortBy === 'context-desc') {
          return (b.contextWindow ?? 0) - (a.contextWindow ?? 0);
        }
        if (this.sortBy === 'price-asc') {
          const costA = calculateModelCost(a, this.costBasis) ?? Infinity;
          const costB = calculateModelCost(b, this.costBasis) ?? Infinity;
          return costA - costB;
        }
        if (this.sortBy === 'price-desc') {
          const costA = calculateModelCost(a, this.costBasis) ?? -1;
          const costB = calculateModelCost(b, this.costBasis) ?? -1;
          return costB - costA;
        }
        if (this.sortBy === 'prompt-asc') {
          const pA = a.price1mInput ?? Infinity;
          const pB = b.price1mInput ?? Infinity;
          return pA - pB;
        }
        if (this.sortBy === 'prompt-desc') {
          const pA = a.price1mInput ?? -1;
          const pB = b.price1mInput ?? -1;
          return pB - pA;
        }
        if (this.sortBy === 'output-asc') {
          const pA = a.price1mOutput ?? Infinity;
          const pB = b.price1mOutput ?? Infinity;
          return pA - pB;
        }
        if (this.sortBy === 'output-desc') {
          const pA = a.price1mOutput ?? -1;
          const pB = b.price1mOutput ?? -1;
          return pB - pA;
        }
        if (this.sortBy === 'name-asc') {
          return (a.name || '').localeCompare(b.name || '');
        }
        if (this.sortBy === 'date-desc') {
          return (Date.parse(b.releasedAt || '0') || 0) - (Date.parse(a.releasedAt || '0') || 0);
        }
        return (b.intelligence ?? -1) - (a.intelligence ?? -1);
      });

      this.cachedModelRows = filtered.map((m: ModelRecord) => ({
        model: m,
      }));
    },

    mountCurrentChart(this: any) {
      const isDark = document.documentElement.classList.contains('dark');
      const chartEl = document.getElementById('echarts-container');
      if (!chartEl) return;

      if (this.modelsViewMode === 'plot') {
        renderEChartsPlot(chartEl, this.filteredModels, this.costBasis, this.plotMetric, isDark);
      } else if (this.modelsViewMode === 'timeline') {
        renderEChartsTimeline(chartEl, this.filteredModels, isDark);
      } else {
        destroyActiveChart();
      }
    },

    // Table Header Sort Toggle
    toggleSort(this: any, col: string) {
      if (col === 'iq') {
        this.sortBy = this.sortBy === 'iq-desc' ? 'iq-asc' : 'iq-desc';
      } else if (col === 'speed') {
        this.sortBy = this.sortBy === 'speed-desc' ? 'speed-asc' : 'speed-desc';
      } else if (col === 'coding') {
        this.sortBy = this.sortBy === 'coding-desc' ? 'iq-desc' : 'coding-desc';
      } else if (col === 'context') {
        this.sortBy = this.sortBy === 'context-desc' ? 'iq-desc' : 'context-desc';
      } else if (col === 'prompt') {
        this.sortBy = this.sortBy === 'prompt-asc' ? 'prompt-desc' : 'prompt-asc';
      } else if (col === 'output') {
        this.sortBy = this.sortBy === 'output-asc' ? 'output-desc' : 'output-asc';
      } else if (col === 'blended') {
        this.sortBy = this.sortBy === 'price-asc' ? 'price-desc' : 'price-asc';
      } else if (col === 'name') {
        this.sortBy = this.sortBy === 'name-asc' ? 'iq-desc' : 'name-asc';
      }
    },

    getSortIcon(this: any, col: string): string {
      if (col === 'iq') {
        if (this.sortBy === 'iq-desc') return '↓';
        if (this.sortBy === 'iq-asc') return '↑';
      } else if (col === 'speed') {
        if (this.sortBy === 'speed-desc') return '↓';
        if (this.sortBy === 'speed-asc') return '↑';
      } else if (col === 'coding') {
        if (this.sortBy === 'coding-desc') return '↓';
      } else if (col === 'context') {
        if (this.sortBy === 'context-desc') return '↓';
      } else if (col === 'prompt') {
        if (this.sortBy === 'prompt-asc') return '↑';
        if (this.sortBy === 'prompt-desc') return '↓';
      } else if (col === 'output') {
        if (this.sortBy === 'output-asc') return '↑';
        if (this.sortBy === 'output-desc') return '↓';
      } else if (col === 'blended') {
        if (this.sortBy === 'price-asc') return '↑';
        if (this.sortBy === 'price-desc') return '↓';
      } else if (col === 'name') {
        if (this.sortBy === 'name-asc') return '↑';
      }
      return '';
    },

    // ---------------------------------------------------- getters
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

    get filteredModels(): ModelRecord[] {
      const self = this as any;
      return self.cachedModelRows.map((r: any) => r.model);
    },

    get rankedModelsByIntelligence(): Array<{ model: ModelRecord }> {
      const self = this as any;
      return self.cachedModelRows;
    },

    get paginatedModels(): Array<{ model: ModelRecord }> {
      const self = this as any;
      return self.cachedModelRows.slice(0, self.modelsPageSize);
    },

    get comparedModels(): ModelRecord[] {
      const self = this as any;
      return self.comparedModelIds
        .map((id: string) => self.data.models.find((m: ModelRecord) => m.id === id))
        .filter(Boolean);
    },

    get bestModelInRange(): ModelRecord | null {
      const self = this as any;
      const models: ModelRecord[] = self.filteredModels;
      if (!models.length) return null;
      let best: ModelRecord | null = null;
      for (const m of models) {
        if (m.intelligence != null) {
          if (!best || (best.intelligence != null && m.intelligence > best.intelligence)) {
            best = m;
          }
        }
      }
      return best;
    },

    get optimalModels(): ModelRecord[] {
      const self = this as any;
      const models: ModelRecord[] = self.filteredModels;
      if (self.modelsViewMode === 'plot') {
        return computeEfficiencyFrontier(models, self.costBasis);
      }
      if (self.modelsViewMode === 'timeline') {
        return computeSotaProgression(models);
      }
      return [];
    },

    get comparisonWinners(): Record<string, { iq: boolean; speed: boolean; cost: boolean; ttft: boolean }> {
      const self = this as any;
      const result: Record<string, { iq: boolean; speed: boolean; cost: boolean; ttft: boolean }> = {};
      const models: ModelRecord[] = self.comparedModels;
      if (!models || models.length < 2) return result;

      let bestIq = -Infinity;
      let bestSpeed = -Infinity;
      let bestCost = Infinity;
      let bestTtft = Infinity;

      let bestIqId = '';
      let bestSpeedId = '';
      let bestCostId = '';
      let bestTtftId = '';

      for (const m of models) {
        if (m.intelligence != null && m.intelligence > bestIq) {
          bestIq = m.intelligence;
          bestIqId = m.id;
        }
        if (m.speedTps != null && m.speedTps > bestSpeed) {
          bestSpeed = m.speedTps;
          bestSpeedId = m.id;
        }
        const cost = calculateModelCost(m, self.costBasis);
        if (cost != null && cost < bestCost) {
          bestCost = cost;
          bestCostId = m.id;
        }
        if (m.latencyTtft != null && m.latencyTtft < bestTtft) {
          bestTtft = m.latencyTtft;
          bestTtftId = m.id;
        }
      }

      for (const m of models) {
        result[m.id] = {
          iq: m.id === bestIqId && bestIq > -Infinity,
          speed: m.id === bestSpeedId && bestSpeed > -Infinity,
          cost: m.id === bestCostId && bestCost < Infinity,
          ttft: m.id === bestTtftId && bestTtft < Infinity,
        };
      }

      return result;
    },

    get estimatedRunCost(): string {
      const self = this as any;
      if (!self.inspectedModel) return '$0.00';
      let inputP = self.inspectedModel.price1mInput ?? 0;
      let outputP = self.inspectedModel.price1mOutput ?? 0;

      if (self.usePromptCaching && self.inspectedModel.price1mCacheRead) {
        inputP = self.inspectedModel.price1mCacheRead;
      }
      if (self.useBatchPricing && self.inspectedModel.price1mBatch) {
        inputP = self.inspectedModel.price1mBatch;
        outputP = outputP * 0.5;
      }

      if (self.inspectedModel.price1mInput === null && self.inspectedModel.price1mOutput === null) {
        return 'Free / Open Weight';
      }

      const cost = (self.calcInputTokens / 1_000_000) * inputP + (self.calcOutputTokens / 1_000_000) * outputP;
      if (cost < 0.0001) return '< $0.0001';
      return `$${cost.toFixed(4)}`;
    },

    get estimatedMonthlyCost(): string {
      const self = this as any;
      if (!self.inspectedModel) return '$0.00';
      let inputP = self.inspectedModel.price1mInput ?? 0;
      let outputP = self.inspectedModel.price1mOutput ?? 0;

      if (self.usePromptCaching && self.inspectedModel.price1mCacheRead) {
        inputP = self.inspectedModel.price1mCacheRead;
      }
      if (self.useBatchPricing && self.inspectedModel.price1mBatch) {
        inputP = self.inspectedModel.price1mBatch;
        outputP = outputP * 0.5;
      }

      if (self.inspectedModel.price1mInput === null && self.inspectedModel.price1mOutput === null) {
        return 'Free (Self-Hosted)';
      }

      const perReq = (self.calcInputTokens / 1_000_000) * inputP + (self.calcOutputTokens / 1_000_000) * outputP;
      const monthly = perReq * self.dailyRequests * 30;
      return `$${monthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    // ---------------------------------------------------- actions
    openModelDrawer(this: any, model: ModelRecord) {
      this.inspectedModel = model;
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        document.body.style.overflow = 'hidden';
      }
    },

    closeModelDrawer(this: any) {
      this.inspectedModel = null;
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    },

    applyWorkloadPreset(this: any, preset: 'chat' | 'agent' | 'rag' | 'batch') {
      if (preset === 'chat') {
        this.calcInputTokens = 1500;
        this.calcOutputTokens = 500;
      } else if (preset === 'agent') {
        this.calcInputTokens = 15000;
        this.calcOutputTokens = 2500;
      } else if (preset === 'rag') {
        this.calcInputTokens = 64000;
        this.calcOutputTokens = 3500;
      } else if (preset === 'batch') {
        this.calcInputTokens = 100000;
        this.calcOutputTokens = 10000;
      }
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

    toggleCompareModel(this: any, model: ModelRecord) {
      if (!model) return;
      const idx = this.comparedModelIds.indexOf(model.id);
      if (idx > -1) {
        this.comparedModelIds.splice(idx, 1);
      } else {
        if (this.comparedModelIds.length >= 4) {
          this.toast('You can compare up to 4 models simultaneously');
          return;
        }
        this.comparedModelIds.push(model.id);
        this.toast(`Added ${model.name} to comparison`);
      }
    },

    isModelCompared(this: any, model: ModelRecord) {
      return model ? this.comparedModelIds.includes(model.id) : false;
    },

    clearComparison(this: any) {
      this.comparedModelIds = [];
      this.toast('Comparison cleared');
    },

    loadMoreModels(this: any) {
      this.modelsPageSize = Infinity;
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
    },

    copyToClipboard(this: any, text: string, id: string) {
      const done = () => {
        this.copiedModelId = id;
        this.toast(`Copied "${text}"`);
        setTimeout(() => { if (this.copiedModelId === id) this.copiedModelId = null; }, 2000);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch { }
          ta.remove();
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch { }
        ta.remove();
      }
    },

    toggleTheme(this: any) {
      const isDark = document.documentElement.classList.toggle('dark');
      try { localStorage.setItem('bench-theme', isDark ? 'dark' : 'light'); } catch { }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', isDark ? '#09090b' : '#ffffff');
      }
      this.$nextTick(() => {
        this.mountCurrentChart();
      });
    },

    async syncModels(this: any) {
      if (this.syncing) return;
      this.syncing = true;
      this.syncProgress = 'Syncing models from Artificial Analysis via Cloudflare...';
      try {
        const models = await fetchAaModels();
        if (Array.isArray(models) && models.length > 0) {
          this.data.models = models;
          this.data.lastSyncedAt = Date.now();
          try {
            localStorage.setItem('bench-models', JSON.stringify(models));
            localStorage.setItem('bench-last-synced', String(this.data.lastSyncedAt));
          } catch (e) {
            console.warn('localStorage quota exceeded, skipping persist', e);
          }
          this.toast(`Synced ${models.length} models successfully!`);
          this.updateModelRows();
          this.$nextTick(() => { this.mountCurrentChart(); });
        } else {
          throw new Error('No models returned from Artificial Analysis.');
        }
      } catch (err: any) {
        console.error('Sync failed:', err);
        this.toast(err.message || 'Sync failed. Ensure AA_API_KEY is configured in Cloudflare.');
      } finally {
        this.syncing = false;
        this.syncProgress = '';
      }
    },

    resetToDefaultData(this: any) {
      this.data.models = defaultModels;
      this.data.lastSyncedAt = null;
      localStorage.removeItem('bench-models');
      localStorage.removeItem('bench-last-synced');
      this.updateModelRows();
      this.$nextTick(() => {
        this.mountCurrentChart();
      });
      this.toast(`Reset to default dataset (${defaultModels.length} models)`);
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

    fmtDate(ts: any) {
      return fmtDate(ts);
    },

    fmtDateTime(ts: any) {
      return fmtDateTime(ts);
    },

    fmtDateTimeCompact(ts: any) {
      return fmtDateTimeCompact(ts);
    },

    toast(this: any, msg: string) {
      this.toastMsg = msg;
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.toastMsg = '';
      }, 4000);
    },
  };
}
