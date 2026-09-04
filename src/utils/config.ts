// Static configuration for OBench (OpenRouter-inspired Artificial Analysis Explorer).
import type { ModelViewMode, PlotMetricMode, PriceRangePreset, CostBasis, WorkloadPreset } from '../types/model';

export const MODEL_VIEW_MODES: Array<{ id: ModelViewMode; label: string; icon: string; panelId: string }> = [
  { id: 'table', label: 'Table', icon: 'icon-list', panelId: 'panel-table' },
  { id: 'plot', label: 'Scatter Plots', icon: 'icon-plot', panelId: 'panel-plot' },
  { id: 'timeline', label: 'SOTA Timeline', icon: 'icon-calendar', panelId: 'panel-plot' },
];

export const PLOT_METRIC_MODES: Array<{ id: PlotMetricMode; label: string }> = [
  { id: 'iq-cost', label: 'Quality vs Cost ($)' },
  { id: 'iq-speed', label: 'Quality vs Speed (TPS)' },
  { id: 'ttft-speed', label: 'Latency (TTFT) vs Speed' },
];

export const SORT_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'iq-desc', label: 'Intelligence (High to Low)' },
  { id: 'iq-asc', label: 'Intelligence (Low to High)' },
  { id: 'speed-desc', label: 'Output Speed (Highest TPS)' },
  { id: 'speed-asc', label: 'Output Speed (Lowest TPS)' },
  { id: 'ttft-asc', label: 'Latency (Fastest TTFT)' },
  { id: 'coding-desc', label: 'Coding Benchmark (High to Low)' },
  { id: 'price-asc', label: 'Blended Price (Lowest to Highest)' },
  { id: 'price-desc', label: 'Blended Price (Highest to Lowest)' },
  { id: 'prompt-asc', label: 'Prompt Price (Lowest first)' },
  { id: 'prompt-desc', label: 'Prompt Price (Highest first)' },
  { id: 'output-asc', label: 'Output Price (Lowest first)' },
  { id: 'output-desc', label: 'Output Price (Highest first)' },
  { id: 'context-desc', label: 'Context Window (Largest)' },
  { id: 'max-output-desc', label: 'Max Output Tokens (Largest)' },
  { id: 'name-asc', label: 'Name (A to Z)' },
  { id: 'name-desc', label: 'Name (Z to A)' },
  { id: 'date-desc', label: 'Release Date (Newest)' },
];

/**
 * Single source of truth for sortable table columns: `asc`/`desc` give the
 * sortBy ids (null = column has no ascending variant), `fallback` is restored
 * when toggling past the end. Drives toggleSort, getAriaSort and getSortIcon
 * so they can never drift apart.
 */
export const SORT_COLUMN_MAP: Record<string, { asc: string | null; desc: string; initial?: 'asc' | 'desc'; fallback?: string }> = {
  iq: { asc: 'iq-asc', desc: 'iq-desc', initial: 'desc' },
  speed: { asc: 'speed-asc', desc: 'speed-desc', initial: 'desc' },
  coding: { asc: null, desc: 'coding-desc', initial: 'desc', fallback: 'iq-desc' },
  context: { asc: null, desc: 'context-desc', initial: 'desc', fallback: 'iq-desc' },
  prompt: { asc: 'prompt-asc', desc: 'prompt-desc', initial: 'asc' },
  output: { asc: 'output-asc', desc: 'output-desc', initial: 'asc' },
  blended: { asc: 'price-asc', desc: 'price-desc', initial: 'asc' },
  name: { asc: 'name-asc', desc: 'name-desc', initial: 'asc', fallback: 'iq-desc' },
};

export const PRICE_RANGES: PriceRangePreset[] = [
  { id: 'free', label: 'Free ($0.00)', min: 0, max: 0 },
  { id: 'budget', label: 'Budget (≤ $1.00)', min: 0.01, max: 1.00 },
  { id: 'mid', label: 'Mid-Range ($1.00 – $5.00)', min: 1.00, max: 5.00 },
  { id: 'high', label: 'Premium ($5.00 – $15.00)', min: 5.00, max: 15.00 },
  { id: 'flagship', label: 'Flagship ($15.00+)', min: 15.00, max: Infinity },
  { id: 'custom', label: 'Custom Range...', min: null, max: null },
];

export const CAPABILITY_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All Capabilities' },
  { id: 'reasoning', label: 'Reasoning / Thinking' },
  { id: 'vision', label: 'Vision / Multimodal' },
  { id: 'fast', label: 'Fast (100+ t/s)' },
  { id: 'long-ctx', label: 'Long Context (200k+)' },
  { id: 'open-weights', label: 'Open Weights' },
];

export const COST_BASIS_OPTIONS: Array<{ id: CostBasis; label: string; shortLabel: string }> = [
  { id: 'blended', label: 'Blended 3:1', shortLabel: 'Blended' },
  { id: 'input', label: 'Input Price', shortLabel: 'Input' },
  { id: 'output', label: 'Output Price', shortLabel: 'Output' },
  { id: 'cached', label: 'Prompt Caching', shortLabel: 'Cached' },
  { id: 'batch', label: 'Batch (50% Off)', shortLabel: 'Batch' },
];

export function costBasisShortLabel(basis: CostBasis): string {
  return COST_BASIS_OPTIONS.find((o) => o.id === basis)?.shortLabel ?? basis;
}

export const WORKLOAD_PRESETS: WorkloadPreset[] = [
  { id: 'chat', label: 'Chat', inputTokens: 1500, outputTokens: 500 },
  { id: 'agent', label: 'Agent', inputTokens: 15000, outputTokens: 2500 },
  { id: 'rag', label: 'RAG', inputTokens: 64000, outputTokens: 3500 },
  { id: 'batch', label: 'Batch', inputTokens: 100000, outputTokens: 10000 },
];
