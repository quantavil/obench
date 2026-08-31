// Static configuration for OBench (OpenRouter-inspired Artificial Analysis Explorer).
import type { ModelViewMode, PlotMetricMode, PriceRangePreset, CostBasis, WorkloadPreset } from '../types/model';

export const MODEL_VIEW_MODES: Array<{ id: ModelViewMode; label: string; icon: string }> = [
  { id: 'table', label: 'Table', icon: 'icon-list' },
  { id: 'cards', label: 'Cards', icon: 'icon-grid' },
  { id: 'plot', label: 'Scatter Plots', icon: 'icon-plot' },
  { id: 'timeline', label: 'SOTA Timeline', icon: 'icon-calendar' },
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
  { id: 'name-asc', label: 'Name (A to Z)' },
  { id: 'date-desc', label: 'Release Date (Newest)' },
];

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

export const COST_BASIS_OPTIONS: Array<{ id: CostBasis; label: string }> = [
  { id: 'blended', label: 'Blended 3:1' },
  { id: 'input', label: 'Input Price' },
  { id: 'output', label: 'Output Price' },
  { id: 'cached', label: 'Prompt Caching' },
  { id: 'batch', label: 'Batch (50% Off)' },
];

export const POPULAR_CREATORS: string[] = [
  'Anthropic',
  'OpenAI',
  'Google',
  'DeepSeek',
  'Alibaba',
  'Mistral',
  'Meta',
  'SpaceXAI',
  'Z AI',
  'NVIDIA',
  'Cohere',
  'Microsoft',
  'Amazon',
];

export const WORKLOAD_PRESETS: WorkloadPreset[] = [
  { id: 'chat', label: 'Chat', inputTokens: 1500, outputTokens: 500 },
  { id: 'agent', label: 'Agent', inputTokens: 15000, outputTokens: 2500 },
  { id: 'rag', label: 'RAG', inputTokens: 64000, outputTokens: 3500 },
  { id: 'batch', label: 'Batch', inputTokens: 100000, outputTokens: 10000 },
];
