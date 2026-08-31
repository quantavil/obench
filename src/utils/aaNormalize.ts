import type { ModelRecord } from '../types/model';

export const AA_MODELS_URL = 'https://artificialanalysis.ai/api/v2/data/llms/models';

function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.slice(0, 64);
  if (!s || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  return s;
}

export function normalizeAaRecords(allRecords: any[]): ModelRecord[] {
  if (!Array.isArray(allRecords)) return [];

  const processed = allRecords.map((m) => {
    let idSrc = m.slug || m.id || m.name || '';
    idSrc = String(idSrc).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const id = cleanId(idSrc);

    const name = typeof m.name === 'string' ? m.name.slice(0, 200).trim() : 'Unknown Model';
    const provider = typeof (m.provider || m.model_creator?.name || m.creator) === 'string'
      ? String(m.provider || m.model_creator?.name || m.creator).slice(0, 200).trim()
      : 'Unknown';

    const releasedAt = typeof (m.releasedAt || m.release_date) === 'string' ? String(m.releasedAt || m.release_date).slice(0, 20) : null;

    // Pricing
    const rawPriceInput = m.pricing?.price_1m_input_tokens ?? m.price1mInput;
    const rawPriceOutput = m.pricing?.price_1m_output_tokens ?? m.price1mOutput;
    const rawPriceCacheRead = m.pricing?.price_1m_cache_read_tokens ?? m.pricing?.cache_read_input_tokens ?? m.price1mCacheRead;
    const rawPriceBatch = m.pricing?.price_1m_batch_input_tokens ?? m.pricing?.batch_input_tokens ?? m.price1mBatch;

    const price1mInput = typeof rawPriceInput === 'number' ? Math.round(rawPriceInput * 100) / 100 : null;
    const price1mOutput = typeof rawPriceOutput === 'number' ? Math.round(rawPriceOutput * 100) / 100 : null;
    const price1mCacheRead = typeof rawPriceCacheRead === 'number' ? Math.round(rawPriceCacheRead * 100) / 100 : (price1mInput !== null ? Math.round(price1mInput * 0.25 * 100) / 100 : null);
    const price1mBatch = typeof rawPriceBatch === 'number' ? Math.round(rawPriceBatch * 100) / 100 : (price1mInput !== null ? Math.round(price1mInput * 0.5 * 100) / 100 : null);

    // Intelligence & Benchmark sub-indices
    const intelligence = typeof m.evaluations?.artificial_analysis_intelligence_index === 'number'
      ? m.evaluations.artificial_analysis_intelligence_index
      : typeof m.intelligence === 'number'
      ? m.intelligence
      : null;

    const codingIndex = typeof m.evaluations?.coding_index === 'number'
      ? m.evaluations.coding_index
      : typeof m.codingIndex === 'number'
      ? m.codingIndex
      : (intelligence !== null ? Math.round(intelligence * 0.96 * 10) / 10 : null);

    const mathIndex = typeof m.evaluations?.math_index === 'number'
      ? m.evaluations.math_index
      : typeof m.mathIndex === 'number'
      ? m.mathIndex
      : (intelligence !== null ? Math.round(intelligence * 0.94 * 10) / 10 : null);

    const reasoningIndex = typeof m.evaluations?.reasoning_index === 'number'
      ? m.evaluations.reasoning_index
      : typeof m.reasoningIndex === 'number'
      ? m.reasoningIndex
      : intelligence;

    // Speed (Tokens/sec) & Latency (Time-To-First-Token in seconds)
    const rawTps = m.performance?.output_tokens_per_second ?? m.performance?.tps ?? m.speedTps;
    const speedTps = typeof rawTps === 'number' ? Math.round(rawTps * 10) / 10 : null;

    const rawTtft = m.performance?.time_to_first_token_seconds ?? m.performance?.ttft ?? m.latencyTtft;
    const latencyTtft = typeof rawTtft === 'number' ? Math.round(rawTtft * 100) / 100 : null;

    // Context window & limits
    const rawContext = m.limits?.max_context_window ?? m.context_window ?? m.max_context_window ?? m.contextWindow;
    const contextWindow = typeof rawContext === 'number' ? rawContext : 128000;

    const rawMaxOut = m.limits?.max_output_tokens ?? m.max_output_tokens ?? m.maxOutputTokens;
    const maxOutputTokens = typeof rawMaxOut === 'number' ? rawMaxOut : 4096;

    // Modalities & Licenses
    const modalities = Array.isArray(m.modalities) ? m.modalities : (name.toLowerCase().includes('vision') || name.toLowerCase().includes('vl') || name.toLowerCase().includes('4o') || name.toLowerCase().includes('omni') ? ['text', 'vision'] : ['text']);
    const isOpenWeights = Boolean(m.is_open_weights || m.license?.toLowerCase()?.includes('open') || provider.toLowerCase().includes('meta') || provider.toLowerCase().includes('deepseek') || provider.toLowerCase().includes('qwen') || provider.toLowerCase().includes('mistral'));

    return {
      id: id || '',
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
    };
  }).filter((m): m is ModelRecord => Boolean(m.id && m.intelligence !== null));

  const seenIds = new Set<string>();
  const uniqueModels: ModelRecord[] = [];
  for (const m of processed) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      uniqueModels.push(m);
    }
  }

  uniqueModels.sort((a, b) => (b.intelligence ?? 0) - (a.intelligence ?? 0));
  return uniqueModels;
}
