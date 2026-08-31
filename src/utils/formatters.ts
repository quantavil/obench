// Formatting helpers for costs, dates, and numbers

export function fmtCost(val: number | null | undefined): string {
  if (val === null || val === undefined) return '--';
  if (typeof val === 'number' && isNaN(val)) return '--';
  if (val === 0) return 'Free';
  if (val < 0.01) return `$${val.toFixed(4)}`;
  if (val < 0.1) return `$${val.toFixed(3)}`;
  if (val < 1) return `$${val.toFixed(2)}`;
  if (val >= 100) return `$${Math.round(val)}`;
  return `$${val.toFixed(2).replace(/\.00$/, '')}`;
}

export function fmt1(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '' || isNaN(Number(val))) return '--';
  return Number(val).toFixed(1);
}

export function fmtDate(val: string | number | null | undefined): string {
  if (!val) return '--';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(val);
  }
}

export function fmtDateTime(ts: number | null | undefined): string {
  if (!ts) return '--';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--';
  }
}

export function fmtDateTimeCompact(ts: any): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = Date.now();
    const diffMin = Math.round((now - d.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}
