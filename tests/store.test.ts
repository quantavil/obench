import { test, expect } from 'bun:test';
import { bench } from '../src/store/appStore';
import { calculateModelCost } from '../src/utils/pricing';
import { comparisonWinners } from '../src/store/compare';
import type { ModelRecord } from '../src/types/model';

function pricedModel(overrides: Partial<ModelRecord> = {}): ModelRecord {
  return {
    id: 'test-model',
    name: 'Test Model',
    provider: 'Test Provider',
    releasedAt: '2025-01-01',
    price1mInput: 1.0,
    price1mOutput: 2.0,
    price1mCacheRead: null,
    price1mBatch: null,
    intelligence: 80,
    codingIndex: 75,
    mathIndex: 75,
    reasoningIndex: 75,
    speedTps: 100,
    latencyTtft: 0.5,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    modalities: ['text'],
    isOpenWeights: false,
    ...overrides,
  };
}

test('batch effective cost uses discounted input and output consistently', () => {
  const model = pricedModel({ price1mInput: 2, price1mOutput: 10, price1mBatch: 1 });
  expect(calculateModelCost(model, 'batch')).toBe(2);
});

test('comparison marks every tied model as a winner', () => {
  const winners = comparisonWinners([pricedModel({ id: 'a' }), pricedModel({ id: 'b' })], 'blended');
  expect(winners.a.iq).toBe(true);
  expect(winners.b.iq).toBe(true);
});

test('comparison requires two selected models', () => {
  const store = bench();
  store.comparedModelIds = ['only'];
  store.applyComparison();
  expect(store.modelsViewMode).toBe('table');
  expect(store.toastMsg).toContain('at least 2');
});

test('bench store initial state has default models, table view, empty comparedModelIds, and hidden VS column', () => {
  const store = bench();
  expect(Array.isArray(store.data.models)).toBe(true);
  expect(store.data.models.length).toBeGreaterThan(0);
  expect(store.modelsViewMode).toBe('table');
  expect(store.showCompareCol).toBe(false);
  expect(store.comparedModelIds).toEqual([]);

  store.toggleCompareCol();
  expect(store.showCompareCol).toBe(true);

  store.toggleCompareCol();
  expect(store.showCompareCol).toBe(false);
});

