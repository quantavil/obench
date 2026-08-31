import type { ModelRecord, CostBasis } from '../types/model';
import { calculateModelCost } from '../utils/pricing';

export interface WinnerMetrics {
  iq: boolean;
  speed: boolean;
  cost: boolean;
  ttft: boolean;
}

export function comparisonWinners(
  models: ModelRecord[],
  costBasis: CostBasis = 'blended',
): Record<string, WinnerMetrics> {
  const result: Record<string, WinnerMetrics> = {};
  if (!models || models.length < 2) return result;

  for (const m of models) {
    result[m.id] = { iq: false, speed: false, cost: false, ttft: false };
  }

  let maxIq: number | null = null;
  let maxSpeed: number | null = null;
  let minCost: number | null = null;
  let minTtft: number | null = null;

  for (const m of models) {
    if (m.intelligence != null) {
      if (maxIq === null || m.intelligence > maxIq) {
        maxIq = m.intelligence;
      }
    }
    if (m.speedTps != null) {
      if (maxSpeed === null || m.speedTps > maxSpeed) {
        maxSpeed = m.speedTps;
      }
    }
    const cost = calculateModelCost(m, costBasis);
    if (cost != null) {
      if (minCost === null || cost < minCost) {
        minCost = cost;
      }
    }
    if (m.latencyTtft != null) {
      if (minTtft === null || m.latencyTtft < minTtft) {
        minTtft = m.latencyTtft;
      }
    }
  }

  for (const m of models) {
    const cost = calculateModelCost(m, costBasis);
    result[m.id] = {
      iq: maxIq !== null && m.intelligence !== null && m.intelligence === maxIq,
      speed: maxSpeed !== null && m.speedTps !== null && m.speedTps === maxSpeed,
      cost: minCost !== null && cost !== null && cost === minCost,
      ttft: minTtft !== null && m.latencyTtft !== null && m.latencyTtft === minTtft,
    };
  }

  return result;
}
