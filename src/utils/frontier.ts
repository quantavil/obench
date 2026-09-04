import type { ModelRecord, CostBasis } from '../types/model';
import { calculateModelCost } from './pricing';

export { calculateModelCost };

/** Parse 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' release strings to a timestamp (0 when unparseable). */
export function parseReleaseTs(releasedAt: string): number {
  const direct = Date.parse(releasedAt);
  if (!isNaN(direct) && direct > 0) return direct;
  const parts = String(releasedAt).split('-');
  const padded = parts.length === 1 ? `${parts[0]}-01-01` : parts.length === 2 ? `${parts[0]}-${parts[1]}-01` : null;
  return padded ? Date.parse(padded) || 0 : 0;
}

export function computeEfficiencyFrontier(
  models: ModelRecord[],
  costBasis: CostBasis = 'blended',
): Array<ModelRecord & { cost: number; iqGain: number }> {
  const scored = (models || []).filter((m) => m && m.intelligence != null);
  if (!scored.length) return [];

  const withCost = scored
    .map((m) => {
      const costVal = calculateModelCost(m, costBasis);
      return { ...m, cost: costVal };
    })
    // 0 and null both render as -- and must be excluded from IQ vs Cost
    .filter((m): m is ModelRecord & { cost: number } => m.cost !== null && m.cost > 0);

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
    .map((m) => ({ ...m, at: parseReleaseTs(m.releasedAt!) }))
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
