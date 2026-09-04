import * as echarts from 'echarts/core';
import { ScatterChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  AriaComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { providerColor } from '../utils/providers';
import { computeEfficiencyFrontier, computeSotaProgression, parseReleaseTs } from '../utils/frontier';
import { calculateModelCost } from '../utils/pricing';
import { fmtCost, fmt1 } from '../utils/formatters';
import type { ModelRecord, CostBasis, PlotMetricMode } from '../types/model';

echarts.use([
  ScatterChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  AriaComponent,
  SVGRenderer,
]);

let activeChartInstance: echarts.EChartsType | null = null;

export function destroyActiveChart(): void {
  if (activeChartInstance) {
    try {
      activeChartInstance.dispose();
    } catch (e) {}
    activeChartInstance = null;
  }
}

export function resizeActiveChart(): void {
  if (activeChartInstance) {
    try {
      activeChartInstance.resize();
    } catch (e) {}
  }
}

/** Restore both axes to the full data range after inside-zoom panning. */
export function resetActiveChartZoom(): void {
  if (activeChartInstance) {
    try {
      activeChartInstance.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    } catch (e) {}
  }
}

export function getLogAxisBounds(costs: number[]): { min: number; max: number } {
  const valid = costs.filter((cost) => Number.isFinite(cost) && cost > 0);
  if (valid.length === 0) return { min: 0.01, max: 100 };
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return {
    min: 10 ** Math.floor(Math.log10(min)),
    max: 10 ** Math.ceil(Math.log10(max)),
  };
}

type ThemeColors = {
  text: string;
  subText: string;
  gridLine: string;
  axisLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  laserColor: string;
};

function themeColors(isDark: boolean): ThemeColors {
  return {
    text: isDark ? '#fafafa' : '#09090b',
    subText: isDark ? '#a1a1aa' : '#71717a',
    gridLine: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    axisLine: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    tooltipBg: isDark ? '#141417' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
    laserColor: isDark ? '#34d399' : '#059669',
  };
}

type AxisSpec = {
  logName: string;
  linearName: string;
  bounds: { min: number; max: number };
  linearMax: number;
  labelFormatter: string;
};

function makeXAxis(spec: AxisSpec, scale: 'log' | 'linear', theme: ThemeColors) {
  const shared = {
    nameLocation: 'middle' as const,
    nameGap: 34,
    nameTextStyle: { color: theme.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
    axisLine: { lineStyle: { color: theme.axisLine } },
    splitLine: { lineStyle: { color: theme.gridLine, type: 'dashed' } },
    axisLabel: { color: theme.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: spec.labelFormatter },
  };
  return scale === 'log'
    ? { type: 'log' as const, logBase: 10, name: spec.logName, min: spec.bounds.min, max: spec.bounds.max, ...shared }
    : { type: 'value' as const, name: spec.linearName, min: 0, max: spec.linearMax, ...shared };
}

function makeYAxis(name: string, theme: ThemeColors, labelFormatter?: string) {
  return {
    type: 'value' as const,
    name,
    nameLocation: 'middle' as const,
    nameGap: 40,
    nameTextStyle: { color: theme.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
    scale: true,
    axisLabel: { color: theme.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, ...(labelFormatter ? { formatter: labelFormatter } : {}) },
    axisLine: { lineStyle: { color: theme.axisLine } },
    splitLine: { lineStyle: { color: theme.gridLine } },
  };
}

function tooltipHeader(m: ModelRecord, iq: number | null, theme: ThemeColors, isDark: boolean): string {
  return `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
      <div style="font-weight: 700; font-size: 13px; color: ${theme.text}; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${m.name}
      </div>
      <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 9999px; background: ${isDark ? '#fafafa' : '#09090b'}; color: ${isDark ? '#09090b' : '#fafafa'};">
        ${fmt1(iq)} IQ
      </span>
    </div>`;
}

function tooltipShell(inner: string, _theme?: ThemeColors): string {
  return `
    <div style="padding: 12px 14px; min-width: 220px; font-family: 'Geist', system-ui, sans-serif;">
      ${inner}
    </div>`;
}

function tooltipConfig(formatter: (params: any) => string, theme: ThemeColors) {
  return {
    trigger: 'item' as const,
    backgroundColor: theme.tooltipBg,
    borderColor: theme.tooltipBorder,
    borderWidth: 1,
    padding: 0,
    extraCssText: 'border-radius: 12px; box-shadow: 0 16px 36px -8px rgba(0,0,0,0.5); z-index: 100;',
    formatter,
  };
}

function emptyState(containerEl: HTMLElement, message: string): void {
  containerEl.innerHTML = `<div class="flex items-center justify-center h-full text-sm text-[var(--soft)] font-mono">${message}</div>`;
}

/** Bind a click handler that opens the inspector for the clicked point. */
function bindPointClick(chart: echarts.EChartsType, onModelClick?: (m: ModelRecord) => void): void {
  chart.off('click');
  if (!onModelClick) return;
  chart.on('click', (params: any) => {
    const m = params?.data?.model as ModelRecord | undefined;
    if (m) onModelClick(m);
  });
}

function ensureChart(containerEl: HTMLElement): echarts.EChartsType {
  let chart = activeChartInstance;
  if (!chart || chart.getDom() !== containerEl) {
    destroyActiveChart();
    chart = echarts.init(containerEl, null, { renderer: 'svg' });
    activeChartInstance = chart;
  }
  return chart;
}

const INSIDE_ZOOM = [{
  type: 'inside' as const,
  xAxisIndex: [0],
  yAxisIndex: [0],
  filterMode: 'none' as const,
  zoomOnMouseWheel: true,
  moveOnMouseMove: true,
  preventDefaultMouseMove: true,
  minSpan: 8,
  maxSpan: 100,
}];

export function renderEChartsPlot(
  containerEl: HTMLElement | null,
  models: ModelRecord[],
  costBasis: CostBasis = 'blended',
  metricMode: PlotMetricMode = 'iq-cost',
  isDark = true,
  plotScale: 'log' | 'linear' = 'log',
  onModelClick?: (m: ModelRecord) => void,
): echarts.EChartsType | undefined {
  if (!containerEl) return;
  if (containerEl.clientWidth === 0 || containerEl.clientHeight === 0) {
    setTimeout(() => {
      if (containerEl.clientWidth > 0 && containerEl.clientHeight > 0) {
        renderEChartsPlot(containerEl, models, costBasis, metricMode, isDark, plotScale, onModelClick);
      }
    }, 50);
    return;
  }

  const scored = (models || []).filter((m) => m && m.intelligence != null);
  if (!scored.length) {
    emptyState(containerEl, 'No models match your filters or have benchmark data.');
    return;
  }

  const theme = themeColors(isDark);
  const chart = ensureChart(containerEl);
  let option: any = {};

  if (metricMode === 'iq-speed' || metricMode === 'ttft-speed') {
    // ---------------------------------------------- Speed / Latency scatters (X respects Log/Linear)
    const isTtft = metricMode === 'ttft-speed';
    const valid = scored.filter((m) =>
      isTtft
        ? typeof m.speedTps === 'number' && typeof m.latencyTtft === 'number' && (m.latencyTtft as number) > 0
        : typeof m.speedTps === 'number' && m.speedTps > 0,
    );
    const xVals = valid.map((m) => (isTtft ? (m.latencyTtft as number) : (m.speedTps as number)));

    const scatterData = valid.map((m) => ({
      name: m.name,
      value: [isTtft ? m.latencyTtft : m.speedTps, isTtft ? m.speedTps : m.intelligence],
      model: m,
      itemStyle: {
        color: providerColor(m.provider),
        borderColor: 'rgba(0,0,0,0.2)',
        borderWidth: 1,
        shadowBlur: 3,
      },
    }));

    option = {
      aria: { enabled: true },
      animation: false,
      backgroundColor: 'transparent',
      grid: { top: 36, right: 28, bottom: 60, left: 54, containLabel: true },
      tooltip: tooltipConfig((params: any) => {
        const m: ModelRecord = params.data.model;
        return tooltipShell(
          tooltipHeader(m, m.intelligence, theme, isDark) + `
          <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${theme.subText};">
            TTFT: <b style="color:${theme.text}">${m.latencyTtft ? `${m.latencyTtft}s` : '--'}</b> · Speed: <b style="color:${theme.text}">${m.speedTps ?? '--'}</b>
          </div>`,
          theme,
        );
      }, theme),
      xAxis: makeXAxis(
        isTtft
          ? { logName: 'Time to First Token (seconds, log scale)', linearName: 'Time to First Token (seconds, lower is better)', bounds: getLogAxisBounds(xVals), linearMax: xVals.length ? Math.ceil(Math.max(...xVals) * 1.15) : 5, labelFormatter: '{value}s' }
          : { logName: 'Output Speed (tokens / second, log scale)', linearName: 'Output Speed (tokens / second)', bounds: getLogAxisBounds(xVals), linearMax: xVals.length ? Math.ceil(Math.max(...xVals) * 1.15) : 200, labelFormatter: '{value} tps' },
        plotScale,
        theme,
      ),
      yAxis: isTtft
        ? makeYAxis('Output Speed (tokens / second)', theme, '{value} tps')
        : makeYAxis('Intelligence Index (IQ)', theme),
      dataZoom: INSIDE_ZOOM,
      series: [
        {
          name: 'Models',
          type: 'scatter',
          data: scatterData,
          symbolSize: 10,
          emphasis: { focus: 'self', scale: 1.8 },
        },
      ],
    };
  } else {
    // ---------------------------------------------- Default: IQ vs Cost ($)
    // Exclude -- models (null or 0 -> frontend shows --) from scatter/frontier
    const withCost = scored
      .map((m) => {
        const costVal = calculateModelCost(m, costBasis);
        return { ...m, cost: costVal ?? 0, realCost: costVal };
      })
      .filter((m) => m.realCost != null && m.realCost > 0);

    const validCosts = withCost.map((m) => m.cost).filter((c) => Number.isFinite(c) && c > 0);
    const frontier = computeEfficiencyFrontier(models, costBasis);
    const frontierSet = new Set(frontier.map((m) => m.id));

    const scatterData = withCost.map((m) => ({
      name: m.name,
      value: [m.cost, m.intelligence],
      model: m,
      isFrontier: frontierSet.has(m.id),
      itemStyle: {
        color: providerColor(m.provider),
        borderColor: frontierSet.has(m.id) ? theme.laserColor : 'rgba(0,0,0,0.15)',
        borderWidth: frontierSet.has(m.id) ? 2 : 1,
        shadowBlur: frontierSet.has(m.id) ? 8 : 2,
        shadowColor: frontierSet.has(m.id) ? (isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)') : 'rgba(0,0,0,0.15)',
      },
    }));

    const frontierLineData = frontier.map((m) => [calculateModelCost(m, costBasis) || 0.01, m.intelligence]);

    option = {
      aria: { enabled: true },
      animation: false,
      backgroundColor: 'transparent',
      grid: { top: 36, right: 28, bottom: 60, left: 54, containLabel: true },
      tooltip: tooltipConfig((params: any) => {
        const m: any = params.data.model;
        if (!m) return '';
        const costStr = m.realCost !== null ? (m.realCost === 0 ? 'Free' : `${fmtCost(m.realCost)}/1M`) : '--';
        const inStr = m.price1mInput !== null ? (m.price1mInput === 0 ? 'Free' : `$${m.price1mInput}`) : '--';
        const outStr = m.price1mOutput !== null ? (m.price1mOutput === 0 ? 'Free' : `$${m.price1mOutput}`) : '--';
        return tooltipShell(
          tooltipHeader(m, m.intelligence, theme, isDark) + `
          <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${theme.subText}; margin-bottom: 8px;">
            ${m.provider} · Speed: ${m.speedTps ? `${m.speedTps}` : '--'}
          </div>
          <div style="padding-top: 8px; border-top: 1px solid ${theme.gridLine}; display: flex; justify-content: space-between; font-size: 11px; font-family: 'JetBrains Mono', monospace;">
            <span style="color: ${theme.subText};">Effective Rate</span>
            <span style="font-weight: 700; color: ${theme.text};">${costStr}</span>
          </div>
          <div style="margin-top: 4px; display: flex; justify-content: space-between; font-size: 10px; font-family: 'JetBrains Mono', monospace; color: ${theme.subText};">
            <span>In: ${inStr} / 1M</span>
            <span>Out: ${outStr} / 1M</span>
          </div>`,
          theme,
        );
      }, theme),
      xAxis: makeXAxis(
        { logName: 'Cost per 1M tokens ($, log scale)', linearName: 'Cost per 1M tokens ($, linear)', bounds: getLogAxisBounds(validCosts), linearMax: validCosts.length ? Math.ceil(Math.max(...validCosts) * 1.15) : 100, labelFormatter: '$' + '{value}' },
        plotScale,
        theme,
      ),
      yAxis: makeYAxis('Intelligence Index (IQ)', theme),
      dataZoom: INSIDE_ZOOM,
      series: [
        {
          name: 'Pareto Frontier',
          type: 'line',
          data: frontierLineData,
          smooth: 0.2,
          symbol: 'none',
          lineStyle: {
            color: theme.laserColor,
            width: 2.2,
            type: 'dashed',
            shadowColor: isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)',
            shadowBlur: 6,
          },
          z: 2,
        },
        {
          name: 'Models',
          type: 'scatter',
          data: scatterData,
          symbolSize: (data: any) => (data.isFrontier ? 14 : 9),
          emphasis: { focus: 'self', scale: 1.8 },
          z: 3,
        },
      ],
    };
  }

  bindPointClick(chart, onModelClick);
  chart.setOption(option, true);
  return chart;
}

export function renderEChartsTimeline(
  containerEl: HTMLElement | null,
  models: ModelRecord[],
  isDark = true,
  onModelClick?: (m: ModelRecord) => void,
): echarts.EChartsType | undefined {
  if (!containerEl) return;
  if (containerEl.clientWidth === 0 || containerEl.clientHeight === 0) {
    setTimeout(() => {
      if (containerEl.clientWidth > 0 && containerEl.clientHeight > 0) {
        renderEChartsTimeline(containerEl, models, isDark, onModelClick);
      }
    }, 50);
    return;
  }

  const parsed = (models || [])
    .filter((m) => m && m.intelligence != null && m.releasedAt)
    .map((m) => ({ ...m, timestamp: parseReleaseTs(m.releasedAt!) }))
    .filter((m) => m.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!parsed.length) {
    emptyState(containerEl, 'No models match your filters or have release dates.');
    return;
  }

  const sotaProgression = computeSotaProgression(models);
  const sotaSet = new Set(sotaProgression.map((m) => m.id));
  const theme = themeColors(isDark);
  const chart = ensureChart(containerEl);

  const scatterData = parsed.map((m) => ({
    name: m.name,
    value: [m.releasedAt, m.intelligence],
    model: m,
    isSota: sotaSet.has(m.id),
    itemStyle: {
      color: providerColor(m.provider),
      borderColor: sotaSet.has(m.id) ? theme.laserColor : 'rgba(0,0,0,0.15)',
      borderWidth: sotaSet.has(m.id) ? 2 : 1,
      shadowBlur: sotaSet.has(m.id) ? 8 : 2,
      shadowColor: sotaSet.has(m.id) ? (isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)') : 'rgba(0,0,0,0.15)',
    },
  }));

  const sotaLineData = sotaProgression.map((m) => [m.releasedAt, m.intelligence]);

  const option = {
    aria: { enabled: true },
    animation: false,
    backgroundColor: 'transparent',
    grid: { top: 36, right: 28, bottom: 60, left: 54, containLabel: true },
    tooltip: tooltipConfig((params: any) => {
      const m: ModelRecord = params.data.model;
      if (!m) return '';
      return tooltipShell(
        tooltipHeader(m, m.intelligence, theme, isDark) + `
        <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${theme.subText};">
          ${m.provider} · Released ${m.releasedAt}
        </div>`,
        theme,
      );
    }, theme),
    xAxis: {
      type: 'time',
      name: 'Release Date',
      nameLocation: 'middle',
      nameGap: 34,
      nameTextStyle: { color: theme.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      axisLabel: { color: theme.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
      axisLine: { lineStyle: { color: theme.axisLine } },
      splitLine: { lineStyle: { color: theme.gridLine, type: 'dashed' } },
    },
    yAxis: makeYAxis('Intelligence Index (IQ)', theme),
    dataZoom: [{ ...INSIDE_ZOOM[0], minSpan: 10 }],
    series: [
      {
        name: 'SOTA Progression',
        type: 'line',
        data: sotaLineData,
        step: 'end',
        symbol: 'none',
        lineStyle: {
          color: theme.laserColor,
          width: 2.2,
          type: 'dashed',
          shadowColor: isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)',
          shadowBlur: 6,
        },
        z: 2,
      },
      {
        name: 'Models',
        type: 'scatter',
        data: scatterData,
        symbolSize: (data: any) => (data.isSota ? 14 : 9),
        emphasis: { focus: 'self', scale: 1.8 },
        z: 3,
      },
    ],
  };

  bindPointClick(chart, onModelClick);
  chart.setOption(option, true);
  return chart;
}
