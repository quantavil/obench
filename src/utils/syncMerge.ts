// Shared merge for live AA sync results. Used by both the client store and the
// server (/api/sync + KV daily refresh) so OpenRouter-only models and previous
// benchmarks survive every synchronization.
import type { ModelRecord } from '../types/model';

/**
 * Fields where a live `null` means "not reported upstream" — the previous
 * value is kept so telemetry never regresses during a sync.
 */
const PRESERVED_FIELDS = [
  'codingIndex',
  'mathIndex',
  'reasoningIndex',
  'speedTps',
  'latencyTtft',
  'contextWindow',
  'maxOutputTokens',
  'price1mCacheRead',
  'price1mBatch',
] as const;

type Mergeable = Pick<ModelRecord, 'id'> & Partial<ModelRecord>;

export function mergeSyncedModels<T extends Mergeable>(prevModels: T[], freshModels: T[]): T[] {
  const prevById = new Map(prevModels.map((m) => [m.id, m]));

  const merged: T[] = freshModels.map((m) => {
    const prev = prevById.get(m.id);
    if (!prev) return m;
    const out = { ...m };
    for (const field of PRESERVED_FIELDS) {
      if (out[field] == null && prev[field] != null) {
        (out as Record<string, unknown>)[field] = prev[field];
      }
    }
    return out;
  });

  // Models absent from the live feed (OpenRouter-only, or dropped for missing
  // IQ) are preserved as-is instead of being silently deleted.
  const freshIds = new Set(freshModels.map((m) => m.id));
  for (const p of prevModels) {
    if (!freshIds.has(p.id)) merged.push(p);
  }

  return merged;
}
