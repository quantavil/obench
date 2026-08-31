import { defineConfig } from 'astro/config';
import alpinejs from '@astrojs/alpinejs';
import tailwindcss from '@tailwindcss/vite';
import { app } from './src/server/app.js';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function requestHeaders(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

async function writeResponse(response, res) {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

function firstHeaderValue(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.split(',', 1)[0].trim() : '';
}

function proxyRequestUrl(req) {
  const host = firstHeaderValue(req.headers.host) || 'localhost';
  const forwardedProto = firstHeaderValue(req.headers['x-forwarded-proto']).toLowerCase();
  const protocol = forwardedProto === 'http' || forwardedProto === 'https'
    ? forwardedProto
    : req.socket?.encrypted
      ? 'https'
      : 'http';
  return new URL(req.url || '/', `${protocol}://${host}`);
}

function aaProxyPlugin() {
  return {
    name: 'aa-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = proxyRequestUrl(req);
        const pathname = requestUrl.pathname;
        if (req.method !== 'POST' || (pathname !== '/api/test-aa' && pathname !== '/api/sync')) {
          next();
          return;
        }

        try {
          const body = await readBody(req);
          const request = new Request(requestUrl, {
            method: req.method,
            headers: requestHeaders(req),
            body: body || undefined,
          });
          const response = await app.fetch(request, {
            AA_API_KEY: process.env.AA_API_KEY,
          });
          await writeResponse(response, res);
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: false,
            code: 'INTERNAL_ERROR',
            error: 'Development API adapter failed.',
          }));
        }
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
