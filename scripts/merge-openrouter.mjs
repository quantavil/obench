#!/usr/bin/env node
// Merge live OpenRouter GET https://openrouter.ai/api/v1/models into src/data/models.json
// Keeps AA intelligence/speed benchmarks, updates pricing/context/modalities, adds new OR models
// Usage: bun scripts/merge-openrouter.mjs [--dry-run]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OR_URL = 'https://openrouter.ai/api/v1/models';
const MODELS_PATH = join(import.meta.dirname ?? '.', '../src/data/models.json');

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function normLast(id) {
  const last = String(id).split('/').pop().split(':')[0];
  return slug(last.replace(/\./g, '-'));
}
function toPerM(str) {
  if (str == null || str === '') return null;
  const n = parseFloat(String(str));
  if (!Number.isFinite(n) || n < 0) return null;
  const perM = n * 1e6;
  // round to 2 decimals like aaNormalize
  return Math.round(perM * 100) / 100;
}
function modalitiesFromArch(arch) {
  const ins = arch?.input_modalities || [];
  const outs = arch?.output_modalities || [];
  const hasImage = [...ins, ...outs].some((m) => String(m).toLowerCase() === 'image' || String(m).toLowerCase() === 'vision');
  const hasVideo = [...ins, ...outs].some((m) => String(m).toLowerCase() === 'video');
  const hasAudio = [...ins, ...outs].some((m) => String(m).toLowerCase() === 'audio');
  // OBench currently only distinguishes text / text+vision. Keep vision if image present, else text.
  // For audio/video we also signal vision (multimodal). Preserve future extensibility.
  if (hasImage || hasVideo) return ['text', 'vision'];
  return ['text'];
}
function providerFromOrId(orId) {
  let pref = String(orId).split('/')[0].replace(/^~/, '');
  const map = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
    'google': 'Google',
    'deepseek': 'DeepSeek',
    'qwen': 'Alibaba',
    'x-ai': 'xAI',
    'meta-llama': 'Meta',
    'meta': 'Meta',
    'cohere': 'Cohere',
    'mistralai': 'Mistral',
    'tencent': 'Tencent',
    'ibm-granite': 'IBM',
    'z-ai': 'Z AI',
    'minimax': 'MiniMax',
    'moonshotai': 'Kimi',
    'nvidia': 'NVIDIA',
    'inclusionai': 'InclusionAI',
    'liquid': 'Liquid AI',
    'dots-studio': 'Dots Labs',
    'bytedance': 'Bytedance',
    'bytedance-seed': 'Bytedance',
    'alibaba': 'Alibaba',
    'xiaomi': 'Xiaomi',
    'stepfun': 'StepFun',
    'inclusion': 'InclusionAI',
  };
  if (map[pref]) return map[pref];
  // capitalize
  return pref ? pref.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown';
}

