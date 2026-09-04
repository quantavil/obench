// Brand colors and SVG icons for AI providers
import type { ModelRecord, CapabilityBadge } from '../types/model';

export const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#c67c3b',
  openai: '#0ea5a0',
  google: '#7c5cfc',
  meta: '#3b82f6',
  deepseek: '#0e7490',
  mistral: '#ea580c',
  xai: '#dc2626',
  'z ai': '#6366f1',
  kimi: '#2563eb',
  cohere: '#0d9488',
  microsoft: '#0284c7',
  amazon: '#d97706',
  alibaba: '#db2777',
  nvidia: '#16a34a',
  ibm: '#1e40af',
  perplexity: '#0891b2',
  baichuan: '#e11d48',
  minimax: '#9333ea',
  '01.ai': '#a16207',
  qwen: '#7c3aed',
  tencent: '#0ea5e9',
  huggingface: '#facc15',
};

export const KNOWN_PROVIDERS: string[] = [
  'anthropic',
  'openai',
  'google',
  'meta',
  'deepseek',
  'mistral',
  'xai',
  'alibaba',
  'nvidia',
  'amazon',
  'qwen',
  'cohere',
  'perplexity',
];

export function providerColor(name: string | null | undefined): string {
  if (!name) return '#6b7280';
  const key = name.toLowerCase().trim();
  for (const [k, color] of Object.entries(PROVIDER_COLORS)) {
    if (key.includes(k)) return color;
  }
  return '#6b7280';
}

export function providerSvg(name: string | null | undefined, size = 16): string {
  if (!name) return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:4px;background:#f4f4f5;color:#71717a;font-size:${Math.round(size * 0.55)}px;font-weight:700;">?</span>`;
  const key = name.toLowerCase().trim();
  for (const k of KNOWN_PROVIDERS) {
    if (key === k || key.includes(k) || k.includes(key)) {
      return `<svg style="width:${size}px;height:${size}px;display:inline-block;" viewBox="0 0 24 24"><use href="#icon-provider-${k}" /></svg>`;
    }
  }
  const initial = escapeHtml(name.trim().charAt(0).toUpperCase());
  const bg = providerColor(name);
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:4px;background:${bg}18;color:${bg};font-size:${Math.round(size * 0.6)}px;font-weight:800;line-height:1;">${initial}</span>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Capability heuristics shared by the capability filter (appStore) and the
 * capability badges (extractModelBadges) so the two can never drift apart.
 * Modalities from the dataset are authoritative; name tokens are the fallback
 * for records without modality metadata.
 */
export function modelHasVision(model: ModelRecord): boolean {
  if (model.modalities && model.modalities.includes('vision')) return true;
  const name = (model.name || '').toLowerCase();
  const idTokens = (model.id || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return name.includes('vision') || name.includes('multimodal') || name.includes(' omni') || name.includes(' 4o') || idTokens.includes('vl') || idTokens.includes('vision');
}

export function modelHasReasoning(model: ModelRecord): boolean {
  const name = (model.name || '').toLowerCase();
  if (name.includes('reasoning') || name.includes('thinking')) return true;
  const reasoningTokens = ['reasoning', 'thinking', 'effort', 'r1', 'o1', 'o3'];
  const nameWords = new Set(name.split(/[^a-z0-9]+/).filter(Boolean));
  const idTokens = (model.id || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return reasoningTokens.some((t) => nameWords.has(t) || idTokens.includes(t));
}

export function extractModelBadges(model: ModelRecord | null | undefined): CapabilityBadge[] {
  if (!model) return [];
  const badges: CapabilityBadge[] = [];

  if (modelHasReasoning(model)) {
    badges.push({ label: 'Reasoning', type: 'reasoning' });
  }

  if (modelHasVision(model)) {
    badges.push({ label: 'Vision', type: 'vision' });
  }

  // Large context window badge
  if (model.contextWindow !== null && model.contextWindow >= 1000000) {
    badges.push({ label: '1M+ ctx', type: 'ctx' });
  } else if (model.contextWindow !== null && model.contextWindow >= 200000) {
    badges.push({ label: '200k ctx', type: 'ctx' });
  }

  return badges;
}
