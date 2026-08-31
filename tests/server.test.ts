import { afterEach, expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import astroConfig from '../astro.config.mjs';
import { app } from '../src/server/app';
import { AA_MODELS_URL, MAX_RECORDS, MAX_SYNC_PAGES } from '../src/server/aaService';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  globalThis.fetch = Object.assign(handler, { preconnect: originalFetch.preconnect });
}

function aaRecord(id: string) {
  return {
    id,
    name: `Model ${id}`,
    provider: 'Test Provider',
    intelligence: 80,
  };
}

function syncRequest(
  env: { AA_API_KEY?: string } = {},
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return app.request('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }, env);
}

function devProxyRequest(
  origin: string,
  options: { forwardedProto?: string } = {},
): Promise<Response> {
  return new Promise((resolve, reject) => {
    type DevProxyMiddleware = (
      req: unknown,
      res: unknown,
      next: () => void,
    ) => void | Promise<void>;
    type DevProxyPlugin = {
      name?: string;
      configureServer?: (server: {
        middlewares: { use(handler: DevProxyMiddleware): void };
      }) => void;
    };
    const plugins = (astroConfig as unknown as { vite: { plugins: unknown[] } })
      .vite.plugins.flat(Number.POSITIVE_INFINITY) as DevProxyPlugin[];
    const proxyPlugin = plugins.find((plugin) => plugin?.name === 'aa-proxy');
    let proxyMiddleware: DevProxyMiddleware | undefined;
    proxyPlugin?.configureServer?.({
      middlewares: {
        use(handler) {
          proxyMiddleware = handler;
        },
      },
    });
    if (!proxyMiddleware) {
      reject(new Error('Development proxy middleware was not registered'));
      return;
    }

    const req = Object.assign(new EventEmitter(), {
      method: 'POST',
      url: '/api/sync',
      headers: {
        host: '127.0.0.1:4322',
        origin,
        'content-type': 'application/json',
        ...(options.forwardedProto ? { 'x-forwarded-proto': options.forwardedProto } : {}),
      },
      socket: { encrypted: false },
      setEncoding() {},
    });
    const responseHeaders = new Headers();
    const res = {
      statusCode: 200,
      setHeader(name: string, value: string | number | readonly string[]) {
        responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : String(value));
      },
      end(body?: Uint8Array | string) {
        const responseBody = body instanceof Uint8Array ? new TextDecoder().decode(body) : body;
        resolve(new Response(responseBody, { status: this.statusCode, headers: responseHeaders }));
      },
    };

    const originalApiKey = process.env.AA_API_KEY;
    process.env.AA_API_KEY = 'key';
    void Promise.resolve(proxyMiddleware(req, res, () => reject(new Error('Proxy unexpectedly called next()'))))
      .finally(() => {
        if (originalApiKey === undefined) delete process.env.AA_API_KEY;
        else process.env.AA_API_KEY = originalApiKey;
      });
    req.emit('data', '{}');
    req.emit('end');
  });
}

test('Hono API > GET /api/health returns ok status', async () => {
  const res = await app.request('/api/health');
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.status).toBe('ok');
  expect(json.service).toContain('Hono');
});

test('Hono API > GET /api/models returns bundled dataset', async () => {
  const res = await app.request('/api/models');
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(Array.isArray(json.models)).toBe(true);
  expect(json.models.length).toBeGreaterThan(0);
});

test('Hono API > POST /api/test-aa returns 400 when AA_API_KEY is not configured', async () => {
  const res = await app.request('/api/test-aa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.ok).toBe(false);
  expect(json.error).toContain('AA_API_KEY');
});

test('Hono API > POST /api/sync returns 400 when AA_API_KEY is not configured in Cloudflare', async () => {
  const res = await syncRequest();
  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.ok).toBe(false);
  expect(json.error).toContain('Cloudflare');
});

test('sync uses only the configured API key and ignores a body key', async () => {
  const sentKeys: Array<string | null> = [];
  stubFetch(async (_input, init) => {
    sentKeys.push(new Headers(init?.headers).get('x-api-key'));
    return Response.json({ data: [aaRecord('safe')] });
  });

  const response = await syncRequest({ AA_API_KEY: 'configured-key' }, { apiKey: 'body-key' });
  const bodyOnlyResponse = await syncRequest({}, { apiKey: 'body-key' });

  expect(response.status).toBe(200);
  expect(bodyOnlyResponse.status).toBe(400);
  expect(sentKeys).toEqual(['configured-key']);
});

test('sync rejects a cross-origin POST before calling upstream', async () => {
  let fetches = 0;
  stubFetch(async () => {
    fetches += 1;
    return Response.json({ data: [aaRecord('unsafe')] });
  });

  const response = await syncRequest({ AA_API_KEY: 'key' }, {}, {
    Origin: 'https://evil.example',
  });
  const json = await response.json();

  expect(response.status).toBe(403);
  expect(json).toMatchObject({ ok: false, code: 'CROSS_ORIGIN_FORBIDDEN' });
  expect(fetches).toBe(0);
});

test('test-aa rejects cross-site fetch metadata before calling upstream', async () => {
  let fetches = 0;
  stubFetch(async () => {
    fetches += 1;
    return Response.json({ ok: true });
  });

  const response = await app.request('/api/test-aa', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'cross-site',
    },
    body: JSON.stringify({}),
  }, { AA_API_KEY: 'key' });

  expect(response.status).toBe(403);
  expect(fetches).toBe(0);
});

