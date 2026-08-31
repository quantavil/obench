import { describe, expect, test } from 'bun:test';
import { computeEfficiencyFrontier, computeSotaProgression } from '../src/utils/frontier';
import type { ModelRecord } from '../src/types/model';

describe('computeEfficiencyFrontier', () => {
  test('returns empty when no intelligence index', () => {
    expect(computeEfficiencyFrontier([])).toEqual([]);
    expect(
      computeEfficiencyFrontier([
        { id: 'm1', name: 'Model 1', provider: 'OpenAI', intelligence: null, price1mInput: 1.0, price1mOutput: 2.0 } as ModelRecord,
      ]),
    ).toEqual([]);
  });

  test('frontier includes only non-dominated models by cost vs IQ', () => {
    const models: ModelRecord[] = [
      { id: 'm1', name: 'Model A', provider: 'OpenAI', intelligence: 80, price1mInput: 1.0, price1mOutput: 3.0 } as ModelRecord,
      { id: 'm2', name: 'Model B', provider: 'Anthropic', intelligence: 90, price1mInput: 5.0, price1mOutput: 15.0 } as ModelRecord,
      { id: 'm3', name: 'Model C', provider: 'Google', intelligence: 75, price1mInput: 2.0, price1mOutput: 6.0 } as ModelRecord,
      { id: 'm4', name: 'Model D', provider: 'Meta', intelligence: 82, price1mInput: null, price1mOutput: null } as ModelRecord,
    ];
    const frontier = computeEfficiencyFrontier(models, 'blended');
    // D is unpriced (cost 0) with 82 IQ dominates A (80 IQ at $1.5), so frontier is D -> B
    expect(frontier.length).toBe(2);
    expect(frontier.map((m) => m.name)).toEqual(['Model D', 'Model B']);
    expect(frontier.map((m) => m.name)).not.toContain('Model A');
    expect(frontier.map((m) => m.name)).not.toContain('Model C');
  });

  test('frontier keeps only non-dominated models', () => {
    const models: ModelRecord[] = [
      { id: 'cheap', name: 'Cheap', provider: 'OpenAI', intelligence: 60, price1mInput: 1, price1mOutput: 1 } as ModelRecord,
      { id: 'mid', name: 'Mid', provider: 'Google', intelligence: 55, price1mInput: 4, price1mOutput: 4 } as ModelRecord,
      { id: 'smart', name: 'Smart', provider: 'Anthropic', intelligence: 90, price1mInput: 9, price1mOutput: 9 } as ModelRecord,
      { id: 'waste', name: 'Waste', provider: 'Meta', intelligence: 70, price1mInput: 20, price1mOutput: 20 } as ModelRecord,
    ];
    expect(computeEfficiencyFrontier(models, 'blended').map((m) => m.name).sort()).toEqual(['Cheap', 'Smart']);
  });

  test('respects costBasis parameter', () => {
    const models: ModelRecord[] = [
      { id: 'a', name: 'A', provider: 'OpenAI', intelligence: 70, price1mInput: 1, price1mOutput: 10, price1mCacheRead: 0.2 } as ModelRecord,
      { id: 'b', name: 'B', provider: 'Anthropic', intelligence: 80, price1mInput: 5, price1mOutput: 5, price1mCacheRead: 1 } as ModelRecord,
    ];
    const byInput = computeEfficiencyFrontier(models, 'input');
    const byOutput = computeEfficiencyFrontier(models, 'output');
    expect(byInput.length).toBeGreaterThan(0);
    expect(byOutput.length).toBeGreaterThan(0);
  });
});

describe('computeSotaProgression', () => {
  test('returns empty when no release dates', () => {
    expect(computeSotaProgression([])).toEqual([]);
    expect(
      computeSotaProgression([
        { id: 'm1', name: 'Model 1', provider: 'OpenAI', intelligence: 80, releasedAt: null } as ModelRecord,
      ]),
    ).toEqual([]);
  });

  test('builds staircase of record-breaking models oldest first', () => {
    const models: ModelRecord[] = [
      { id: 'm1', name: 'GPT-4', provider: 'OpenAI', intelligence: 70, releasedAt: '2023-03-14' } as ModelRecord,
      { id: 'm2', name: 'Claude 3 Opus', provider: 'Anthropic', intelligence: 78, releasedAt: '2024-03-04' } as ModelRecord,
      { id: 'm3', name: 'Gemini 1.5 Pro', provider: 'Google', intelligence: 76, releasedAt: '2024-02-15' } as ModelRecord,
      { id: 'm4', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', intelligence: 88, releasedAt: '2024-06-20' } as ModelRecord,
    ];
    const sota = computeSotaProgression(models);
    expect(sota.map((m) => m.name)).toEqual(['GPT-4', 'Gemini 1.5 Pro', 'Claude 3 Opus', 'Claude 3.5 Sonnet']);
    // each step strictly increases
    for (let i = 1; i < sota.length; i++) expect(sota[i].intelligence! > sota[i - 1].intelligence!);
  });

  test('tolerates year-only and year-month release dates', () => {
    const models: ModelRecord[] = [
      { id: 'a', name: 'Old', provider: 'OpenAI', intelligence: 40, releasedAt: '2023' } as ModelRecord,
      { id: 'b', name: 'Newer', provider: 'Google', intelligence: 60, releasedAt: '2024-06' } as ModelRecord,
    ];
    expect(computeSotaProgression(models).map((m) => m.name)).toEqual(['Old', 'Newer']);
  });

  test('dominated intermediate models are excluded', () => {
    const models: ModelRecord[] = [
      { id: 'a', name: 'A', provider: 'OpenAI', intelligence: 50, releasedAt: '2023-01-01' } as ModelRecord,
      { id: 'b', name: 'B', provider: 'Google', intelligence: 45, releasedAt: '2023-06-01' } as ModelRecord,
      { id: 'c', name: 'C', provider: 'Anthropic', intelligence: 80, releasedAt: '2024-01-01' } as ModelRecord,
    ];
    expect(computeSotaProgression(models).map((m) => m.name)).toEqual(['A', 'C']);
  });
});
