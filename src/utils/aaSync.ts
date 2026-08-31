// Client-side helper for syncing Artificial Analysis models via Hono Cloudflare API
import type { ModelRecord } from '../types/model';

export async function fetchAaModels(): Promise<ModelRecord[]> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok || !Array.isArray(json.models)) {
    throw new Error(json.error || `Sync failed with status ${res.status}`);
  }

  return json.models as ModelRecord[];
}
