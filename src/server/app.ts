import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { normalizeAaRecords, AA_MODELS_URL } from '../utils/aaNormalize';
import defaultModels from '../data/models.json';
import type { ModelRecord } from '../types/model';

type Bindings = {
  AA_API_KEY?: string;
};

export const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// Global middleware
app.use('*', cors());

// 1. Healthcheck & Cloudflare Config Status
app.get('/health', (c) => {
  const envKey = c.env?.AA_API_KEY || (typeof process !== 'undefined' ? process.env?.AA_API_KEY : undefined);
  return c.json({
    status: 'ok',
    version: '1.0.0',
    service: 'OBench API (Hono + Cloudflare Pages)',
    hasApiKeyConfigured: Boolean(envKey && envKey.trim().length > 0),
    timestamp: Date.now(),
  });
});

// 2. Direct Models Endpoint (Serves bundled dataset)
app.get('/models', (c) => {
  return c.json({
    ok: true,
    total: defaultModels.length,
    models: defaultModels as ModelRecord[],
  });
});

// 3. Test Artificial Analysis API Key (from Cloudflare env or optional body)
app.post('/test-aa', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const envKey = c.env?.AA_API_KEY || (typeof process !== 'undefined' ? process.env?.AA_API_KEY : undefined);
    const apiKey = (typeof body.apiKey === 'string' && body.apiKey.trim()) ? body.apiKey.trim() : (envKey || '').trim();

    if (!apiKey) {
      return c.json({ ok: false, error: 'AA_API_KEY is not configured in Cloudflare environment variables.' }, 400);
    }

    const res = await fetch(AA_MODELS_URL, {
      headers: { 'x-api-key': apiKey },
    });

    if (res.ok) {
      return c.json({ ok: true, message: 'API key validated successfully with Artificial Analysis.' });
    }

    if (res.status === 401 || res.status === 403) {
      return c.json({ ok: false, error: 'Invalid API key or unauthorized.' }, 401);
    }

    return c.json({ ok: false, error: `Artificial Analysis returned status ${res.status}` }, 400);
  } catch (err: any) {
    return c.json({ ok: false, error: `Connection failed: ${err.message}` }, 500);
  }
});

// 4. Sync Models from Artificial Analysis using Cloudflare AA_API_KEY
app.post('/sync', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const envKey = c.env?.AA_API_KEY || (typeof process !== 'undefined' ? process.env?.AA_API_KEY : undefined);
    const apiKey = (typeof body.apiKey === 'string' && body.apiKey.trim()) ? body.apiKey.trim() : (envKey || '').trim();

    if (!apiKey) {
      return c.json({
        ok: false,
        error: 'AA_API_KEY is not set in Cloudflare Pages environment variables. Please add AA_API_KEY in Cloudflare Pages Settings > Environment Variables.',
      }, 400);
    }

    let allRecords: any[] = [];
    let nextUrl: string | null = AA_MODELS_URL;
    let pageCount = 0;

    while (nextUrl && pageCount < 10) {
      pageCount++;
      const fetchRes: Response = await fetch(nextUrl, {
        headers: { 'x-api-key': apiKey },
      });

      if (!fetchRes.ok) {
        return c.json({ ok: false, error: `Artificial Analysis returned status ${fetchRes.status}` }, fetchRes.status as any);
      }

      const jsonData: any = await fetchRes.json();
      const batch = Array.isArray(jsonData) ? jsonData : jsonData.data || [];
      allRecords = allRecords.concat(batch);

      if (jsonData.pagination && jsonData.pagination.next_page_url) {
        nextUrl = jsonData.pagination.next_page_url;
      } else if (jsonData.next_page_url) {
        nextUrl = jsonData.next_page_url;
      } else {
        nextUrl = null;
      }
    }

    const models = normalizeAaRecords(allRecords);
    return c.json({
      ok: true,
      models,
      syncedAt: Date.now(),
      totalRaw: allRecords.length,
      pagesFetched: pageCount,
    });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message || 'Internal server error' }, 500);
  }
});
