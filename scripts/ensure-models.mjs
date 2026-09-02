#!/usr/bin/env node
// Ensures src/data/models.json exists before build/dev when gitignored + KV is source of truth
// If missing, creates minimal placeholder [] so `import defaultModels from '../data/models.json'` doesn't fail
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const modelsPath = join(dirname(fileURLToPath(import.meta.url)), '../src/data/models.json');
if (!existsSync(modelsPath)) {
  mkdirSync(dirname(modelsPath), { recursive: true });
  writeFileSync(modelsPath, '[]\n', 'utf8');
  console.log('[ensure-models] created placeholder src/data/models.json (KV is source of truth, daily lazy-refresh)');
} else {
  console.log('[ensure-models] src/data/models.json exists, skipping');
}
