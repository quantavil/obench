import { test, expect } from 'bun:test';
import { app } from '../src/server/app';

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
  const res = await app.request('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.ok).toBe(false);
  expect(json.error).toContain('Cloudflare');
});
