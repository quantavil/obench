// Type definitions for OBench (Artificial Analysis & OpenRouter-inspired Intelligence Workbench)

export interface ModelEvaluations {
  gpqa?: number | null;
  hle?: number | null;
  scicode?: number | null;
  livecodebench?: number | null;
  math500?: number | null;
  aime25?: number | null;
  ifbench?: number | null;
  lcr?: number | null;
  tau2?: number | null;
  terminalbenchHard?: number | null;
  mmluPro?: number | null;
}

export interface ModelRecord {
  id: string;
  name: string;
  provider: string;
  releasedAt: string | null;
  price1mInput: number | null;
  price1mOutput: number | null;
  price1mCacheRead: number | null;
  price1mBatch: number | null;
  intelligence: number | null;
  codingIndex: number | null;
  mathIndex: number | null;
  reasoningIndex: number | null;
  speedTps: number | null;
  latencyTtft: number | null;
  latencyTtfat?: number | null;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  modalities: string[];
  isOpenWeights: boolean;
  evaluations?: ModelEvaluations | null;
}

export type CostBasis = 'blended' | 'input' | 'output' | 'cached' | 'batch';

export type ModelViewMode = 'table' | 'plot' | 'timeline' | 'compare';

export type PlotMetricMode = 'iq-cost' | 'iq-speed' | 'ttft-speed';

export interface PriceRangePreset {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
}

export interface CapabilityBadge {
  label: string;
  type: 'reasoning' | 'vision' | 'ctx';
}

export interface WorkloadPreset {
  id: 'chat' | 'agent' | 'rag' | 'batch';
  label: string;
  inputTokens: number;
  outputTokens: number;
}
