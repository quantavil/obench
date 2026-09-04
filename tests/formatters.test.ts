import { describe, expect, test } from 'bun:test';
import { fmtDateTimeCompact, fmt1, fmtDate, fmtCost, fmtContext } from '../src/utils/formatters';

describe('formatters', () => {
  test('formats zero as Free and null as unknown', () => {
    expect(fmtCost(0)).toBe('Free');
    expect(fmtCost(null)).toBe('--');
  });

  test('formats non-zero costs properly', () => {
    expect(fmtCost(0.005)).toBe('$0.0050');
    expect(fmtCost(0.05)).toBe('$0.050');
    expect(fmtCost(0.75)).toBe('$0.75');
    expect(fmtCost(15)).toBe('$15');
    expect(fmtCost(150.5)).toBe('$151');
  });
  test('fmtDateTimeCompact formats timestamp consistently', () => {
    const timestamp = Date.parse('2026-08-01T11:54:39.000Z');
    const result = fmtDateTimeCompact(timestamp);
    expect(result).not.toContain(',');
    expect(result.length).toBeGreaterThan(0);
  });

  test('fmtDateTimeCompact handles null / invalid dates gracefully', () => {
    expect(fmtDateTimeCompact(null)).toBe('');
    expect(fmtDateTimeCompact(undefined)).toBe('');
    expect(fmtDateTimeCompact('invalid')).toBe('');
  });

  test('fmt1 formats single decimal precision including integer scores', () => {
    expect(fmt1(95.46)).toBe('95.5');
    expect(fmt1(80)).toBe('80.0');
    expect(fmt1(64)).toBe('64.0');
    expect(fmt1('64')).toBe('64.0');
    expect(fmt1(0)).toBe('0.0');
    expect(fmt1(null)).toBe('--');
    expect(fmt1(undefined)).toBe('--');
  });

  test('fmtDate formats timestamp to readable date', () => {
    expect(fmtDate('2026-08-01')).toContain('2026');
  });

  test('fmtContext formats token context windows without redundancy', () => {
    expect(fmtContext(1000000)).toBe('1M');
    expect(fmtContext(2000000)).toBe('2M');
    expect(fmtContext(128000)).toBe('128k');
    expect(fmtContext(200000)).toBe('200k');
    expect(fmtContext(null)).toBe('--');
    expect(fmtContext(undefined)).toBe('--');
    expect(fmtContext(0)).toBe('--');
  });
});
