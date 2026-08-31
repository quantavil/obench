import type { ModelRecord } from '../types/model';

export const AA_MODELS_URL = 'https://artificialanalysis.ai/api/v2/data/llms/models';

function fnv1aHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function cleanId(value: unknown, maxLength = 64): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  if (raw.length <= maxLength) {
    return raw;
  }
  const hash = fnv1aHash(raw);
  const prefixLength = Math.max(1, maxLength - hash.length - 1);
  return `${raw.slice(0, prefixLength)}-${hash}`;
}

export interface NormalizeReport {
  models: ModelRecord[];
  skippedRecords: number;
}

export function normalizeAaRecordsWithReport(allRecords: unknown[]): NormalizeReport {
  if (!Array.isArray(allRecords)) {
    return { models: [], skippedRecords: 0 };
  }

  const processed: ModelRecord[] = [];

  for (const m of allRecords) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) {
      continue;
    }

    const rec = m as Record<string, any>;
    let idSrc = rec.slug || rec.id || rec.name || '';
    idSrc = String(idSrc).toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const id = cleanId(idSrc);

    const name = typeof rec.name === 'string' ? rec.name.slice(0, 200).trim() : 'Unknown Model';
    const provider = typeof (rec.provider || rec.model_creator?.name || rec.creator) === 'string'
      ? String(rec.provider || rec.model_creator?.name || rec.creator).slice(0, 200).trim()
      : 'Unknown';

    const releasedAt = typeof (rec.releasedAt || rec.release_date) === 'string'
      ? String(rec.releasedAt || rec.release_date).slice(0, 20)
      : null;

    // Pricing (keep null if absent)
    const rawPriceInput = rec.pricing?.price_1m_input_tokens ?? rec.price1mInput;
    const rawPriceOutput = rec.pricing?.price_1m_output_tokens ?? rec.price1mOutput;
    const rawPriceCacheRead = rec.pricing?.price_1m_cache_read_tokens ?? rec.pricing?.cache_read_input_tokens ?? rec.price1mCacheRead;
    const rawPriceBatch = rec.pricing?.price_1m_batch_input_tokens ?? rec.pricing?.batch_input_tokens ?? rec.price1mBatch;

    const price1mInput = typeof rawPriceInput === 'number' ? Math.round(rawPriceInput * 100) / 100 : null;
    const price1mOutput = typeof rawPriceOutput === 'number' ? Math.round(rawPriceOutput * 100) / 100 : null;
    const price1mCacheRead = typeof rawPriceCacheRead === 'number' ? Math.round(rawPriceCacheRead * 100) / 100 : null;
    const price1mBatch = typeof rawPriceBatch === 'number' ? Math.round(rawPriceBatch * 100) / 100 : null;

    // Intelligence & Benchmark sub-indices (keep absent telemetry as null)
    const intelligence = typeof rec.evaluations?.artificial_analysis_intelligence_index === 'number'
      ? rec.evaluations.artificial_analysis_intelligence_index
      : typeof rec.intelligence === 'number'
      ? rec.intelligence
      : null;

    const codingIndex = typeof rec.evaluations?.coding_index === 'number'
      ? rec.evaluations.coding_index
      : typeof rec.codingIndex === 'number'
      ? rec.codingIndex
      : null;

    const mathIndex = typeof rec.evaluations?.math_index === 'number'
      ? rec.evaluations.math_index
      : typeof rec.mathIndex === 'number'
      ? rec.mathIndex
      : null;

    const reasoningIndex = typeof rec.evaluations?.reasoning_index === 'number'
      ? rec.evaluations.reasoning_index
      : typeof rec.reasoningIndex === 'number'
      ? rec.reasoningIndex
      : null;

    // Speed & Latency
    const rawTps =
      rec.performance?.median_output_tokens_per_second ??
      rec.performance?.output_tokens_per_second ??
      rec.performance?.tps ??
      rec.median_output_tokens_per_second ??
      rec.speedTps;
    const speedTps = typeof rawTps === 'number' ? Math.round(rawTps * 10) / 10 : null;

    const rawTtft =
      rec.performance?.median_time_to_first_token_seconds ??
      rec.performance?.median_time_to_first_answer_token_seconds ??
      rec.performance?.time_to_first_token_seconds ??
      rec.performance?.ttft ??
      rec.median_time_to_first_token_seconds ??
      rec.latencyTtft;
    const latencyTtft = typeof rawTtft === 'number' ? Math.round(rawTtft * 100) / 100 : null;

    // Context window & limits (keep absent as null)
    const rawContext = rec.limits?.max_context_window ?? rec.context_window ?? rec.max_context_window ?? rec.contextWindow;
    const contextWindow = typeof rawContext === 'number' ? rawContext : null;

    const rawMaxOut = rec.limits?.max_output_tokens ?? rec.max_output_tokens ?? rec.maxOutputTokens;
    const maxOutputTokens = typeof rawMaxOut === 'number' ? rawMaxOut : null;

    // Modalities
    const modalities = Array.isArray(rec.modalities)
      ? rec.modalities
      : (/\b(vision|multimodal|vl|omni)\b/i.test(name) || /\b(vl|4o)\b/i.test(String(rec.slug || rec.id || '')) ? ['text', 'vision'] : ['text']);

    // Open weights
    const licenseStr = typeof rec.license === 'string' ? rec.license.toLowerCase() : '';
    const providerLower = provider.toLowerCase();
    const isOpenWeights = Boolean(
      rec.is_open_weights === true ||
      rec.open_weights === true ||
      (licenseStr && (licenseStr.includes('apache') || licenseStr.includes('mit') || licenseStr.includes('open') || licenseStr.includes('llama'))) ||
      (['deepseek', 'qwen', 'mistral'].some((k) => providerLower.includes(k)) && licenseStr !== 'proprietary') ||
      (providerLower.includes('meta') && /llama|chameleon/i.test(name + String(rec.id || '')))
    );

    if (id && intelligence !== null) {
      processed.push({
        id,
        name,
        provider,
        releasedAt,
        price1mInput,
        price1mOutput,
        price1mCacheRead,
        price1mBatch,
        intelligence,
        codingIndex,
        mathIndex,
        reasoningIndex,
        speedTps,
        latencyTtft,
        contextWindow,
        maxOutputTokens,
        modalities,
        isOpenWeights,
      });
    }
  }

  const seenIds = new Set<string>();
  const uniqueModels: ModelRecord[] = [];
  for (const m of processed) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      uniqueModels.push(m);
    }
  }

  uniqueModels.sort((a, b) => (b.intelligence ?? 0) - (a.intelligence ?? 0));

  return {
    models: uniqueModels,
    skippedRecords: allRecords.length - uniqueModels.length,
  };
}

export function normalizeAaRecords(allRecords: any[]): ModelRecord[] {
  return normalizeAaRecordsWithReport(allRecords).models;
}

