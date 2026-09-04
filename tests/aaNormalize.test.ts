import { test, expect } from 'bun:test';
import { normalizeAaRecords, normalizeAaRecordsWithReport } from '../src/utils/aaNormalize';

function aaRecord(id: string, overrides: Record<string, any> = {}) {
  const evaluations: Record<string, any> = {};
  if (overrides.intelligence !== undefined) {
    evaluations.artificial_analysis_intelligence_index = overrides.intelligence;
  } else if (overrides.evaluations?.artificial_analysis_intelligence_index !== undefined) {
    evaluations.artificial_analysis_intelligence_index = overrides.evaluations.artificial_analysis_intelligence_index;
  } else {
    evaluations.artificial_analysis_intelligence_index = 75;
  }
  return {
    id,
    name: id,
    model_creator: { name: 'Test Provider' },
    evaluations: {
      ...evaluations,
      ...overrides.evaluations,
    },
    ...overrides,
  };
}

test('skips malformed records and reports them', () => {
  const result = normalizeAaRecordsWithReport([null, aaRecord('valid')]);
  expect(result.models.map((model) => model.id)).toEqual(['valid']);
  expect(result.skippedRecords).toBe(1);
});

test('keeps missing telemetry unknown', () => {
  const [model] = normalizeAaRecords([aaRecord('sparse', { intelligence: 80 })]);
  expect(model.codingIndex).toBeNull();
  expect(model.mathIndex).toBeNull();
  expect(model.reasoningIndex).toBeNull();
  expect(model.contextWindow).toBeNull();
  expect(model.maxOutputTokens).toBeNull();
});

test('does not collapse distinct long model ids', () => {
  const prefix = 'a'.repeat(64);
  const models = normalizeAaRecords([aaRecord(`${prefix}x`), aaRecord(`${prefix}y`)]);
  expect(new Set(models.map((model) => model.id)).size).toBe(2);
});

test('normalizeAaRecords normalizes raw Artificial Analysis API records correctly with full schema', () => {
  const raw = [
    {
      id: 'claude-3-7-sonnet',
      name: 'Claude 3.7 Sonnet',
      model_creator: { name: 'Anthropic' },
      release_date: '2025-02-24',
      pricing: {
        price_1m_input_tokens: 3.0,
        price_1m_output_tokens: 15.0,
        price_1m_cache_read_tokens: 0.75,
        price_1m_batch_input_tokens: 1.5,
      },
      evaluations: {
        artificial_analysis_intelligence_index: 79.5,
        coding_index: 82.1,
        math_index: 78.4,
        reasoning_index: 81.0,
      },
      performance: {
        output_tokens_per_second: 65.4,
        time_to_first_token_seconds: 0.42,
      },
      limits: {
        max_context_window: 200000,
        max_output_tokens: 64000,
      },
      modalities: ['text', 'vision'],
      is_open_weights: false,
    },
    {
      slug: 'deepseek-r1',
      name: 'DeepSeek R1',
      creator: 'DeepSeek',
      release_date: '2025-01-20',
      pricing: {
        price_1m_input_tokens: 0.55,
        price_1m_output_tokens: 2.19,
      },
      evaluations: {
        artificial_analysis_intelligence_index: 76.8,
      },
    },
    {
      id: 'unranked-model',
      name: 'Unranked Model',
      evaluations: {},
    },
  ];

  const normalized = normalizeAaRecords(raw);

  expect(normalized.length).toBe(2);
  expect(normalized[0].id).toBe('claude-3-7-sonnet');
  expect(normalized[0].provider).toBe('Anthropic');
  expect(normalized[0].intelligence).toBe(79.5);
  expect(normalized[0].price1mInput).toBe(3.0);
  expect(normalized[0].price1mOutput).toBe(15.0);
  expect(normalized[0].price1mCacheRead).toBe(0.75);
  expect(normalized[0].price1mBatch).toBe(1.5);
  expect(normalized[0].speedTps).toBe(65.4);
  expect(normalized[0].latencyTtft).toBe(0.42);
  expect(normalized[0].contextWindow).toBe(200000);
  expect(normalized[0].codingIndex).toBe(82.1);
  expect(normalized[0].modalities).toEqual(['text', 'vision']);

  expect(normalized[1].id).toBe('deepseek-r1');
  expect(normalized[1].provider).toBe('DeepSeek');
  expect(normalized[1].intelligence).toBe(76.8);
  expect(normalized[1].isOpenWeights).toBe(true);
});

test('extracts detailed frontier evaluations, TTFAT, and derives benchmark fallbacks', () => {
  const raw = [
    {
      id: 'frontier-model',
      name: 'Frontier AI 1',
      model_creator: { name: 'FrontierLab' },
      release_date: '2025-06-01',
      median_time_to_first_answer_token: 12.456,
      median_time_to_first_token_seconds: 0.35,
      evaluations: {
        artificial_analysis_intelligence_index: 88.0,
        // Composite indices absent, should fall back to raw benchmarks
        livecodebench: 0.652,
        math_500: 0.914,
        gpqa: 0.738,
        hle: 0.154,
        scicode: 0.485,
        tau2: 0.521,
        terminalbench_hard: 0.285,
        ifbench: 0.774,
        lcr: 0.612,
        mmlu_pro: 0.812,
        aime_25: 0.850,
      },
    },
  ];

  const [model] = normalizeAaRecords(raw);
  expect(model).toBeDefined();
  expect(model.codingIndex).toBe(65.2); // derived from livecodebench * 100
  expect(model.mathIndex).toBe(85.0); // derived from aime_25 * 100
  expect(model.reasoningIndex).toBe(73.8); // derived from gpqa * 100
  expect(model.latencyTtfat).toBe(12.46);
  expect(model.evaluations).toEqual({
    gpqa: 0.738,
    hle: 0.154,
    scicode: 0.485,
    livecodebench: 0.652,
    math500: 0.914,
    aime25: 0.850,
    ifbench: 0.774,
    lcr: 0.612,
    tau2: 0.521,
    terminalbenchHard: 0.285,
    mmluPro: 0.812,
  });
});
