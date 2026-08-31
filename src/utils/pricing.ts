import type { ModelRecord, CostBasis } from '../types/model';

export function cachedInput(model: ModelRecord): number | null {
  if (model.price1mCacheRead != null) return model.price1mCacheRead;
  if (model.price1mInput != null) return Math.round(model.price1mInput * 0.25 * 100) / 100;
  return null;
}

export function batchInput(model: ModelRecord): number | null {
  if (model.price1mBatch != null) return model.price1mBatch;
  if (model.price1mInput != null) return Math.round(model.price1mInput * 0.5 * 100) / 100;
  return null;
}

export function batchOutput(model: ModelRecord): number | null {
  if (model.price1mOutput != null) return Math.round(model.price1mOutput * 0.5 * 100) / 100;
  return null;
}

export function calculateModelCost(model: ModelRecord | null | undefined, basis: CostBasis = 'blended'): number | null {
  if (!model) return null;
  if (basis === 'input') return model.price1mInput;
  if (basis === 'output') return model.price1mOutput;
  if (basis === 'cached') return cachedInput(model);
  const input = basis === 'batch' ? batchInput(model) : model.price1mInput;
  const output = basis === 'batch' ? batchOutput(model) : model.price1mOutput;
  if (input == null && output == null) return null;
  const effectiveInput = input ?? output!;
  const effectiveOutput = output ?? input!;
  return (3 * effectiveInput + effectiveOutput) / 4;
}
