// SVG Chart Renderers for Artificial Analysis Explorer (OpenRouter Style).
// Returns clean HTML strings for charts.

import { providerColor } from '../utils/providers';
import { fmtCost } from '../utils/formatters';
import { computeEfficiencyFrontier, computeSotaProgression, calculateModelCost } from '../utils/frontier';
import type { ModelRecord, CostBasis } from '../types/model';

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function esc(s: unknown): string {
  return String(s).replace(/[&<>"]/g, (c) => ESCAPES[c] || c);
}

// ─── shared plot pieces ──────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
  color?: string;
  lead?: boolean;
  faint?: boolean;
  title?: string;
  sub?: string;
  aria?: string;
}

// Nudge coincident points apart along a golden-angle spiral so none hides another.
function spread(points: Point[]): Point[] {
  const seen = new Map<string, number>();
  return points.map((p) => {
    const key = `${p.x.toFixed(1)}-${p.y.toFixed(1)}`;
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    if (!n) return p;
    const angle = n * 2.39996;
    const dist = 0.8 * Math.sqrt(n);
    return { ...p, x: clamp(p.x + Math.cos(angle) * dist), y: clamp(p.y + Math.sin(angle) * dist) };
  });
}

// `lead` marks a frontier/peak member, `faint` a low-confidence one.
function dot(p: Point): string {
  const cls = ['plot-dot', p.lead && 'plot-dot--lead', p.faint && 'plot-dot--faint'].filter(Boolean).join(' ');
  const tip = ['plot-tip', p.y > 74 && 'plot-tip--under', p.x < 15 && 'plot-tip--start', p.x > 85 && 'plot-tip--end']
    .filter(Boolean).join(' ');
  return `<div class="${cls}" style="left:${p.x.toFixed(2)}%;bottom:${p.y.toFixed(2)}%;--c:${p.color}" tabindex="0" role="img" aria-label="${esc(p.aria)}"><span class="${tip}"><b>${esc(p.title)}</b><i>${esc(p.sub)}</i></span></div>`;
}

// ticks are { pct, label }.
const hGrid = (ticks: Array<{ pct: number; label: string | number }>) => ticks.map((t) => `<u class="grid-h" style="bottom:${t.pct}%"><span>${t.label}</span></u>`).join('');
const vGrid = (ticks: Array<{ pct: number; label: string | number }>) => ticks.map((t, i) => `<u class="grid-v${i % 2 ? ' grid-v--wide' : ''}" style="left:${t.pct}%"><span>${t.label}</span></u>`).join('');

// A dashed polyline across the plot area in 0-100 space, plus a corner caption.
function trace(points: Point[], caption: string): string {
  if (points.length < 2) return '';
  const pts = points.map((p) => `${p.x.toFixed(2)},${(100 - p.y).toFixed(2)}`).join(' ');
  return `<svg class="plot-trace" preserveAspectRatio="none" viewBox="0 0 100 100"><polyline points="${pts}"/></svg><span class="plot-note">${caption}</span>`;
}

// The frame every scatter-style chart shares.
function plot({ yLabel, xLabel, h, v, points, overlay = '' }: { yLabel: string; xLabel: string; h: Array<{ pct: number; label: string | number }>; v: Array<{ pct: number; label: string | number }>; points: Point[]; overlay?: string }): string {
  const dots = spread(points).map(dot).join('');
  return `<div class="plot"><div class="plot-body"><span class="plot-ylabel">${yLabel}</span><div class="plot-area">${hGrid(h)}${vGrid(v)}${overlay}${dots}</div></div><span class="plot-xlabel">${xLabel}</span></div>`;
}

const empty = (msg: string) => `<p class="plot-empty">${msg}</p>`;

// Auto-scaled 0-100 axis padded to clean multiples of 5.
function scale(values: number[]) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || 10) * 0.12;
  let min = Math.floor((lo - pad) / 5) * 5;
  let max = Math.ceil((hi + pad) / 5) * 5;
  if (min === max) { min -= 5; max += 5; }
  min = Math.max(0, min);
  max = Math.min(100, max);
  const range = max - min;
  const step = range <= 20 ? 5 : range <= 50 ? 10 : 20;
  const ticks: Array<{ pct: number; label: number }> = [];
  for (let v = min; v <= max; v += step) ticks.push({ pct: ((v - min) / range) * 100, label: v });
  return { ticks, at: (v: number) => clamp(((v - min) / range) * 100) };
}

// ─── intelligence vs cost ────────────────────────────────────────────────────

const COST_TICKS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100];

