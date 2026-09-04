import { describe, test, expect } from 'bun:test';
import { mergeSyncedModels } from '../src/utils/syncMerge';
import type { ModelRecord } from '../src/types/model';

describe('syncMerge > mergeSyncedModels', () => {
  test('preserves OpenRouter-only models absent from upstream live sync', () => {
    const existing: ModelRecord[] = [
      { id: 'aa-model-1', name: 'AA Model 1', provider: 'OpenAI', intelligence: 85 } as ModelRecord,
      { id: 'or-only-model', name: 'OR Only Model', provider: 'Community', intelligence: null, price1mInput: 0.2 } as ModelRecord,
    ];

    const fresh: ModelRecord[] = [
      { id: 'aa-model-1', name: 'AA Model 1 Updated', provider: 'OpenAI', intelligence: 88 } as ModelRecord,
      { id: 'aa-model-2', name: 'AA Model 2 New', provider: 'Anthropic', intelligence: 90 } as ModelRecord,
    ];

    const merged = mergeSyncedModels(existing, fresh);

    expect(merged.length).toBe(3);
    expect(merged.find((m) => m.id === 'or-only-model')).toBeDefined();
    expect(merged.find((m) => m.id === 'aa-model-1')?.intelligence).toBe(88);
    expect(merged.find((m) => m.id === 'aa-model-2')?.intelligence).toBe(90);
  });

  test('preserves prior telemetry fields when live sync reports null', () => {
    const existing: ModelRecord[] = [
      {
        id: 'model-1',
        name: 'Model 1',
        provider: 'OpenAI',
        intelligence: 80,
        codingIndex: 78,
        mathIndex: 82,
        reasoningIndex: 81,
        speedTps: 110,
        latencyTtft: 0.45,
        contextWindow: 128000,
        maxOutputTokens: 8192,
        price1mCacheRead: 0.5,
        price1mBatch: 1.0,
      } as ModelRecord,
    ];

    const fresh: ModelRecord[] = [
      {
        id: 'model-1',
        name: 'Model 1',
        provider: 'OpenAI',
        intelligence: 84, // updated intelligence
        codingIndex: null, // live missing
        mathIndex: null, // live missing
        reasoningIndex: null,
        speedTps: null,
        latencyTtft: null,
        contextWindow: null,
        maxOutputTokens: null,
        price1mCacheRead: null,
        price1mBatch: null,
      } as ModelRecord,
    ];

    const merged = mergeSyncedModels(existing, fresh);

    expect(merged.length).toBe(1);
    const m = merged[0];
    expect(m.intelligence).toBe(84);
    expect(m.codingIndex).toBe(78);
    expect(m.mathIndex).toBe(82);
    expect(m.reasoningIndex).toBe(81);
    expect(m.speedTps).toBe(110);
    expect(m.latencyTtft).toBe(0.45);
    expect(m.contextWindow).toBe(128000);
    expect(m.maxOutputTokens).toBe(8192);
    expect(m.price1mCacheRead).toBe(0.5);
    expect(m.price1mBatch).toBe(1.0);
  });

  test('preserves pricing, latencyTtfat, and merges nested evaluations', () => {
    const existing: ModelRecord[] = [
      {
        id: 'r1',
        name: 'DeepSeek R1',
        provider: 'DeepSeek',
        intelligence: 85,
        price1mInput: 0.55,
        price1mOutput: 2.19,
        latencyTtfat: 15.2,
        contextWindow: 128000,
        modalities: ['text', 'vision'],
        evaluations: {
          hle: 0.25,
          gpqa: 0.71,
          tau2: 0.45,
        },
      } as ModelRecord,
    ];

    const fresh: ModelRecord[] = [
      {
        id: 'r1',
        name: 'DeepSeek R1',
        provider: 'DeepSeek',
        intelligence: 86,
        price1mInput: null, // live null pricing should preserve existing
        price1mOutput: null,
        latencyTtfat: null,
        contextWindow: null, // live null context should preserve existing
        modalities: ['text'],
        evaluations: {
          gpqa: 0.74, // updated GPQA
          livecodebench: 0.68, // newly reported benchmark
        },
      } as ModelRecord,
    ];

    const merged = mergeSyncedModels(existing, fresh);
    const m = merged[0];
    expect(m.price1mInput).toBe(0.55);
    expect(m.price1mOutput).toBe(2.19);
    expect(m.contextWindow).toBe(128000);
    expect(m.latencyTtfat).toBe(15.2);
    expect(m.modalities).toEqual(['text', 'vision']);
    expect(m.evaluations).toEqual({
      hle: 0.25, // preserved
      gpqa: 0.74, // updated
      tau2: 0.45, // preserved
      livecodebench: 0.68, // added
    });
  });
});
