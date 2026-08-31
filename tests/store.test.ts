import { test, expect } from 'bun:test';
import { bench } from '../src/store/appStore';
import type { ModelRecord } from '../src/types/model';

test('bench store initial state has default models, table view, empty comparedModelIds, and hidden VS column', () => {
  const store = bench();
  expect(Array.isArray(store.data.models)).toBe(true);
  expect(store.data.models.length).toBeGreaterThan(0);
  expect(store.tab).toBe('models');
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