test('sync preserves same-origin browser requests', async () => {
  let fetches = 0;
  stubFetch(async () => {
    fetches += 1;
    return Response.json({ data: [aaRecord('safe')] });
  });

  const response = await syncRequest({ AA_API_KEY: 'key' }, {}, {
    Origin: 'http://localhost',
    'Sec-Fetch-Site': 'same-origin',
  });

  expect(response.status).toBe(200);
  expect(fetches).toBe(1);
});

test('development proxy preserves the request origin and still rejects cross-origin posts', async () => {
  let fetches = 0;
  stubFetch(async () => {
    fetches += 1;
    return Response.json({ data: [aaRecord(`dev-${fetches}`)] });
  });

  const localResponse = await devProxyRequest('http://127.0.0.1:4322');
  const forwardedHttpsResponse = await devProxyRequest('https://127.0.0.1:4322', {
    forwardedProto: 'https',
  });
  const hostileResponse = await devProxyRequest('https://evil.example');

  expect(localResponse.status).toBe(200);
  expect(forwardedHttpsResponse.status).toBe(200);
  expect(hostileResponse.status).toBe(403);
  expect(fetches).toBe(2);
});

test('sync rejects an off-origin next page without forwarding the API key', async () => {
  const calls: Array<{ url: string; key: string | null }> = [];
  stubFetch(async (input, init) => {
    calls.push({ url: String(input), key: new Headers(init?.headers).get('x-api-key') });
    return Response.json({
      data: [aaRecord('safe')],
      pagination: { next_page_url: 'https://attacker.example/steal' },
    });
  });

  const response = await syncRequest({ AA_API_KEY: 'TOPSECRET' });
  const json = await response.json();

  expect(response.status).toBe(502);
  expect(json).toMatchObject({ ok: false, code: 'INVALID_PAGINATION_URL' });
  expect(calls).toEqual([{ url: AA_MODELS_URL, key: 'TOPSECRET' }]);
  expect(JSON.stringify(json)).not.toContain('TOPSECRET');
});

test('sync detects pagination cycles explicitly', async () => {
  let fetches = 0;
  stubFetch(async () => {
    fetches += 1;
    return Response.json({
      data: [aaRecord('loop')],
      pagination: { next_page_url: AA_MODELS_URL },
    });
  });

  const response = await syncRequest({ AA_API_KEY: 'key' });
  const json = await response.json();

  expect(response.status).toBe(502);
  expect(json).toMatchObject({ ok: false, code: 'SYNC_INCOMPLETE' });
  expect(json.error).toContain('cycle');
  expect(fetches).toBe(1);
});

test('sync fails instead of returning success when the page budget is exhausted', async () => {
  let fetches = 0;
  stubFetch(async () => {
    fetches += 1;
    return Response.json({
      data: [aaRecord(`page-${fetches}`)],
      pagination: { next_page_url: `${AA_MODELS_URL}?page=${fetches + 1}` },
    });
  });

  const response = await syncRequest({ AA_API_KEY: 'key' });
  const json = await response.json();

  expect(response.status).toBe(502);
  expect(json).toMatchObject({ ok: false, code: 'SYNC_INCOMPLETE' });
  expect(json.error).toContain('limit');
  expect(fetches).toBe(MAX_SYNC_PAGES);
});

test('sync allows the record boundary and rejects the page that would exceed it', async () => {
  stubFetch(async () => Response.json({ data: Array(MAX_RECORDS).fill(null) }));

  const boundaryResponse = await syncRequest({ AA_API_KEY: 'key' });
  const boundaryJson = await boundaryResponse.json();

  expect(boundaryResponse.status).toBe(200);
  expect(boundaryJson).toMatchObject({ totalRaw: MAX_RECORDS, complete: true });

  let fetches = 0;
  stubFetch(async () => {
    fetches += 1;
    return fetches === 1
      ? Response.json({
        data: Array(MAX_RECORDS - 1).fill(null),
        pagination: { next_page_url: `${AA_MODELS_URL}?page=2` },
      })
      : Response.json({ data: [null, null] });
  });

  const overflowResponse = await syncRequest({ AA_API_KEY: 'key' });
  const overflowJson = await overflowResponse.json();

  expect(overflowResponse.status).toBe(502);
  expect(overflowJson).toMatchObject({ ok: false, code: 'SYNC_INCOMPLETE' });
  expect(overflowJson.error).toContain('record limit');
  expect(fetches).toBe(2);
});

test('sync skips malformed records and reports complete synchronization metadata', async () => {
  stubFetch(async () => Response.json({
    data: [null, aaRecord('valid')],
    pagination: { next_page_url: null },
  }));

  const response = await syncRequest({ AA_API_KEY: 'key' });
  const json = await response.json();

  expect(response.status).toBe(200);
  expect(json).toMatchObject({
    ok: true,
    pagesFetched: 1,
    totalRaw: 2,
    skippedRecords: 1,
    complete: true,
  });
  expect(json.models.map((model: { id: string }) => model.id)).toEqual(['valid']);
});

test('sync rejects an invalid upstream page shape with a structured error', async () => {
  stubFetch(async () => Response.json({ data: { id: 'not-an-array' } }));

  const response = await syncRequest({ AA_API_KEY: 'key' });
  const json = await response.json();

  expect(response.status).toBe(502);
  expect(json).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
});

test('sync preflight does not grant wildcard cross-origin access', async () => {
  const response = await app.request('/api/sync', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'POST',
    },
  });

  expect(response.headers.get('access-control-allow-origin')).not.toBe('*');
});

test('test-aa preflight does not grant wildcard cross-origin access', async () => {
  const response = await app.request('/api/test-aa', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'POST',
    },
  });

  expect(response.headers.get('access-control-allow-origin')).not.toBe('*');
});
