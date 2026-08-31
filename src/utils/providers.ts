// Brand colors and authentic SVG icons for AI providers
import type { ModelRecord, CapabilityBadge } from '../types/model';

export const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#c67c3b',
  openai: '#0ea5a0',
  google: '#7c5cfc',
  meta: '#3b82f6',
  deepseek: '#0e7490',
  mistral: '#ea580c',
  spacexai: '#dc2626',
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

export const PROVIDER_SVGS: Record<string, string> = {
  anthropic: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.827 3.524l5.986 16.952h-3.488l-1.378-4.04H8.972l-1.39 4.04H4.187L10.173 3.524h3.654zm-1.025 3.738h-.226l-2.48 7.243h5.185l-2.479-7.243z"/></svg>',
  openai: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.98 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 8.747a4.485 4.485 0 0 1 2.345-1.977l-.004.164v5.518a.79.79 0 0 0 .392.682l5.843 3.37-2.02 1.167a.078.078 0 0 1-.07 0L4.01 14.887a4.504 4.504 0 0 1-1.67-6.14zm16.597 3.855l-5.843-3.37 2.02-1.167a.078.078 0 0 1 .07 0l4.815 2.784a4.504 4.504 0 0 1-1.062 7.82V13.284a.79.79 0 0 0-.392-.682zm2.01-4.812l-.142-.085-4.783-2.759a.771.771 0 0 0-.78 0L9.4 8.316V5.984a.08.08 0 0 1 .033-.062l4.84-2.796a4.5 4.5 0 0 1 6.677 4.654zm-8.814 4.33l-2.76-1.593 2.76-1.593 2.76 1.593-2.76 1.593z"/></svg>',
  google: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z"/></svg>',
  meta: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.333c-3.14 0-5.875 1.775-7.794 4.417C2.287 11.392 1 14.28 1 17.333c0 2.21 1.79 4 4 4 2.87 0 5.17-2.3 7-5 1.83 2.7 4.13 5 7 5 2.21 0 4-1.79 4-4 0-3.053-1.287-5.941-3.206-8.583C17.875 6.108 15.14 4.333 12 4.333zM7.2 17.333c-1.32 0-2.4-1.08-2.4-2.4 0-1.77.89-3.8 2.37-5.75C8.36 7.6 9.8 6.533 11.2 6.533c1.07 0 2.05.65 3.02 1.84-1.63 2.53-3.62 5.56-5.82 8.96h-1.2zm9.6 0h-1.2c-2.2-3.4-4.19-6.43-5.82-8.96.97-1.19 1.95-1.84 3.02-1.84 1.4 0 2.84 1.067 4.03 2.65 1.48 1.95 2.37 3.98 2.37 5.75 0 1.32-1.08 2.4-2.4 2.4z"/></svg>',
  deepseek: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5v-3.5h3.5v-2H13V7.5h-2v3.5H7.5v2H11v3.5h2z"/></svg>',
  mistral: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h4v4H3V3zm14 0h4v4h-4V3zM3 10h4v4H3v-4zm7 0h4v4h-4v-4zm7 0h4v4h-4v-4zM3 17h4v4H3v-4zm7 0h4v4h-4v-4zm7 0h4v4h-4v-4z"/></svg>',
  spacexai: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  alibaba: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5L4.5 9.75v4.5L12 18l7.5-3.75v-4.5L12 13.5z"/></svg>',
  nvidia: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.94 4.25c-3.1 0-5.63 2.5-5.63 5.58 0 2.67 1.89 4.9 4.44 5.43v-2.02c-1.47-.46-2.54-1.83-2.54-3.41 0-1.99 1.63-3.6 3.63-3.6 1.48 0 2.76.88 3.32 2.15l1.83-.82C13.06 5.51 11.16 4.25 8.94 4.25zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>',
  amazon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.9 14.5c-1.8 1.4-4.3 1.9-6.5 1.4-.4-.1-.7.2-.6.6.2.7 1.2 1.4 2.4 1.7 2.4.6 5.1.1 7.2-1.3.4-.3.2-.8-.2-.8-.8-.5-1.6-1.1-2.3-1.6zm-1.7-2.6c0-.8-.1-1.6-.3-2.3-.6-1.8-2.2-2.8-4.2-2.7-2.5.1-4.2 1.7-4.4 4.2-.2 2.3 1.4 4.2 3.6 4.4 1.8.2 3.4-.7 4.1-2.3.8-1.8 1.2-1.3 1.2-1.3z"/></svg>',
  // extended coverage for common providers found in dataset
  qwen: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm5.5 2.5L12 18 6.5 13.5V9l5.5 3 5.5-3v4.5z"/></svg>',
  cohere: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>',
  perplexity: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm2.5-11H9a1 1 0 0 0 0 2h4V14h-3a1 1 0 0 0 0 2h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2z"/></svg>',
};

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
  for (const [k, svg] of Object.entries(PROVIDER_SVGS)) {
    if (key === k || key.includes(k) || k.includes(key)) {
      return `<span style="display:inline-flex;width:${size}px;height:${size}px;">${svg}</span>`;
    }
  }
  const initial = name.trim().charAt(0).toUpperCase();
  const bg = providerColor(name);
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:4px;background:${bg}18;color:${bg};font-size:${Math.round(size * 0.6)}px;font-weight:800;line-height:1;">${initial}</span>`;
}

export function extractModelBadges(model: ModelRecord | null | undefined): CapabilityBadge[] {
  if (!model) return [];
  const badges: CapabilityBadge[] = [];
  const name = (model.name || '').toLowerCase();
  const id = (model.id || '').toLowerCase();

  // Reasoning / Thinking badge - require word boundary or known model family token
  const reasoningTokens = ['reasoning', 'thinking', 'effort', 'r1', 'o1', 'o3'];
  const nameWords = new Set(name.split(/[^a-z0-9]+/).filter(Boolean));
  const idTokens = id.split(/[^a-z0-9]+/).filter(Boolean);
  const hasReasoningToken = reasoningTokens.some((t) => nameWords.has(t) || idTokens.includes(t) || name.includes(` ${t} `));
  // keep legacy heuristic but guard short tokens against false positives like "pro1"
  if (hasReasoningToken || name.includes('reasoning') || name.includes('thinking')) {
    badges.push({ label: 'Reasoning', type: 'reasoning' });
  }

  // Vision / Multimodal badge
  const hasVisionModal = model.modalities && model.modalities.includes('vision');
  const visionByName = name.includes('vision') || name.includes('multimodal') || name.includes(' omni') || name.includes(' 4o');
  const visionById = idTokens.includes('vl') || idTokens.includes('vision') || id === '4o' || id.includes('4o');
  if (hasVisionModal || visionByName || visionById) {
    badges.push({ label: 'Vision', type: 'vision' });
  }

  // Large context window badge
  if (model.contextWindow >= 1000000) {
    badges.push({ label: '1M+ ctx', type: 'ctx' });
  } else if (model.contextWindow >= 200000) {
    badges.push({ label: '200k ctx', type: 'ctx' });
  }

  return badges;
}
