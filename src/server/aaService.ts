import type { ModelRecord } from '../types/model';
import { AA_MODELS_URL, normalizeAaRecords } from '../utils/aaNormalize';

export { AA_MODELS_URL };

export const AA_ORIGIN = new URL(AA_MODELS_URL).origin;

/**
 * Hard pagination budget for one synchronization attempt. A response that still
 * has a next page after this budget is rejected as incomplete.
 */
export const MAX_SYNC_PAGES = 25;

/**
 * Hard raw-record budget for one synchronization attempt. A page that would
 * exceed this total is rejected before any of its records are accepted.
 */
export const MAX_RECORDS = 10_000;

export type SyncErrorCode =
  | 'INVALID_PAGINATION_URL'
  | 'INVALID_RESPONSE'
  | 'SYNC_INCOMPLETE'
  | 'UPSTREAM_ERROR';

export class SyncError extends Error {
  constructor(
    public readonly code: SyncErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export interface SyncResult {
  models: ModelRecord[];
  pagesFetched: number;
  totalRaw: number;
  totalNormalized: number;
  skippedRecords: number;
  complete: true;
}

type AaPageObject = {
  data: unknown[];
  pagination?: {
    next_page_url?: unknown;
  } | null;
  next_page_url?: unknown;
};

function validateAaPageUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new SyncError('INVALID_PAGINATION_URL', 'Artificial Analysis returned an invalid pagination URL.');
  }

  const expectedPath = new URL(AA_MODELS_URL).pathname;
  if (
    parsed.protocol !== 'https:'
    || parsed.origin !== AA_ORIGIN
    || parsed.pathname !== expectedPath
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.hash !== ''
  ) {
    throw new SyncError('INVALID_PAGINATION_URL', 'Artificial Analysis returned an untrusted pagination URL.');
  }

  return parsed;
}

function parsePage(payload: unknown): { records: unknown[]; nextUrl: string | null } {
  if (Array.isArray(payload)) {
    return { records: payload, nextUrl: null };
  }

  if (payload === null || typeof payload !== 'object' || !Array.isArray((payload as AaPageObject).data)) {
    throw new SyncError('INVALID_RESPONSE', 'Artificial Analysis returned an invalid page.');
  }

  const page = payload as AaPageObject;
  if (
    page.pagination !== undefined
    && page.pagination !== null
    && (typeof page.pagination !== 'object' || Array.isArray(page.pagination))
  ) {
    throw new SyncError('INVALID_RESPONSE', 'Artificial Analysis returned invalid pagination metadata.');
  }

  const rawNextUrl = page.pagination?.next_page_url ?? page.next_page_url;
  if (rawNextUrl === undefined || rawNextUrl === null || rawNextUrl === '') {
    return { records: page.data, nextUrl: null };
  }
  if (typeof rawNextUrl !== 'string') {
    throw new SyncError('INVALID_RESPONSE', 'Artificial Analysis returned invalid pagination metadata.');
  }

  return { records: page.data, nextUrl: rawNextUrl };
}

function isNormalizableRecord(record: unknown): record is Record<string, unknown> {
  return record !== null && typeof record === 'object' && !Array.isArray(record);
}

export async function syncAaModels(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SyncResult> {
  const visited = new Set<string>();
  const records: unknown[] = [];
  let nextUrl: string | null = AA_MODELS_URL;

  while (nextUrl !== null) {
    if (visited.size >= MAX_SYNC_PAGES) {
      throw new SyncError('SYNC_INCOMPLETE', `Artificial Analysis pagination limit (${MAX_SYNC_PAGES} pages) reached.`);
    }

    const parsed = validateAaPageUrl(nextUrl);
    if (visited.has(parsed.href)) {
      throw new SyncError('SYNC_INCOMPLETE', 'Artificial Analysis pagination cycle detected.');
    }
    visited.add(parsed.href);

    let response: Response;
    try {
      response = await fetchImpl(parsed.href, {
        headers: { 'x-api-key': apiKey },
      });
    } catch {
      throw new SyncError('UPSTREAM_ERROR', 'Unable to reach Artificial Analysis.');
    }

    if (!response.ok) {
      throw new SyncError('UPSTREAM_ERROR', `Artificial Analysis returned status ${response.status}.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SyncError('INVALID_RESPONSE', 'Artificial Analysis returned invalid JSON.');
    }

    const page = parsePage(payload);
    if (records.length + page.records.length > MAX_RECORDS) {
      throw new SyncError('SYNC_INCOMPLETE', `Artificial Analysis record limit (${MAX_RECORDS} records) reached.`);
    }
    records.push(...page.records);
    nextUrl = page.nextUrl;
  }

  const normalizableRecords = records.filter(isNormalizableRecord);
  const models = normalizeAaRecords(normalizableRecords);

  return {
    models,
    pagesFetched: visited.size,
    totalRaw: records.length,
    totalNormalized: models.length,
    skippedRecords: records.length - models.length,
    complete: true,
  };
}