export function renderIntelligenceCostChart(models: ModelRecord[], costBasis: CostBasis = 'blended'): string {
  const scored = (models || []).filter((m) => m && m.intelligence != null);
  if (!scored.length) return empty('No models match your filters, or none have intelligence data.');

  const withCost = scored.map((m) => {
    const costVal = calculateModelCost(m, costBasis);
    return { ...m, cost: costVal ?? 0, unpriced: costVal == null };
  });

  // Log X axis over the cost decades actually present.
  const costs = withCost.map((m) => m.cost).filter((c) => c > 0);
  const minCost = costs.length ? Math.min(...costs) : 0.1;
  const maxCost = costs.length ? Math.max(...costs) : 10;
  const minTick = minCost >= 0.5 ? 0.1 : 0.01;
  const maxTick = maxCost <= 2 ? 5 : maxCost <= 8 ? 10 : maxCost <= 40 ? 50 : 100;
  const minLog = Math.log10(minTick);
  const logSpan = Math.log10(maxTick) - minLog || 1;
  const atCost = (c: number) => clamp(((Math.log10(Math.max(minTick, c)) - minLog) / logSpan) * 100);

  const y = scale(withCost.map((m) => m.intelligence!));

  // Pareto frontier calculation from shared helper
  const frontier = computeEfficiencyFrontier(models, costBasis);
  const onFrontier = new Set(frontier.map((m) => m.id));

  const points: Point[] = withCost.map((m) => {
    const price = m.unpriced ? 'Unpriced' : `${fmtCost(m.cost)}/1M`;
    const detail = !m.unpriced && m.price1mInput != null && m.price1mOutput != null
      ? ` · in $${m.price1mInput} / out $${m.price1mOutput}` : '';
    return {
      x: atCost(m.cost),
      y: y.at(m.intelligence!),
      color: providerColor(m.provider),
      lead: onFrontier.has(m.id),
      title: `${m.name} (${m.provider})`,
      sub: `IQ ${m.intelligence} · ${price}${detail}`,
      aria: `${m.name} (${m.provider}): IQ ${m.intelligence}, ${price}`,
    };
  });

  return plot({
    yLabel: 'Intelligence Index',
    xLabel: 'Cost per 1M tokens ($, log scale)',
    h: y.ticks,
    v: COST_TICKS.filter((t) => t >= minTick && t <= maxTick).map((t) => ({ pct: atCost(t), label: `$${t}` })),
    points,
    overlay: trace(frontier.map((m) => ({ x: atCost(m.cost), y: y.at(m.intelligence!) })), 'Efficiency frontier'),
  });
}

// ─── intelligence vs release date ────────────────────────────────────────────

function parseReleased(value: string | null | undefined): number | null {
  if (!value) return null;
  const direct = Date.parse(value);
  if (!isNaN(direct)) return direct;
  const parts = String(value).split('-');
  const padded = parts.length === 1 ? `${parts[0]}-01-01` : parts.length === 2 ? `${parts[0]}-${parts[1]}-01` : null;
  const fallback = padded ? Date.parse(padded) : NaN;
  return isNaN(fallback) ? null : fallback;
}

export function renderIntelligenceTimelineChart(models: ModelRecord[]): string {
  const parsed = (models || [])
    .filter((m) => m && m.intelligence != null && m.releasedAt)
    .map((m) => ({ ...m, at: parseReleased(m.releasedAt) }))
    .filter((m): m is ModelRecord & { at: number } => m.at != null)
    .sort((a, b) => a.at - b.at);

  if (!parsed.length) return empty('No models match your filters, or none have release dates.');

  const span = (parsed[parsed.length - 1].at - parsed[0].at) || 30 * 24 * 3600 * 1000;
  const minTime = parsed[0].at - span * 0.05;
  const fullSpan = span * 1.1 || 1;
  const atTime = (t: number) => clamp(((t - minTime) / fullSpan) * 100);

  const y = scale(parsed.map((m) => m.intelligence!));

  // Running best-so-far: the SOTA staircase via shared helper.
  const peaks = computeSotaProgression(models);
  const isPeak = new Set(peaks.map((m) => m.id));

  const v = Array.from({ length: 5 }, (_, i) => ({
    pct: (i / 4) * 100,
    label: new Date(minTime + (fullSpan * i) / 4).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
  }));

  const points: Point[] = parsed.map((m) => ({
    x: atTime(m.at),
    y: y.at(m.intelligence!),
    color: providerColor(m.provider),
    lead: isPeak.has(m.id),
    title: `${m.name} (${m.provider})`,
    sub: `IQ ${m.intelligence} · ${m.releasedAt}`,
    aria: `${m.name} (${m.provider}): IQ ${m.intelligence}, released ${m.releasedAt}`,
  }));

  return plot({
    yLabel: 'Intelligence Index',
    xLabel: 'Release date',
    h: y.ticks,
    v,
    points,
    overlay: trace(peaks.map((m) => ({ x: atTime(m.at), y: y.at(m.intelligence!) })), 'SOTA progression'),
  });
}