async function fetchOr() {
  const res = await fetch(OR_URL, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`OpenRouter ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.data || [];
}

function buildOrMaps(orData) {
  const baseMap = new Map(); // norm -> record (paid variant wins)
  const freeMap = new Map(); // norm -> :free variant
  const batchMap = new Map();
  const fullMap = new Map(); // id -> record
  for (const rec of orData) {
    const id = rec.id;
    if (String(id).startsWith('~')) continue; // skip deprecated aliases
    fullMap.set(id, rec);
    const isFree = String(id).endsWith(':free');
    const isBatch = String(id).endsWith(':batch');
    const norm = normLast(id);
    if (isBatch) {
      if (!batchMap.has(norm)) batchMap.set(norm, rec);
    } else if (isFree) {
      if (!freeMap.has(norm)) freeMap.set(norm, rec);
    } else if (!baseMap.has(norm)) {
      // if multiple paid variants share a slug, keep first (OR appears sorted)
      baseMap.set(norm, rec);
    }
  }
  // free variants only fill gaps — they can never enrich a paid model with $0 pricing
  for (const [norm, rec] of freeMap) {
    if (!baseMap.has(norm)) baseMap.set(norm, rec);
  }
  return { baseMap, batchMap, fullMap };
}

function findBestOrForAa(aaId, baseMap) {
  const aaNorm = slug(aaId.replace(/\./g, '-'));
  if (baseMap.has(aaNorm)) return baseMap.get(aaNorm);
  const suffixes = ['-low', '-medium', '-high', '-xhigh', '-max', '-flash', '-preview', '-beta', '-alpha', '-adaptive', '-reasoning', '-non-reasoning', '-non-reasoning-low-effort', '-non-reasoning-high-effort', '-thinking'];
  let cur = aaNorm;
  for (const s of suffixes) {
    if (cur.endsWith(s)) {
      cur = cur.slice(0, -s.length);
      if (baseMap.has(cur)) return baseMap.get(cur);
    }
  }
  let best = null;
  let bestLen = 0;
  for (const [orNorm, rec] of baseMap.entries()) {
    if (aaNorm.includes(orNorm) || orNorm.includes(aaNorm) || aaNorm.startsWith(orNorm + '-') || orNorm.startsWith(aaNorm + '-')) {
      if (orNorm.length > bestLen) { best = rec; bestLen = orNorm.length; }
    }
  }
  return best;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log('[merge-openrouter] fetching', OR_URL);
  const orData = await fetchOr();
  console.log(`[merge-openrouter] OR models fetched: ${orData.length}`);
  const { baseMap, batchMap } = buildOrMaps(orData);
  console.log(`[merge-openrouter] base unique norms: ${baseMap.size}, batch norms: ${batchMap.size}`);

  const raw = JSON.parse(readFileSync(MODELS_PATH, 'utf8'));
  console.log(`[merge-openrouter] AA models loaded: ${raw.length}`);

  const existingIds = new Set(raw.map((m) => m.id));
  const aaByNorm = new Map();
  for (const m of raw) aaByNorm.set(slug(m.id), m);

  let enriched = 0;
  let priceUpdated = 0;
  let ctxUpdated = 0;
  let modUpdated = 0;
  const enrichedSamples = [];

  const merged = raw.map((model) => {
    const orRec = findBestOrForAa(model.id, baseMap);
    if (!orRec) return model;
    let changed = false;
    const next = { ...model };
    const pPrompt = toPerM(orRec.pricing?.prompt);
    const pComp = toPerM(orRec.pricing?.completion);
    const pCache = toPerM(orRec.pricing?.input_cache_read);
    // Only overwrite if OR gives finite pricing; keep AA if OR null - live OR is truth for pricing
    if (pPrompt != null && pPrompt !== next.price1mInput) { next.price1mInput = pPrompt; changed = true; }
    if (pComp != null && pComp !== next.price1mOutput) { next.price1mOutput = pComp; changed = true; }
    if (pCache != null && pCache !== next.price1mCacheRead) { next.price1mCacheRead = pCache; changed = true; }
    // batch: lookup :batch variant
    const batchNorm = normLast(orRec.id);
    const batchRec = batchMap.get(batchNorm);
    if (batchRec) {
      const bPrompt = toPerM(batchRec.pricing?.prompt);
      if (bPrompt != null && bPrompt !== next.price1mBatch) { next.price1mBatch = bPrompt; changed = true; }
    }
    // Fallbacks to avoid -- in table when derivable from input (matches src/utils/pricing.ts logic)
    if (next.price1mCacheRead == null && next.price1mInput != null) {
      const derived = Math.round(next.price1mInput * 0.25 * 100) / 100;
      if (derived !== next.price1mCacheRead) { next.price1mCacheRead = derived; changed = true; }
    }
    if (next.price1mBatch == null && next.price1mInput != null) {
      const derived = Math.round(next.price1mInput * 0.5 * 100) / 100;
      if (derived !== next.price1mBatch) { next.price1mBatch = derived; changed = true; }
    }

    // context / maxOutput
    const ctx = orRec.context_length;
    if (typeof ctx === 'number' && ctx !== next.contextWindow) { next.contextWindow = ctx; changed = true; }
    const maxOut = orRec.top_provider?.max_completion_tokens;
    if (typeof maxOut === 'number' && maxOut !== next.maxOutputTokens) { next.maxOutputTokens = maxOut; changed = true; }
    // modalities
    const mods = modalitiesFromArch(orRec.architecture);
    if (JSON.stringify(mods) !== JSON.stringify(next.modalities)) { next.modalities = mods; changed = true; }

    // releasedAt: only fill if missing or generic placeholder 2025-01-15 vs OR created gives more specific date
    // We keep AA date to preserve SOTA ordering; only set if null or 2025-01-15 generic and OR created is plausible
    if (!next.releasedAt || next.releasedAt === '2025-01-15') {
      const ts = orRec.created;
      if (typeof ts === 'number' && ts > 0) {
        const d = new Date(ts * 1000).toISOString().slice(0, 10);
        if (d !== next.releasedAt) { next.releasedAt = d; changed = true; }
      }
    }

    if (changed) {
      enriched++;
      if (pPrompt !== model.price1mInput || pComp !== model.price1mOutput) priceUpdated++;
      if (ctx !== model.contextWindow) ctxUpdated++;
      if (JSON.stringify(mods) !== JSON.stringify(model.modalities)) modUpdated++;
      if (enrichedSamples.length < 15) enrichedSamples.push({ id: model.id, orId: orRec.id, pricing: [pPrompt, pComp, pCache], ctx, mods });
    }
    return changed ? next : model;
  });

  const orUnmatched = [];
  const matchedOrIds = new Set(raw.map((m) => findBestOrForAa(m.id, baseMap)?.id).filter(Boolean));
  for (const [norm, rec] of baseMap.entries()) {
    if (existingIds.has(norm) || existingIds.has(rec.id) || matchedOrIds.has(rec.id)) continue;
    orUnmatched.push(rec);
  }
  orUnmatched.sort((a, b) => (b.created || 0) - (a.created || 0));

  const added = [];
  for (const rec of orUnmatched) {
    const rawId = normLast(rec.id); // slug id for OBench
    if (existingIds.has(rawId)) continue;
    // Skip weird ids that are too long or free variants already covered?
    // Use raw pricing
    const priceIn = toPerM(rec.pricing?.prompt);
    const priceOut = toPerM(rec.pricing?.completion);
    let priceCache = toPerM(rec.pricing?.input_cache_read);
    if (priceCache == null && priceIn != null) priceCache = Math.round(priceIn * 0.25 * 100) / 100;
    // derive batch pricing from batch variant if exists
    let priceBatch = null;
    const bRec = batchMap.get(normLast(rec.id));
    if (bRec) priceBatch = toPerM(bRec.pricing?.prompt);
    else if (priceIn != null) priceBatch = Math.round(priceIn * 0.5 * 100) / 100;

    const created = rec.created ? new Date(rec.created * 1000).toISOString().slice(0, 10) : null;
    const mods = modalitiesFromArch(rec.architecture);
    const newModel = {
      id: rawId,
      name: String(rec.name || rec.id).slice(0, 200),
      provider: providerFromOrId(rec.id),
      releasedAt: created,
      price1mInput: priceIn,
      price1mOutput: priceOut,
      price1mCacheRead: priceCache,
      price1mBatch: priceBatch,
      intelligence: null,
      codingIndex: null,
      mathIndex: null,
      reasoningIndex: null,
      speedTps: null,
      latencyTtft: null,
      contextWindow: typeof rec.context_length === 'number' ? rec.context_length : null,
      maxOutputTokens: typeof rec.top_provider?.max_completion_tokens === 'number' ? rec.top_provider.max_completion_tokens : null,
      modalities: mods,
      isOpenWeights: false,
    };
    merged.push(newModel);
    added.push(newModel);
    existingIds.add(rawId);
  }

  console.log(`[merge-openrouter] enriched ${enriched} existing (priceChanged ~${priceUpdated}, ctx ${ctxUpdated}, mods ${modUpdated}), added ${added.length} new OR models`);

  // Sort merged by intelligence descending (nulls last)
  merged.sort((a, b) => {
    const ai = a.intelligence ?? -Infinity;
    const bi = b.intelligence ?? -Infinity;
    if (bi !== ai) return bi - ai;
    return String(a.id).localeCompare(String(b.id));
  });

  console.log(`[merge-openrouter] total after merge: ${merged.length} (was ${raw.length})`);
  if (enrichedSamples.length) {
    console.log('[merge-openrouter] sample enriched:');
    for (const s of enrichedSamples) console.log(`  ${s.id} -> ${s.orId} pricing ${s.pricing} ctx ${s.ctx} mods ${s.mods}`);
  }
  if (added.length) {
    console.log('[merge-openrouter] sample added:');
    for (const a of added.slice(0, 8)) console.log(`  ${a.id} (${a.provider}) pricing ${a.price1mInput}/${a.price1mOutput} ctx ${a.contextWindow} mods ${a.modalities}`);
  }

  if (dryRun) {
    console.log('[merge-openrouter] dry-run, not writing');
    return { enriched, added: added.length, total: merged.length };
  }

  writeFileSync(MODELS_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`[merge-openrouter] wrote ${MODELS_PATH}`);

  return { enriched, added: added.length, total: merged.length };
}

main().catch((e) => { console.error(e); process.exit(1); });
