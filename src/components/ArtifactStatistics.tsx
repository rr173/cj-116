import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../store/useAppStore';
import {
  ARTIFACT_CATEGORIES,
  ArtifactCategory,
  CATEGORY_COLORS,
  ArtifactSubtype,
  Period,
} from '../types';
import {
  topologicalSortUnits,
  computeUnitStats,
  computePeriodStats,
  exportStatsToCSV,
  downloadCSV,
  UnitArtifactStats,
} from '../utils';

type StatsTab = 'unitStacked' | 'periodPie' | 'compare';
type CompareMode = 'unit' | 'period';

interface TooltipData {
  x: number;
  y: number;
  content: React.ReactNode;
}

export default function ArtifactStatistics() {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const allUnits = useAppStore((state) => state.units);
  const allRelations = useAppStore((state) => state.relations);
  const allArtifacts = useAppStore((state) => state.artifacts);
  const allSubtypes = useAppStore((state) => state.artifactSubtypes);
  const allFeatures = useAppStore((state) => state.features);
  const allPeriods = useAppStore((state) => state.periods);

  const [activeTab, setActiveTab] = useState<StatsTab>('unitStacked');
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [chartWidth, setChartWidth] = useState(800);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [compareMode, setCompareMode] = useState<CompareMode>('unit');
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');

  const units = useMemo(() => allUnits.filter(u => u.trenchId === selectedTrenchId), [allUnits, selectedTrenchId]);
  const relations = useMemo(() => allRelations.filter(r => r.trenchId === selectedTrenchId), [allRelations, selectedTrenchId]);
  const artifacts = useMemo(() => allArtifacts.filter(a => a.trenchId === selectedTrenchId), [allArtifacts, selectedTrenchId]);
  const periods = useMemo(() => allPeriods.filter(p => p.trenchId === selectedTrenchId).sort((a, b) => a.order - b.order), [allPeriods, selectedTrenchId]);
  const features = useMemo(() => allFeatures.filter(f => f.trenchId === selectedTrenchId), [allFeatures, selectedTrenchId]);

  const unitToPeriod = useMemo(() => {
    const map = new Map<string, string>();
    features.forEach(f => {
      if (f.unitId && f.periodId) {
        map.set(f.unitId, f.periodId);
      }
    });
    return map;
  }, [features]);

  const sortedUnitIds = useMemo(() => topologicalSortUnits(units, relations), [units, relations]);
  const unitStatsMap = useMemo(() => computeUnitStats(units, artifacts, allSubtypes), [units, artifacts, allSubtypes]);
  const periodStatsMap = useMemo(() => computePeriodStats(periods, units, artifacts, allSubtypes, unitToPeriod), [periods, units, artifacts, allSubtypes, unitToPeriod]);

  useEffect(() => {
    if (chartContainerRef.current) {
      setChartWidth(chartContainerRef.current.clientWidth);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current) {
        setChartWidth(chartContainerRef.current.clientWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (compareMode === 'unit' && sortedUnitIds.length >= 2) {
      if (!compareA) setCompareA(sortedUnitIds[0]);
      if (!compareB) setCompareB(sortedUnitIds[sortedUnitIds.length - 1]);
    } else if (compareMode === 'period' && periods.length >= 2) {
      if (!compareA) setCompareA(periods[0].id);
      if (!compareB) setCompareB(periods[periods.length - 1].id);
    }
  }, [compareMode, sortedUnitIds, periods, compareA, compareB]);

  const handleExportStatsCSV = () => {
    const unitsWithData = sortedUnitIds.filter(id => (unitStatsMap.get(id)?.total || 0) > 0);
    const csv = exportStatsToCSV(unitsWithData, units, allSubtypes, unitStatsMap);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `遗物组合统计_${date}.csv`);
  };

  const getSubtypeById = (id: string) => allSubtypes.find(s => s.id === id);

  const unitsWithData = useMemo(
    () => sortedUnitIds.filter(id => (unitStatsMap.get(id)?.total || 0) > 0),
    [sortedUnitIds, unitStatsMap]
  );

  const stackedData = useMemo(() => {
    const result: Array<{
      unitId: string;
      category: ArtifactCategory;
      value: number;
      y0: number;
      y1: number;
    }> = [];
    unitsWithData.forEach(unitId => {
      let cumulative = 0;
      const stats = unitStatsMap.get(unitId)!;
      ARTIFACT_CATEGORIES.forEach(cat => {
        const val = stats.categoryCounts[cat];
        result.push({
          unitId,
          category: cat,
          value: val,
          y0: cumulative,
          y1: cumulative + val,
        });
        cumulative += val;
      });
    });
    return result;
  }, [unitsWithData, unitStatsMap]);

  const handleBarHover = useCallback((e: React.MouseEvent<SVGRectElement>, d: typeof stackedData[0]) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const containerRect = chartContainerRef.current?.getBoundingClientRect();
    const unit = units.find(u => u.id === d.unitId)!;
    const stats = unitStatsMap.get(d.unitId)!;
    const pct = stats.total > 0 ? ((d.value / stats.total) * 100).toFixed(1) : '0';
    setTooltip({
      x: rect.left - (containerRect?.left || 0) + rect.width / 2,
      y: rect.top - (containerRect?.top || 0) - 8,
      content: (
        <div className="text-xs">
          <div className="font-semibold text-gray-800 mb-1">{unit.code} - {unit.name}</div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[d.category] }} />
            <span>{d.category}: <b>{d.value}</b> ({pct}%)</span>
          </div>
        </div>
      ),
    });
  }, [units, unitStatsMap]);

  const handlePieHover = useCallback((e: React.MouseEvent<SVGGElement>, category: ArtifactCategory, value: number, total: number) => {
    const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
    const pct = ((value / total) * 100).toFixed(1);
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      content: (
        <div className="text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[category] }} />
            <span className="font-semibold">{category}</span>
          </div>
          <div className="mt-1">数量: <b>{value}</b></div>
          <div>占比: <b>{pct}%</b></div>
        </div>
      ),
    });
  }, []);

  const renderStackedBarChart = () => {
    if (unitsWithData.length === 0) {
      return (
        <div className="h-80 flex flex-col items-center justify-center text-gray-400">
          <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>暂无数据 - 请先登记遗物并分配地层单位</p>
        </div>
      );
    }

    const height = 400;
    const margin = { top: 20, right: 30, bottom: 80, left: 50 };
    const innerW = chartWidth - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    if (innerW <= 0) return null;

    const x = d3.scaleBand()
      .domain(unitsWithData)
      .range([0, innerW])
      .padding(0.15);

    const maxTotal = d3.max(unitsWithData, id => unitStatsMap.get(id)!.total) || 1;
    const y = d3.scaleLinear()
      .domain([0, maxTotal])
      .nice()
      .range([innerH, 0]);

    return (
      <div ref={chartContainerRef} className="relative w-full">
        <svg width={chartWidth} height={height} className="w-full">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {y.ticks(5).map(tickVal => (
              <g key={tickVal}>
                <line
                  x1={0}
                  y1={y(tickVal)}
                  x2={innerW}
                  y2={y(tickVal)}
                  stroke="#e5e7eb"
                  strokeDasharray="3,3"
                />
                <text
                  x={-8}
                  y={y(tickVal)}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={12}
                  fill="#6b7280"
                >
                  {tickVal}
                </text>
              </g>
            ))}

            {unitsWithData.map(unitId => {
              const unit = units.find(u => u.id === unitId)!;
              return (
                <text
                  key={unitId}
                  x={x(unitId)! + x.bandwidth() / 2}
                  y={innerH + 20}
                  textAnchor="end"
                  fontSize={11}
                  fill="#4b5563"
                  transform={`rotate(-35, ${x(unitId)! + x.bandwidth() / 2}, ${innerH + 20})`}
                >
                  {unit.code}
                </text>
              );
            })}

            <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#d1d5db" />

            {stackedData.filter(d => d.value > 0).map((d, i) => {
              const barX = x(d.unitId)!;
              const barY = y(d.y1);
              const barH = y(d.y0) - y(d.y1);
              return (
                <rect
                  key={i}
                  x={barX}
                  y={barY}
                  width={x.bandwidth()}
                  height={Math.max(barH, 0)}
                  fill={CATEGORY_COLORS[d.category]}
                  opacity={0.85}
                  className="cursor-pointer transition-opacity hover:opacity-100"
                  onMouseEnter={(e) => handleBarHover(e, d)}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}

            <text
              x={-margin.left + 10}
              y={innerH / 2}
              transform={`rotate(-90, ${-margin.left + 10}, ${innerH / 2})`}
              textAnchor="middle"
              fontSize={12}
              fill="#6b7280"
            >
              出土数量
            </text>
          </g>
        </svg>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          {ARTIFACT_CATEGORIES.map(cat => (
            <div key={cat} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
              {cat}
            </div>
          ))}
        </div>
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl z-10"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {tooltip.content}
            <div
              className="absolute w-2 h-2 bg-gray-900 rotate-45"
              style={{ bottom: -4, left: '50%', marginLeft: -4 }}
            />
          </div>
        )}
      </div>
    );
  };

  const renderPieChart = (
    stats: { categoryCounts: Record<ArtifactCategory, number>; total: number },
    size: number = 220,
    showLabels: boolean = true
  ) => {
    const data = ARTIFACT_CATEGORIES
      .map(cat => ({ category: cat, value: stats.categoryCounts[cat] }))
      .filter(d => d.value > 0);

    if (data.length === 0 || stats.total === 0) {
      return (
        <div className="flex items-center justify-center text-gray-400 text-sm" style={{ width: size, height: size }}>
          无数据
        </div>
      );
    }

    const radius = size / 2;
    const innerRadius = radius * 0.55;
    const pie = d3.pie<{ category: ArtifactCategory; value: number }>()
      .value(d => d.value)
      .sort(null);
    const arc = d3.arc<d3.PieArcDatum<{ category: ArtifactCategory; value: number }>>()
      .innerRadius(innerRadius)
      .outerRadius(radius - 2);

    const arcs = pie(data);

    return (
      <div className="flex flex-col items-center">
        <svg width={size} height={size} className="overflow-visible">
          <g transform={`translate(${radius},${radius})`}>
            {arcs.map((a, i) => {
              const [cx, cy] = arc.centroid(a);
              const pct = ((a.data.value / stats.total) * 100).toFixed(1);
              return (
                <g key={i}
                  className="cursor-pointer"
                  onMouseEnter={(e) => handlePieHover(e, a.data.category, a.data.value, stats.total)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <path
                    d={arc(a) || undefined}
                    fill={CATEGORY_COLORS[a.data.category]}
                    stroke="white"
                    strokeWidth={2}
                    className="transition-opacity hover:opacity-85"
                  />
                  {showLabels && a.data.value / stats.total > 0.05 && (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={11}
                      fill="white"
                      fontWeight="bold"
                    >
                      {pct}%
                    </text>
                  )}
                </g>
              );
            })}
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={20}
              fontWeight="bold"
              fill="#1f2937"
            >
              {stats.total}
            </text>
            <text
              y={18}
              textAnchor="middle"
              fontSize={11}
              fill="#6b7280"
            >
              合计
            </text>
          </g>
        </svg>
      </div>
    );
  };

  const renderPeriodPieSection = () => {
    if (periods.length === 0) {
      return (
        <div className="h-80 flex flex-col items-center justify-center text-gray-400">
          <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          <p>请先创建时期并将遗迹分配至各时期</p>
        </div>
      );
    }

    const periodsWithData = periods.filter(p => (periodStatsMap.get(p.id)?.total || 0) > 0);

    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {periodsWithData.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            各时期暂无遗物数据
          </div>
        ) : (
          periodsWithData.map(p => {
            const stats = periodStatsMap.get(p.id)!;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: p.color }} />
                  <h4 className="font-semibold text-gray-800">{p.name}</h4>
                </div>
                {renderPieChart(stats, 180, false)}
                <div className="mt-3 text-center text-xs text-gray-500">
                  {p.dateRange} · 共 {stats.total} 件
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const getCompareStats = (id: string, mode: CompareMode) => {
    if (mode === 'unit') {
      return unitStatsMap.get(id);
    } else {
      return periodStatsMap.get(id);
    }
  };

  const getCompareOptions = (mode: CompareMode) => {
    if (mode === 'unit') {
      return sortedUnitIds
        .filter(id => (unitStatsMap.get(id)?.total || 0) > 0)
        .map(id => {
          const u = units.find(x => x.id === id)!;
          return { value: id, label: `${u.code} - ${u.name}` };
        });
    } else {
      return periods
        .filter(p => (periodStatsMap.get(p.id)?.total || 0) > 0)
        .map(p => ({ value: p.id, label: `${p.name} (${p.dateRange})` }));
    }
  };

  const computeTopDiffSubtypes = () => {
    const statsA = getCompareStats(compareA, compareMode);
    const statsB = getCompareStats(compareB, compareMode);
    if (!statsA || !statsB) return [];

    const allSubtypeIds = new Set<string>();
    statsA.subtypeCounts.forEach((_, id) => allSubtypeIds.add(id));
    statsB.subtypeCounts.forEach((_, id) => allSubtypeIds.add(id));

    const diffs = Array.from(allSubtypeIds).map(id => {
      const countA = statsA.subtypeCounts.get(id) || 0;
      const countB = statsB.subtypeCounts.get(id) || 0;
      return {
        subtypeId: id,
        countA,
        countB,
        diff: Math.abs(countA - countB),
      };
    });

    diffs.sort((a, b) => b.diff - a.diff);
    return diffs.slice(0, 5);
  };

  const renderCompareSection = () => {
    const options = getCompareOptions(compareMode);
    const statsA = getCompareStats(compareA, compareMode);
    const statsB = getCompareStats(compareB, compareMode);
    const topDiffs = computeTopDiffSubtypes();

    if (options.length === 0) {
      return (
        <div className="h-80 flex flex-col items-center justify-center text-gray-400">
          <p>暂无数据可供对比</p>
        </div>
      );
    }

    const labelA = options.find(o => o.value === compareA)?.label || '';
    const labelB = options.find(o => o.value === compareB)?.label || '';

    return (
      <div>
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            <button
              onClick={() => { setCompareMode('unit'); setCompareA(''); setCompareB(''); }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                compareMode === 'unit' ? 'bg-white text-earth-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              地层单位对比
            </button>
            <button
              onClick={() => { setCompareMode('period'); setCompareA(''); setCompareB(''); }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                compareMode === 'period' ? 'bg-white text-earth-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              时期对比
            </button>
          </div>
          <select
            value={compareA}
            onChange={e => setCompareA(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500"
          >
            <option value="">选择{compareMode === 'unit' ? '地层单位A' : '时期A'}</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="text-gray-400 font-semibold text-lg">VS</span>
          <select
            value={compareB}
            onChange={e => setCompareB(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500"
          >
            <option value="">选择{compareMode === 'unit' ? '地层单位B' : '时期B'}</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {statsA && statsB ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="mb-3 pb-2 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-800 truncate">{labelA}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">共 {statsA.total} 件</p>
                </div>
                <div className="flex justify-center">
                  {renderPieChart(statsA, 240, false)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {ARTIFACT_CATEGORIES.map(cat => {
                    const v = statsA.categoryCounts[cat];
                    if (v === 0) return null;
                    const pct = ((v / statsA.total) * 100).toFixed(1);
                    return (
                      <div key={cat} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                          {cat}
                        </div>
                        <span className="font-medium text-gray-800">{v} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="mb-3 pb-2 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-800 truncate">{labelB}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">共 {statsB.total} 件</p>
                </div>
                <div className="flex justify-center">
                  {renderPieChart(statsB, 240, false)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {ARTIFACT_CATEGORIES.map(cat => {
                    const v = statsB.categoryCounts[cat];
                    if (v === 0) return null;
                    const pct = ((v / statsB.total) * 100).toFixed(1);
                    return (
                      <div key={cat} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                          {cat}
                        </div>
                        <span className="font-medium text-gray-800">{v} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                <h4 className="font-semibold text-gray-700">差异最大的前5个器型</h4>
              </div>
              <div className="divide-y divide-gray-100">
                {topDiffs.length === 0 ? (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">无差异数据</div>
                ) : (
                  topDiffs.map((d, idx) => {
                    const subtype = getSubtypeById(d.subtypeId);
                    if (!subtype) return null;
                    const winner = d.countA > d.countB ? 'A' : d.countB > d.countA ? 'B' : null;
                    return (
                      <div key={d.subtypeId} className="px-5 py-3 flex items-center gap-4">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-amber-100 text-amber-700' :
                          idx === 1 ? 'bg-gray-100 text-gray-600' :
                          idx === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[subtype.category] }}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-800 truncate">
                              {subtype.category} · {subtype.name}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className={`px-2 py-1 rounded ${winner === 'A' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-500'}`}>
                            {labelA.split(' - ')[0]}: <b>{d.countA}</b>
                          </div>
                          <div className="text-gray-300">/</div>
                          <div className={`px-2 py-1 rounded ${winner === 'B' ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-500'}`}>
                            {labelB.split(' - ')[0]}: <b>{d.countB}</b>
                          </div>
                          <div className="text-xs text-red-500 font-medium w-16 text-right">
                            差 {d.diff}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            请选择两个{compareMode === 'unit' ? '地层单位' : '时期'}进行对比
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          <button
            onClick={() => setActiveTab('unitStacked')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'unitStacked' ? 'bg-white text-earth-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            地层单位堆叠图
          </button>
          <button
            onClick={() => setActiveTab('periodPie')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'periodPie' ? 'bg-white text-earth-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            时期饼图
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'compare' ? 'bg-white text-earth-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            对比分析
          </button>
        </div>
        {activeTab === 'unitStacked' && (
          <button
            onClick={handleExportStatsCSV}
            className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            导出CSV
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {activeTab === 'unitStacked' && (
          <div>
            <div className="mb-4 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">各地层单位出土遗物组合</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  X轴按Harris矩阵从早到晚排列（左早右晚），鼠标悬停查看详细数据
                </p>
              </div>
              <div className="text-sm text-gray-500">
                共 {unitsWithData.length} 个有遗物的地层单位
              </div>
            </div>
            {renderStackedBarChart()}
          </div>
        )}

        {activeTab === 'periodPie' && (
          <div>
            <div className="mb-4 pb-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">各时期遗物组合占比</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                汇总时期下所有地层单位的遗物，鼠标悬停饼扇查看具体数值和百分比
              </p>
            </div>
            {renderPeriodPieSection()}
          </div>
        )}

        {activeTab === 'compare' && renderCompareSection()}
      </div>
    </div>
  );
}