test('bench store model filtering and search', () => {
  const store = bench();
  store.data.models = [
    { id: 'm1', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', intelligence: 78, price1mInput: 3.0, price1mOutput: 15.0, modalities: ['vision'] } as ModelRecord,
    { id: 'm2', name: 'DeepSeek R1', provider: 'DeepSeek', intelligence: 75, price1mInput: 0.55, price1mOutput: 2.19, speedTps: 120 } as ModelRecord,
    { id: 'm3', name: 'Free Model', provider: 'OpenSource', intelligence: 50, price1mInput: 0, price1mOutput: 0, isOpenWeights: true } as ModelRecord,
    { id: 'm4', name: 'Gemini 2.0 Flash Thinking', provider: 'Google', intelligence: 79, price1mInput: 0.1, price1mOutput: 0.4, modalities: ['vision'], contextWindow: 1000000 } as ModelRecord,
  ];

  store.updateModelRows();
  expect(store.rankedModelsByIntelligence.length).toBe(4);
  expect(store.rankedModelsByIntelligence[0].model.id).toBe('m4');

  // Search filter
  store.search = 'deepseek';
  store.updateModelRows();
  expect(store.rankedModelsByIntelligence.length).toBe(1);
  expect(store.rankedModelsByIntelligence[0].model.id).toBe('m2');

  // Provider filter
  store.search = '';
  store.selectedModelProviders = ['Anthropic'];
  store.updateModelRows();
  expect(store.rankedModelsByIntelligence.length).toBe(1);
  expect(store.rankedModelsByIntelligence[0].model.id).toBe('m1');

  // Price range filter
  store.selectedModelProviders = [];
  store.selectedPriceRanges = ['free'];
  store.updateModelRows();
  expect(store.rankedModelsByIntelligence.length).toBe(1);
  expect(store.rankedModelsByIntelligence[0].model.id).toBe('m3');

  // Capability filter: Reasoning (should include both text and multimodal reasoning models like m2 and m4)
  store.selectedPriceRanges = [];
  store.selectedCapability = 'reasoning';
  store.updateModelRows();
  const reasoningIds = store.rankedModelsByIntelligence.map((r: any) => r.model.id);
  expect(reasoningIds).toContain('m2');
  expect(reasoningIds).toContain('m4');

  // Capability filter: Vision
  store.selectedCapability = 'vision';
  store.updateModelRows();
  const visionIds = store.rankedModelsByIntelligence.map((r: any) => r.model.id);
  expect(visionIds).toContain('m1');
  expect(visionIds).toContain('m4');

  // Capability filter: Long Context
  store.selectedCapability = 'long-ctx';
  store.updateModelRows();
  expect(store.rankedModelsByIntelligence.length).toBe(1);
  expect(store.rankedModelsByIntelligence[0].model.id).toBe('m4');
});

test('table sorting toggles work correctly', () => {
  const store = bench();
  store.data.models = [
    { id: 'm1', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', intelligence: 78, speedTps: 80, price1mInput: 3.0, price1mOutput: 15.0 } as ModelRecord,
    { id: 'm2', name: 'DeepSeek R1', provider: 'DeepSeek', intelligence: 75, speedTps: 150, price1mInput: 0.55, price1mOutput: 2.19 } as ModelRecord,
  ];

  store.toggleSort('iq');
  expect(store.sortBy).toBe('iq-asc');
  expect(store.getSortIcon('iq')).toBe('↑');

  store.toggleSort('iq');
  expect(store.sortBy).toBe('iq-desc');
  expect(store.getSortIcon('iq')).toBe('↓');

  store.toggleSort('speed');
  expect(store.sortBy).toBe('speed-desc');
  expect(store.getSortIcon('speed')).toBe('↓');

  store.toggleSort('blended');
  expect(store.sortBy).toBe('price-asc');
  expect(store.getSortIcon('blended')).toBe('↑');
});

test('side-by-side comparison winner metrics calculation', () => {
  const store = bench();
  const m1 = { id: 'm1', name: 'Model 1', provider: 'P1', intelligence: 85, speedTps: 50, price1mInput: 5.0, price1mOutput: 15.0, latencyTtft: 0.8 } as ModelRecord;
  const m2 = { id: 'm2', name: 'Model 2', provider: 'P2', intelligence: 70, speedTps: 120, price1mInput: 0.5, price1mOutput: 1.5, latencyTtft: 0.3 } as ModelRecord;
  store.data.models = [m1, m2];
  store.comparedModelIds = ['m1', 'm2'];

  const winners = store.comparisonWinners;
  expect(winners['m1'].iq).toBe(true);
  expect(winners['m2'].iq).toBe(false);

  expect(winners['m2'].speed).toBe(true);
  expect(winners['m1'].speed).toBe(false);

  expect(winners['m2'].cost).toBe(true);
  expect(winners['m1'].cost).toBe(false);

  expect(winners['m2'].ttft).toBe(true);
  expect(winners['m1'].ttft).toBe(false);
});

test('token cost estimator calculation', () => {
  const store = bench();
  store.inspectedModel = { id: 'test', name: 'Test', provider: 'Test', price1mInput: 2.0, price1mOutput: 10.0, intelligence: 80 } as ModelRecord;
  store.calcInputTokens = 1000000;
  store.calcOutputTokens = 1000000;
  expect(store.estimatedRunCost).toBe('$12.0000');
});

test('sorting by max-output-desc places largest output models first', () => {
  const store = bench();
  store.data.models = [
    { id: 'small', name: 'Small Out', provider: 'P1', maxOutputTokens: 4096 } as ModelRecord,
    { id: 'huge', name: 'Huge Out', provider: 'P2', maxOutputTokens: 131072 } as ModelRecord,
    { id: 'mid', name: 'Mid Out', provider: 'P3', maxOutputTokens: 16384 } as ModelRecord,
  ];
  store.sortBy = 'max-output-desc';
  store.updateModelRows();
  expect(store.rankedModelsByIntelligence.map((r: any) => r.model.id)).toEqual(['huge', 'mid', 'small']);
});

test('bench store init heals stale localStorage models missing contextWindow or maxOutputTokens', async () => {
  const store = bench();
  const storage = new Map<string, string>();
  const origStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  } as any;

  // Simulate stale cached localStorage with null limits
  const staleModels = [
    { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', contextWindow: null, maxOutputTokens: null },
  ];
  storage.set('bench-models', JSON.stringify(staleModels));

  // Stub fetch so it returns 404/500 like dev server offline
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false }), { status: 500 })) as any;

  try {
    await store.init();
    const healed = store.data.models.find((m: any) => m.id === 'claude-3-7-sonnet');
    expect(healed).toBeDefined();
    // Default models should have healed contextWindow and maxOutputTokens!
    expect(healed?.contextWindow).toBeGreaterThan(0);
    expect(healed?.maxOutputTokens).toBeGreaterThan(0);
  } finally {
    globalThis.fetch = origFetch;
    globalThis.localStorage = origStorage;
  }
});
