import { defineConfig } from 'astro/config';
import alpinejs from '@astrojs/alpinejs';
import tailwindcss from '@tailwindcss/vite';
import { AA_MODELS_URL, normalizeAaRecords } from './src/utils/aaNormalize.js';

function aaProxyPlugin() {
  return {
    name: 'aa-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && (req.url === '/api/test-aa' || req.url === '/api/sync')) {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', async () => {
            try {
              const body = bodyStr ? JSON.parse(bodyStr) : {};
              const apiKey = (body.apiKey || '').trim();

              if (!apiKey) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: 'API key is required.' }));
                return;
              }

              if (req.url === '/api/test-aa') {
                const upstream = await fetch(AA_MODELS_URL, {
                  headers: { 'x-api-key': apiKey },
                });
                if (upstream.ok) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ok: true }));
                } else {
                  res.statusCode = upstream.status;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ok: false, error: `Artificial Analysis rejected key (${upstream.status})` }));
                }
                return;
              }

              if (req.url === '/api/sync') {
                let allRecords = [];
                let nextUrl = AA_MODELS_URL;
                let pageCount = 0;

                while (nextUrl && pageCount < 10) {
                  pageCount++;
                  const upstream = await fetch(nextUrl, {
                    headers: { 'x-api-key': apiKey },
                  });

                  if (!upstream.ok) {
                    res.statusCode = upstream.status;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: false, error: `Artificial Analysis API returned status ${upstream.status}` }));
                    return;
                  }

                  const json = await upstream.json();
                  const batch = Array.isArray(json) ? json : json.data || [];
                  allRecords = allRecords.concat(batch);

                  if (json.pagination && json.pagination.next_page_url) {
                    nextUrl = json.pagination.next_page_url;
                  } else if (json.next_page_url) {
                    nextUrl = json.next_page_url;
                  } else {
                    nextUrl = null;
                  }
                }

                const models = normalizeAaRecords(allRecords);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  ok: true,
                  models,
                  syncedAt: Date.now(),
                  totalRaw: allRecords.length,
                }));
                return;
              }
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [alpinejs()],
  vite: {
    plugins: [tailwindcss(), aaProxyPlugin()],
  },
});
