import { describe, test, expect } from 'bun:test';
import { shouldLockInspectorScroll, focusableElements } from '../src/store/inspector';
import { bench } from '../src/store/appStore';

describe('UI Markup & Accessibility Invariants', () => {
  test('sortable columns expose button controls and aria-sort', async () => {
    const source = await Bun.file('src/components/TabModels.astro').text();
    expect(source).toContain(':aria-sort="getAriaSort(\'iq\')"');
    expect(source).toContain('aria-label="Sort by intelligence"');
    expect(source).toContain(':aria-sort="getAriaSort(\'speed\')"');
    expect(source).toContain('aria-label="Sort by speed"');
    expect(source).toContain(':aria-sort="getAriaSort(\'blended\')"');
    expect(source).toContain('aria-label="Sort by cost"');
  });

  test('mobile inspector has focus sentinels and labelled controls', async () => {
    const drawer = await Bun.file('src/components/ModelDrawer.astro').text();
    expect(drawer).toContain('x-ref="inspectorDialog"');
    expect(drawer).toContain('aria-label="Input tokens per request"');
    expect(drawer).toContain('aria-label="Output tokens per request"');
    expect(drawer).toContain('aria-label="Requests per day"');
    expect(drawer).toContain('step="100"');
    expect(drawer).toContain('step="50"');
  });

  test('restrained accent tokens and reduced motion are defined', async () => {
    const css = await Bun.file('src/styles/index.css').text();
    expect(css).toContain('--accent: #c8ff00');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('scroll-behavior: auto');
    expect(css).toContain('animation-duration: 0.01ms');
    expect(css).toContain('#8b9490');
  });

  test('inspector helpers handle scroll locking and focusable element discovery', () => {
    expect(shouldLockInspectorScroll(390)).toBe(true);
    expect(shouldLockInspectorScroll(768)).toBe(true);
    expect(shouldLockInspectorScroll(1023)).toBe(true);
    expect(shouldLockInspectorScroll(1024)).toBe(false);
    expect(shouldLockInspectorScroll(1440)).toBe(false);

    const mockElements = [
      { id: 'btn1', hasAttribute: (_attr: string) => false, tabIndex: 0 },
      { id: 'input1', hasAttribute: (_attr: string) => false, tabIndex: 0 },
      { id: 'btnDisabled', hasAttribute: (attr: string) => attr === 'disabled', tabIndex: 0 },
      { id: 'div1', hasAttribute: (_attr: string) => false, tabIndex: -1 },
      { id: 'link1', hasAttribute: (_attr: string) => false, tabIndex: 0 },
    ];
    const mockContainer = {
      querySelectorAll: (_selector: string) => mockElements,
    } as unknown as HTMLElement;

    const elements = focusableElements(mockContainer);
    const ids = elements.map((el) => (el as any).id);
    expect(ids).toEqual(['btn1', 'input1', 'link1']);
  });

  test('toast component is severity-aware with dynamic roles', async () => {
    const toastSource = await Bun.file('src/components/Toast.astro').text();
    expect(toastSource).toContain('toastSeverity');
    expect(toastSource).toContain(':role="toastSeverity === \'error\' ? \'alert\' : \'status\'"');
    expect(toastSource).toContain(':aria-live="toastSeverity === \'error\' ? \'assertive\' : \'polite\'"');
    expect(toastSource).toContain('toastSeverity === \'error\'');
  });

  test('echarts container is wrapped in a labelled figure with accessible summary', async () => {
    const tabSource = await Bun.file('src/components/TabModels.astro').text();
    expect(tabSource).toContain('<figure');
    expect(tabSource).toContain('</figure>');
    expect(tabSource).toContain('id="echarts-container"');
    expect(tabSource).toContain('aria-label');
  });

  test('header contains dynamic aria-pressed and search controls', async () => {
    const headerSource = await Bun.file('src/components/Header.astro').text();
    expect(headerSource).toContain(':aria-pressed=');
    expect(headerSource).toContain('aria-label="Search models"');
    expect(headerSource).toContain(':aria-label=');
  });

  test('store provides getAriaSort and severity-aware toast method', () => {
    const store = bench() as any;
    expect(typeof store.getAriaSort).toBe('function');

    store.sortBy = 'iq-desc';
    expect(store.getAriaSort('iq')).toBe('descending');
    store.sortBy = 'iq-asc';
    expect(store.getAriaSort('iq')).toBe('ascending');
    store.sortBy = 'price-asc';
    expect(store.getAriaSort('iq')).toBe('none');
    expect(store.getAriaSort('blended')).toBe('ascending');
    store.sortBy = 'price-desc';
    expect(store.getAriaSort('blended')).toBe('descending');

    store.toast('Everything ok', 'success');
    expect(store.toastMsg).toBe('Everything ok');
    expect(store.toastSeverity).toBe('success');

    store.toast('Error occurred', 'error');
    expect(store.toastMsg).toBe('Error occurred');
    expect(store.toastSeverity).toBe('error');

    store.toast('Default info');
    expect(store.toastMsg).toBe('Default info');
    expect(store.toastSeverity).toBe('info');
  });
});
