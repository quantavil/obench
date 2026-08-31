import * as echarts from 'echarts';
import { providerColor } from '../utils/providers';
import { computeEfficiencyFrontier, computeSotaProgression, calculateModelCost } from '../utils/frontier';
import { fmtCost, fmt1 } from '../utils/formatters';
import type { ModelRecord, CostBasis, PlotMetricMode } from '../types/model';

let activeChartInstance: echarts.ECharts | null = null;

export function destroyActiveChart(): void {
  if (activeChartInstance) {
    try {
      activeChartInstance.dispose();
    } catch (e) {}
    activeChartInstance = null;
  }
}

export function renderEChartsPlot(
  containerEl: HTMLElement | null,
  models: ModelRecord[],
  costBasis: CostBasis = 'blended',
  metricMode: PlotMetricMode = 'iq-cost',
  isDark = true
): echarts.ECharts | undefined {
  if (!containerEl) return;
  destroyActiveChart();

  const scored = (models || []).filter((m) => m && m.intelligence != null);
  if (!scored.length) {
    containerEl.innerHTML = '<div class="flex items-center justify-center h-full text-sm text-[var(--soft)] font-mono">No models match your filters or have benchmark data.</div>';
    return;
  }

  const themeColors = {
    bg: 'transparent',
    text: isDark ? '#fafafa' : '#09090b',
    subText: isDark ? '#a1a1aa' : '#71717a',
    gridLine: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    axisLine: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    tooltipBg: isDark ? '#141417' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
    laserColor: isDark ? '#34d399' : '#059669',
  };

  const chart = echarts.init(containerEl, null, { renderer: 'svg' });
  activeChartInstance = chart;

  let option: any = {};

  if (metricMode === 'iq-speed') {
    // ---------------------------------------------------- IQ vs Speed (TPS)
    const valid = scored.filter((m) => typeof m.speedTps === 'number' && m.speedTps > 0);
    const scatterData = valid.map((m) => ({
      name: m.name,
      value: [m.speedTps, m.intelligence],
      model: m,
      itemStyle: {
        color: providerColor(m.provider),
        borderColor: 'rgba(0,0,0,0.2)',
        borderWidth: 1,
        shadowBlur: 3,
      },
    }));

    option = {
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      backgroundColor: themeColors.bg,
      grid: { top: 36, right: 28, bottom: 60, left: 54, containLabel: true },
      tooltip: {
        trigger: 'item',
        backgroundColor: themeColors.tooltipBg,
        borderColor: themeColors.tooltipBorder,
        borderWidth: 1,
        padding: 0,
        extraCssText: 'border-radius: 12px; box-shadow: 0 16px 36px -8px rgba(0,0,0,0.5); z-index: 100;',
        formatter: (params: any) => {
          const m: ModelRecord = params.data.model;
          return `
            <div style="padding: 12px 14px; min-width: 220px; font-family: 'Geist', system-ui, sans-serif;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
                <div style="font-weight: 700; font-size: 13px; color: ${themeColors.text}; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${m.name}
                </div>
                <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 9999px; background: ${isDark ? '#fafafa' : '#09090b'}; color: ${isDark ? '#09090b' : '#fafafa'};">
                  ${fmt1(m.intelligence)} IQ
                </span>
              </div>
              <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${themeColors.subText}; margin-bottom: 6px;">
                ${m.provider} · Speed: <b style="color:${themeColors.text}">${m.speedTps}</b>
              </div>
              <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${themeColors.subText};">
                TTFT: ${m.latencyTtft ? `${m.latencyTtft}s` : '--'} · Context: ${m.contextWindow ? `${Math.round(m.contextWindow/1000)}k` : '--'}
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'value',
        name: 'Output Speed (tokens / second)',
        nameLocation: 'middle',
        nameGap: 34,
        nameTextStyle: { color: themeColors.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
        axisLabel: { color: themeColors.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: '{value} tps' },
        axisLine: { lineStyle: { color: themeColors.axisLine } },
        splitLine: { lineStyle: { color: themeColors.gridLine, type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'Intelligence Index (IQ)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: themeColors.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
        scale: true,
        axisLabel: { color: themeColors.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        axisLine: { lineStyle: { color: themeColors.axisLine } },
        splitLine: { lineStyle: { color: themeColors.gridLine } },
      },
      dataZoom: [{ type: 'inside', xAxisIndex: [0] }],
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
  } else if (metricMode === 'ttft-speed') {
    // ---------------------------------------------------- Latency (TTFT) vs Throughput (TPS)
    const valid = scored.filter((m) => typeof m.speedTps === 'number' && typeof m.latencyTtft === 'number');
    const scatterData = valid.map((m) => ({
      name: m.name,
      value: [m.latencyTtft, m.speedTps],
      model: m,
      itemStyle: {
        color: providerColor(m.provider),
        borderColor: 'rgba(0,0,0,0.2)',
        borderWidth: 1,
        shadowBlur: 3,
      },
    }));

    option = {
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      backgroundColor: themeColors.bg,
      grid: { top: 36, right: 28, bottom: 60, left: 54, containLabel: true },
      tooltip: {
        trigger: 'item',
        backgroundColor: themeColors.tooltipBg,
        borderColor: themeColors.tooltipBorder,
        borderWidth: 1,
        padding: 0,
        extraCssText: 'border-radius: 12px; box-shadow: 0 16px 36px -8px rgba(0,0,0,0.5); z-index: 100;',
        formatter: (params: any) => {
          const m: ModelRecord = params.data.model;
          return `
            <div style="padding: 12px 14px; min-width: 220px; font-family: 'Geist', system-ui, sans-serif;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
                <div style="font-weight: 700; font-size: 13px; color: ${themeColors.text}; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${m.name}
                </div>
                <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 9999px; background: ${isDark ? '#fafafa' : '#09090b'}; color: ${isDark ? '#09090b' : '#fafafa'};">
                  ${fmt1(m.intelligence)} IQ
                </span>
              </div>
              <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${themeColors.subText};">
                TTFT: <b>${m.latencyTtft}s</b> · Speed: <b>${m.speedTps}</b>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'value',
        name: 'Time to First Token (seconds, lower is better)',
        nameLocation: 'middle',
        nameGap: 34,
        nameTextStyle: { color: themeColors.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
        axisLabel: { color: themeColors.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: '{value}s' },
        axisLine: { lineStyle: { color: themeColors.axisLine } },
        splitLine: { lineStyle: { color: themeColors.gridLine, type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'Output Speed (tokens / second)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: themeColors.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
        scale: true,
        axisLabel: { color: themeColors.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: '{value} tps' },
        axisLine: { lineStyle: { color: themeColors.axisLine } },
        splitLine: { lineStyle: { color: themeColors.gridLine } },
      },
      dataZoom: [{ type: 'inside', xAxisIndex: [0] }],
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
    // ---------------------------------------------------- Default: IQ vs Cost ($)
    // Exclude -- models (null or 0 -> frontend shows --) from scatter/frontier
    const withCost = scored
      .map((m) => {
        const costVal = calculateModelCost(m, costBasis);
        return {
          ...m,
          cost: costVal ?? 0,
          realCost: costVal,
          unpriced: costVal == null || costVal === 0,
        };
      })
      .filter((m) => m.realCost != null && m.realCost !== 0 && m.cost > 0);

    // Frontier should also ignore -- models
    const frontier = computeEfficiencyFrontier(
      models.filter((m) => {
        const c = calculateModelCost(m as any, costBasis);
        return c != null && c !== 0;
      }),
      costBasis
    );
    const frontierSet = new Set(frontier.map((m) => m.id));

    const scatterData = withCost.map((m) => ({
      name: m.name,
      value: [m.cost, m.intelligence],
      model: m,
      isFrontier: frontierSet.has(m.id),
      itemStyle: {
        color: providerColor(m.provider),
        borderColor: frontierSet.has(m.id) ? (isDark ? '#34d399' : '#059669') : 'rgba(0,0,0,0.15)',
        borderWidth: frontierSet.has(m.id) ? 2 : 1,
        shadowBlur: frontierSet.has(m.id) ? 8 : 2,
        shadowColor: frontierSet.has(m.id) ? (isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)') : 'rgba(0,0,0,0.15)',
      },
    }));

    const frontierLineData = frontier.map((m) => {
      const c = calculateModelCost(m, costBasis) || 0.01;
      return [c, m.intelligence];
    });

    option = {
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      backgroundColor: themeColors.bg,
      grid: { top: 36, right: 28, bottom: 60, left: 54, containLabel: true },
      tooltip: {
        trigger: 'item',
        backgroundColor: themeColors.tooltipBg,
        borderColor: themeColors.tooltipBorder,
        borderWidth: 1,
        padding: 0,
        extraCssText: 'border-radius: 12px; box-shadow: 0 16px 36px -8px rgba(0,0,0,0.5); z-index: 100;',
        formatter: (params: any) => {
          const m: any = params.data.model;
          if (!m) return '';
          const costStr = m.realCost !== null ? (m.realCost === 0 ? '--' : `${fmtCost(m.realCost)}/1M`) : '--';
          const inStr = m.price1mInput !== null ? (m.price1mInput === 0 ? '--' : `$${m.price1mInput}`) : '--';
          const outStr = m.price1mOutput !== null ? (m.price1mOutput === 0 ? '--' : `$${m.price1mOutput}`) : '--';

          return `
            <div style="padding: 12px 14px; min-width: 220px; font-family: 'Geist', system-ui, sans-serif;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
                <div style="font-weight: 700; font-size: 13px; color: ${themeColors.text}; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${m.name}
                </div>
                <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 9999px; background: ${isDark ? '#fafafa' : '#09090b'}; color: ${isDark ? '#09090b' : '#fafafa'};">
                  ${fmt1(m.intelligence)} IQ
                </span>
              </div>
              <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${themeColors.subText}; margin-bottom: 8px;">
                ${m.provider} · Speed: ${m.speedTps ? `${m.speedTps}` : '--'}
              </div>
              <div style="padding-top: 8px; border-top: 1px solid ${themeColors.gridLine}; display: flex; justify-content: space-between; font-size: 11px; font-family: 'JetBrains Mono', monospace;">
                <span style="color: ${themeColors.subText};">Effective Rate</span>
                <span style="font-weight: 700; color: ${themeColors.text};">${costStr}</span>
              </div>
              <div style="margin-top: 4px; display: flex; justify-content: space-between; font-size: 10px; font-family: 'JetBrains Mono', monospace; color: ${themeColors.subText};">
                <span>In: ${inStr} / 1M</span>
                <span>Out: ${outStr} / 1M</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'log',
        logBase: 10,
        name: 'Cost per 1M tokens ($, log scale)',
        nameLocation: 'middle',
        nameGap: 34,
        nameTextStyle: { color: themeColors.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
        min: 0.01,
        max: 120,
        axisLabel: { color: themeColors.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: (val: any) => `$${val}` },
        axisLine: { lineStyle: { color: themeColors.axisLine } },
        splitLine: { lineStyle: { color: themeColors.gridLine, type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'Intelligence Index (IQ)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: themeColors.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
        scale: true,
        axisLabel: { color: themeColors.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        axisLine: { lineStyle: { color: themeColors.axisLine } },
        splitLine: { lineStyle: { color: themeColors.gridLine } },
      },
      dataZoom: [{ type: 'inside', xAxisIndex: [0] }],
      series: [
        {
          name: 'Pareto Frontier',
          type: 'line',
          data: frontierLineData,
          smooth: 0.2,
          symbol: 'none',
          lineStyle: {
            color: themeColors.laserColor,
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

  chart.setOption(option);
  return chart;
}

export function renderEChartsTimeline(
  containerEl: HTMLElement | null,
  models: ModelRecord[],
  isDark = true
): echarts.ECharts | undefined {
  if (!containerEl) return;
  destroyActiveChart();

  const parsed = (models || [])
    .filter((m) => m && m.intelligence != null && m.releasedAt)
    .map((m) => ({
      ...m,
      timestamp: Date.parse(m.releasedAt!.includes('-') && m.releasedAt!.length === 7 ? `${m.releasedAt}-01` : m.releasedAt!) || 0,
    }))
    .filter((m) => m.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!parsed.length) {
    containerEl.innerHTML = '<div class="flex items-center justify-center h-full text-sm text-[var(--soft)] font-mono">No models match your filters or have release dates.</div>';
    return;
  }

  const sotaProgression = computeSotaProgression(models);
  const sotaSet = new Set(sotaProgression.map((m) => m.id));

  const scatterData = parsed.map((m) => ({
    name: m.name,
    value: [m.releasedAt, m.intelligence],
    model: m,
    isSota: sotaSet.has(m.id),
    itemStyle: {
      color: providerColor(m.provider),
      borderColor: sotaSet.has(m.id) ? (isDark ? '#34d399' : '#059669') : 'rgba(0,0,0,0.15)',
      borderWidth: sotaSet.has(m.id) ? 2 : 1,
      shadowBlur: sotaSet.has(m.id) ? 8 : 2,
      shadowColor: sotaSet.has(m.id) ? (isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)') : 'rgba(0,0,0,0.15)',
    },
  }));

  const sotaLineData = sotaProgression.map((m) => [m.releasedAt, m.intelligence]);

  const themeColors = {
    bg: 'transparent',
    text: isDark ? '#fafafa' : '#09090b',
    subText: isDark ? '#a1a1aa' : '#71717a',
    gridLine: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    axisLine: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    tooltipBg: isDark ? '#141417' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
    laserColor: isDark ? '#34d399' : '#059669',
  };

  const chart = echarts.init(containerEl, null, { renderer: 'svg' });
  activeChartInstance = chart;

  const option = {
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    backgroundColor: themeColors.bg,
    grid: { top: 36, right: 28, bottom: 60, left: 54, containLabel: true },
    tooltip: {
      trigger: 'item',
      backgroundColor: themeColors.tooltipBg,
      borderColor: themeColors.tooltipBorder,
      borderWidth: 1,
      padding: 0,
      extraCssText: 'border-radius: 12px; box-shadow: 0 16px 36px -8px rgba(0,0,0,0.5); z-index: 100;',
      formatter: (params: any) => {
        const m: ModelRecord = params.data.model;
        if (!m) return '';
        return `
          <div style="padding: 12px 14px; min-width: 220px; font-family: 'Geist', system-ui, sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
              <div style="font-weight: 700; font-size: 13px; color: ${themeColors.text}; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${m.name}
              </div>
              <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 9999px; background: ${isDark ? '#fafafa' : '#09090b'}; color: ${isDark ? '#09090b' : '#fafafa'};">
                ${fmt1(m.intelligence)} IQ
              </span>
            </div>
            <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${themeColors.subText};">
              ${m.provider} · Released ${m.releasedAt}
            </div>
          </div>
        `;
      },
    },
    xAxis: {
      type: 'time',
      name: 'Release Date',
      nameLocation: 'middle',
      nameGap: 34,
      nameTextStyle: { color: themeColors.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      axisLabel: { color: themeColors.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
      axisLine: { lineStyle: { color: themeColors.axisLine } },
      splitLine: { lineStyle: { color: themeColors.gridLine, type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: 'Intelligence Index (IQ)',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: { color: themeColors.subText, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      scale: true,
      axisLabel: { color: themeColors.subText, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
      axisLine: { lineStyle: { color: themeColors.axisLine } },
      splitLine: { lineStyle: { color: themeColors.gridLine } },
    },
    dataZoom: [{ type: 'inside', xAxisIndex: [0] }],
    series: [
      {
        name: 'SOTA Progression',
        type: 'line',
        data: sotaLineData,
        step: 'end',
        symbol: 'none',
        lineStyle: {
          color: themeColors.laserColor,
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

  chart.setOption(option);
  return chart;
}
