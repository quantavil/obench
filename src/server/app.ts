import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { AA_MODELS_URL, SyncError, syncAaModels } from './aaService';
import defaultModels from '../data/models.json';
import type { ModelRecord } from '../types/model';

type Bindings = {
  AA_API_KEY?: string;
};

export const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// Public read-only routes remain cross-origin readable. Mutation routes are
// deliberately same-origin and receive no Access-Control-Allow-Origin header.
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

app.get('/health', (c) => {
  const envKey = getConfiguredApiKey(c.env?.AA_API_KEY);
  return c.json({
    status: 'ok',
    version: '1.0.0',
    service: 'OBench API (Hono + Cloudflare Pages)',
    hasApiKeyConfigured: envKey.length > 0,
    timestamp: Date.now(),
  });
});

app.get('/models', (c) => {
  return c.json({
    ok: true,
    total: defaultModels.length,
    models: defaultModels as ModelRecord[],
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
  // Normal synchronization trusts only server configuration, never request data.
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
    return c.json({
      ok: true,
      ...result,
      syncedAt: Date.now(),
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
