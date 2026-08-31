import { test, expect } from 'bun:test';
import { bench } from '../src/store/appStore';
import type { ModelRecord } from '../src/types/model';

test('bench store initial state has default models and table view', () => {
  const store = bench();
  expect(Array.isArray(store.data.models)).toBe(true);
  expect(store.data.models.length).toBeGreaterThan(0);
  expect(store.tab).toBe('models');
  expect(store.modelsViewMode).toBe('table');
});

test('bench store model filtering and search', () => {
  const store = bench();
  store.data.models = [
    { id: 'm1', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', intelligence: 78, price1mInput: 3.0, price1mOutput: 15.0 } as ModelRecord,
    { id: 'm2', name: 'DeepSeek R1', provider: 'DeepSeek', intelligence: 75, price1mInput: 0.55, price1mOutput: 2.19 } as ModelRecord,
    { id: 'm3', name: 'Free Model', provider: 'OpenSource', intelligence: 50, price1mInput: 0, price1mOutput: 0 } as ModelRecord,
  ];

  store.updateModelRows();
  expect(store.rankedModelsByIntelligence.length).toBe(3);
  expect(store.rankedModelsByIntelligence[0].model.id).toBe('m1');

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
});

test('token cost estimator calculation', () => {
  const store = bench();
  store.inspectedModel = { id: 'test', name: 'Test', provider: 'Test', price1mInput: 2.0, price1mOutput: 10.0, intelligence: 80 } as ModelRecord;
  store.calcInputTokens = 1000000;
  store.calcOutputTokens = 1000000;
  expect(store.estimatedRunCost).toBe('$12.0000');
});
