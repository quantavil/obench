import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { AA_MODELS_URL, SyncError, syncAaModels } from './aaService';
import defaultModels from '../data/models.json';
import type { ModelRecord } from '../types/model';

type KVNamespace = {
  get(key: string, opts: 'text' | { type: 'json' } | { type: 'text' }): Promise<any>;
  get(key: string, opts?: any): Promise<any>;
  put(key: string, value: string, opts?: any): Promise<void>;
};

type Bindings = {
  AA_API_KEY?: string;
  MODELS_KV?: KVNamespace;
  OBENCH_KV?: KVNamespace;
};

export const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

const KV_MODELS_KEY = 'models';
const KV_META_KEY = 'models:meta';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type ModelsMeta = {
  syncedAt: number;
  total: number;
  pagesFetched?: number;
};

app.use('/health', cors());
app.use('/models', cors());

function isCrossOriginMutation(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return true;
  }

  const origin = request.headers.get('origin');
  if (!origin || origin === new URL(request.url).origin) {
    return false;
  }

  try {
    return new URL(origin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}

async function requireSameOriginMutation(c: Context, next: Next) {
  if (isCrossOriginMutation(c.req.raw)) {
    return c.json({
      ok: false,
      code: 'CROSS_ORIGIN_FORBIDDEN',
      error: 'Cross-origin mutation requests are not allowed.',
    }, 403);
  }

  await next();
}

app.use('/test-aa', requireSameOriginMutation);
app.use('/sync', requireSameOriginMutation);

function getConfiguredApiKey(bindingKey?: string): string {
  const processKey = typeof process !== 'undefined' ? process.env?.AA_API_KEY : undefined;
  const configured = bindingKey || processKey;
  return typeof configured === 'string' ? configured.trim() : '';
}

function getKv(c: Context<{ Bindings: Bindings }>): KVNamespace | null {
  return (c.env?.MODELS_KV as KVNamespace) || (c.env?.OBENCH_KV as KVNamespace) || null;
}

function isStale(meta: ModelsMeta | null): boolean {
  if (!meta || typeof meta.syncedAt !== 'number') return true;
  return Date.now() - meta.syncedAt > ONE_DAY_MS;
}

async function persistToKv(kv: KVNamespace, models: ModelRecord[], meta: ModelsMeta) {
  await kv.put(KV_MODELS_KEY, JSON.stringify(models));
  await kv.put(KV_META_KEY, JSON.stringify(meta));
}

function getExecutionContext(c: Context<{ Bindings: Bindings }>): { waitUntil?: (p: Promise<any>) => void } | null {
  const direct = (c as any).executionCtx as { waitUntil?: (p: Promise<any>) => void } | undefined;
  if (direct?.waitUntil) return direct;
  const viaEnv = (c.env as any)?.executionCtx as { waitUntil?: (p: Promise<any>) => void } | undefined;
  if (viaEnv?.waitUntil) return viaEnv;
  return null;
}

function scheduleDailyRefresh(c: Context<{ Bindings: Bindings }>, kv: KVNamespace, apiKey: string) {
  const task = (async () => {
    try {
      const result = await syncAaModels(apiKey);
      const meta: ModelsMeta = {
        syncedAt: Date.now(),
        total: result.totalNormalized,
        pagesFetched: result.pagesFetched,
      };
      await persistToKv(kv, result.models as ModelRecord[], meta);
    } catch (e) {
      console.warn('[kv] daily auto-refresh failed', e);
    }
  })();

  const ctx = getExecutionContext(c);
  if (ctx?.waitUntil) ctx.waitUntil(task);
  else task.catch(() => {});
}

app.get('/health', async (c) => {
  const envKey = getConfiguredApiKey(c.env?.AA_API_KEY);
  const kv = getKv(c);
  let kvStatus: { bound: boolean; hasModels: boolean; lastSyncedAt: number | null } = {
    bound: !!kv,
    hasModels: false,
    lastSyncedAt: null,
  };
  if (kv) {
    try {
      const meta = (await kv.get(KV_META_KEY, { type: 'json' })) as ModelsMeta | null;
      kvStatus.lastSyncedAt = meta?.syncedAt ?? null;
      kvStatus.hasModels = typeof meta?.total === 'number' ? meta.total > 0 : false;
    } catch {}
  }
  return c.json({
    status: 'ok',
    version: '1.0.0',
    service: 'OBench API (Hono + Cloudflare Pages + KV)',
    hasApiKeyConfigured: envKey.length > 0,
    kv: kvStatus,
    timestamp: Date.now(),
  });
});

app.get('/models', async (c) => {
  const kv = getKv(c);
  const apiKey = getConfiguredApiKey(c.env?.AA_API_KEY);

  if (kv) {
    try {
      const [kvModels, kvMeta] = await Promise.all([
        kv.get(KV_MODELS_KEY, { type: 'json' }) as Promise<ModelRecord[] | null>,
        kv.get(KV_META_KEY, { type: 'json' }) as Promise<ModelsMeta | null>,
      ]);

      if (Array.isArray(kvModels) && kvModels.length > 0) {
        if (isStale(kvMeta) && apiKey) scheduleDailyRefresh(c, kv, apiKey);
        return c.json({
          ok: true,
          total: kvModels.length,
          models: kvModels,
          syncedAt: kvMeta?.syncedAt ?? null,
          source: 'kv',
          stale: isStale(kvMeta),
        });
      }

      if (Array.isArray(defaultModels) && defaultModels.length > 0) {
        const meta: ModelsMeta = { syncedAt: Date.now(), total: defaultModels.length };
        const seedTask = persistToKv(kv, defaultModels as ModelRecord[], meta).catch(() => {});
        const ctx = getExecutionContext(c);
        if (ctx?.waitUntil) ctx.waitUntil(seedTask);
        else seedTask.catch(() => {});
        if (apiKey) scheduleDailyRefresh(c, kv, apiKey);
        return c.json({
          ok: true,
          total: defaultModels.length,
          models: defaultModels as ModelRecord[],
          syncedAt: meta.syncedAt,
          source: 'seed',
        });
      }

      if (apiKey) {
        try {
          const result = await syncAaModels(apiKey);
          const meta: ModelsMeta = { syncedAt: Date.now(), total: result.totalNormalized, pagesFetched: result.pagesFetched };
          await persistToKv(kv, result.models as ModelRecord[], meta);
          return c.json({
            ok: true,
            total: result.totalNormalized,
            models: result.models,
            syncedAt: meta.syncedAt,
            source: 'live',
          });
        } catch {}
      }

      return c.json({ ok: false, code: 'KV_EMPTY', error: 'KV is empty and no seed available.' }, 500);
    } catch (e) {
      console.warn('[kv] read failed, falling back to bundled', e);
    }
  }

  return c.json({
    ok: true,
    total: (defaultModels as ModelRecord[]).length,
    models: defaultModels as ModelRecord[],
    source: 'bundled',
  });
});

app.post('/test-aa', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { apiKey?: unknown };
  const envKey = getConfiguredApiKey(c.env?.AA_API_KEY);
  const bodyKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const apiKey = bodyKey || envKey;

  if (!apiKey) {
    return c.json({
      ok: false,
      code: 'CONFIGURATION_ERROR',
      error: 'AA_API_KEY is not configured in Cloudflare environment variables.',
    }, 400);
  }

  try {
    const response = await fetch(AA_MODELS_URL, {
      headers: { 'x-api-key': apiKey },
    });

    if (response.ok) {
      return c.json({ ok: true, message: 'API key validated successfully with Artificial Analysis.' });
    }

    if (response.status === 401 || response.status === 403) {
      return c.json({
        ok: false,
        code: 'UPSTREAM_UNAUTHORIZED',
        error: 'Invalid API key or unauthorized.',
      }, 401);
    }

    return c.json({
      ok: false,
      code: 'UPSTREAM_ERROR',
      error: `Artificial Analysis returned status ${response.status}.`,
    }, 502);
  } catch {
    return c.json({
      ok: false,
      code: 'UPSTREAM_ERROR',
      error: 'Unable to connect to Artificial Analysis.',
    }, 502);
  }
});

app.post('/sync', async (c) => {
  const apiKey = getConfiguredApiKey(c.env?.AA_API_KEY);

  if (!apiKey) {
    return c.json({
      ok: false,
      code: 'CONFIGURATION_ERROR',
      error: 'AA_API_KEY is not set in Cloudflare Pages environment variables. Please add AA_API_KEY in Cloudflare Pages Settings > Environment Variables.',
    }, 400);
  }

  try {
    const result = await syncAaModels(apiKey);
    const syncedAt = Date.now();
    const meta: ModelsMeta = { syncedAt, total: result.totalNormalized, pagesFetched: result.pagesFetched };
    const kv = getKv(c);
    if (kv) {
      try {
        await persistToKv(kv, result.models as ModelRecord[], meta);
      } catch (e) {
        console.warn('[kv] persist failed', e);
      }
    }

    return c.json({
      ok: true,
      ...result,
      syncedAt,
      persisted: !!kv,
    });
  } catch (error) {
    if (error instanceof SyncError) {
      return c.json({
        ok: false,
        code: error.code,
        error: error.message,
      }, 502);
    }

    return c.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      error: 'Model synchronization failed.',
    }, 500);
  }
});
