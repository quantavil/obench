import type { ModelRecord, CostBasis } from '../types/model';

export function calculateModelCost(m: ModelRecord | null | undefined, costBasis: CostBasis = 'blended'): number | null {
  if (!m) return null;
  const inp = m.price1mInput;
  const out = m.price1mOutput;
  if (costBasis === 'input') return inp;
  if (costBasis === 'output') return out;
  if (costBasis === 'cached') {
    if (m.price1mCacheRead != null) return m.price1mCacheRead;
    return inp != null ? Math.round(inp * 0.25 * 100) / 100 : null;
  }
  if (costBasis === 'batch') {
    if (m.price1mBatch != null) return m.price1mBatch;
    // Batch API is documented as 50% discount on blended rate
    const blended = inp == null && out == null ? null : (3 * (inp ?? out ?? 0) + (out ?? inp ?? 0)) / 4;
    return blended != null ? Math.round(blended * 0.5 * 100) / 100 : null;
  }
  if (inp == null && out == null) return null;
  const i = inp ?? out ?? 0;
  const o = out ?? inp ?? 0;
  return (3 * i + o) / 4;
}

export function computeEfficiencyFrontier(models: ModelRecord[], costBasis: CostBasis = 'blended'): Array<ModelRecord & { cost: number; iqGain: number }> {
  const scored = (models || []).filter((m) => m && m.intelligence != null);
  if (!scored.length) return [];

  const withCost = scored
    .map((m) => {
      const costVal = calculateModelCost(m, costBasis);
      return { ...m, cost: costVal ?? 0, unpriced: costVal == null || costVal === 0 };
    })
    .filter((m) => !m.unpriced && m.cost > 0);

  // Sort cheapest first. If costs match, higher IQ first.
  const sorted = [...withCost].sort((a, b) => a.cost - b.cost || (b.intelligence ?? 0) - (a.intelligence ?? 0));
  const frontier: Array<ModelRecord & { cost: number; iqGain: number }> = [];
  let bestIq = -Infinity;

  for (const m of sorted) {
    const iq = m.intelligence ?? 0;
    if (iq > bestIq) {
      const prevIq = bestIq;
      bestIq = iq;
      frontier.push({
        ...m,
        iqGain: prevIq === -Infinity ? 0 : iq - prevIq,
      });
    }
  }

  return frontier;
}

export function computeSotaProgression(models: ModelRecord[]): Array<ModelRecord & { at: number; iqGain: number }> {
  const parsed = (models || [])
    .filter((m) => m && m.intelligence != null && m.releasedAt)
    .map((m) => {
      const direct = Date.parse(m.releasedAt!);
      let at = isNaN(direct) ? 0 : direct;
      if (!at) {
        const parts = String(m.releasedAt).split('-');
        const padded = parts.length === 1 ? `${parts[0]}-01-01` : parts.length === 2 ? `${parts[0]}-${parts[1]}-01` : null;
        at = padded ? Date.parse(padded) || 0 : 0;
      }
      return { ...m, at };
    })
    .filter((m) => m.at > 0)
    .sort((a, b) => a.at - b.at || (b.intelligence ?? 0) - (a.intelligence ?? 0));

  const peaks: Array<ModelRecord & { at: number; iqGain: number }> = [];
  let bestIq = -Infinity;

  for (const m of parsed) {
    const iq = m.intelligence ?? 0;
    if (iq > bestIq) {
      const prevIq = bestIq;
      bestIq = iq;
      peaks.push({
        ...m,
        iqGain: prevIq === -Infinity ? 0 : iq - prevIq,
      });
    }
  }

  return peaks;
}
