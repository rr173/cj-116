import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../store/useAppStore';
import { useSnapshotStore } from '../store/useSnapshotStore';
import { Snapshot } from '../types';
import { formatDate } from '../utils';

interface SnapshotProgressChartProps {
  trenchId: string;
  onBack: () => void;
}

interface ChartDataPoint {
  index: number;
  snapshotId: string;
  name: string;
  date: Date;
  dateLabel: string;
  exposedRatio: number;
  artifacts: number;
  features: number;
}

export default function SnapshotProgressChart({ trenchId, onBack }: SnapshotProgressChartProps) {
  const selectedTrench = useAppStore((state) =>
    state.trenches.find((t) => t.id === trenchId)
  );
  const getSnapshotsByTrench = useSnapshotStore((state) => state.getSnapshotsByTrench);
  const snapshots = useMemo(
    () => getSnapshotsByTrench(trenchId),
    [trenchId, getSnapshotsByTrench]
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const chartData: ChartDataPoint[] = useMemo(() => {
    return snapshots.map((snap, idx) => ({
      index: idx,
      snapshotId: snap.id,
      name: snap.name,
      date: new Date(snap.createdAt),
      dateLabel: formatDate(new Date(snap.createdAt)),
      exposedRatio: snap.totalCellCount > 0
        ? (snap.exposedCellCount / snap.totalCellCount) * 100
        : 0,
      artifacts: snap.totalArtifacts,
      features: snap.totalFeatures,
    }));
  }, [snapshots]);

  useEffect(() => {
    if (!svgRef.current || chartData.length < 1) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 80, bottom: 60, left: 60 };
    const containerWidth = containerRef.current?.clientWidth || 900;
    const width = containerWidth - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([0, Math.max(chartData.length - 1, 1)])
      .range([0, width]);

    const yLeft = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    const maxRight = Math.max(
      ...chartData.map((d) => Math.max(d.artifacts, d.features)),
      5
    );
    const yRight = d3.scaleLinear()
      .domain([0, Math.ceil(maxRight * 1.1)])
      .range([height, 0]);

    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(x)
          .ticks(Math.min(chartData.length, 10))
          .tickSize(-height)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-dasharray', '3,3');

    g.append('g')
      .attr('class', 'grid')
      .call(
        d3.axisLeft(yLeft)
          .ticks(5)
          .tickSize(-width)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-dasharray', '3,3');

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(x)
          .ticks(Math.min(chartData.length, 10))
          .tickFormat((d) => {
            const idx = Math.round(d as number);
            const point = chartData[idx];
            if (!point) return '';
            return point.name.length > 6
              ? point.name.slice(0, 6) + '…'
              : point.name;
          })
      )
      .selectAll('text')
      .attr('fill', '#6b7280')
      .attr('font-size', '11px')
      .attr('transform', 'rotate(-30)')
      .style('text-anchor', 'end');

    g.append('g')
      .call(d3.axisLeft(yLeft).ticks(5).tickFormat((d) => `${d}%`))
      .selectAll('text')
      .attr('fill', '#059669')
      .attr('font-size', '11px');

    g.append('g')
      .attr('transform', `translate(${width},0)`)
      .call(d3.axisRight(yRight).ticks(5))
      .selectAll('text')
      .attr('fill', '#6b7280')
      .attr('font-size', '11px');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -48)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#059669')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text('方格揭露占比 (%)');

    g.append('text')
      .attr('transform', 'rotate(90)')
      .attr('y', -width - 60)
      .attr('x', height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b7280')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text('累计数量（件/个）');

    const areaExposed = d3.area<ChartDataPoint>()
      .x((d) => x(d.index))
      .y0(height)
      .y1((d) => yLeft(d.exposedRatio))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chartData)
      .attr('fill', 'url(#exposedGradient)')
      .attr('opacity', 0.2)
      .attr('d', areaExposed);

    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'exposedGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#10b981');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0);

    const lineExposed = d3.line<ChartDataPoint>()
      .x((d) => x(d.index))
      .y((d) => yLeft(d.exposedRatio))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.5)
      .attr('d', lineExposed);

    const lineArtifacts = d3.line<ChartDataPoint>()
      .x((d) => x(d.index))
      .y((d) => yRight(d.artifacts))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '6,3')
      .attr('d', lineArtifacts);

    const lineFeatures = d3.line<ChartDataPoint>()
      .x((d) => x(d.index))
      .y((d) => yRight(d.features))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', '#8b5cf6')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '3,3')
      .attr('d', lineFeatures);

    const handleMouseMove = (event: MouseEvent) => {
      const [mx] = d3.pointer(event);
      const idx = Math.round(x.invert(mx));
      if (idx >= 0 && idx < chartData.length) {
        setHoveredPoint(chartData[idx]);
        const containerRect = containerRef.current?.getBoundingClientRect();
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (containerRect && svgRect) {
          setTooltipPos({
            x: x(idx) + margin.left,
            y: yLeft(chartData[idx].exposedRatio) + margin.top,
          });
        }
      }
    };

    const handleMouseLeave = () => {
      setHoveredPoint(null);
    };

    g.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove', handleMouseMove as any)
      .on('mouseleave', handleMouseLeave);

    chartData.forEach((d) => {
      const isHovered = hoveredPoint?.snapshotId === d.snapshotId;

      g.append('circle')
        .attr('cx', x(d.index))
        .attr('cy', yLeft(d.exposedRatio))
        .attr('r', isHovered ? 8 : 5)
        .attr('fill', 'white')
        .attr('stroke', '#10b981')
        .attr('stroke-width', isHovered ? 3 : 2)
        .style('cursor', 'pointer')
        .style('transition', 'r 0.15s');

      g.append('circle')
        .attr('cx', x(d.index))
        .attr('cy', yRight(d.artifacts))
        .attr('r', isHovered ? 7 : 4)
        .attr('fill', 'white')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', isHovered ? 2.5 : 1.5)
        .style('cursor', 'pointer');

      g.append('circle')
        .attr('cx', x(d.index))
        .attr('cy', yRight(d.features))
        .attr('r', isHovered ? 7 : 4)
        .attr('fill', 'white')
        .attr('stroke', '#8b5cf6')
        .attr('stroke-width', isHovered ? 2.5 : 1.5)
        .style('cursor', 'pointer');

      if (isHovered) {
        g.append('line')
          .attr('x1', x(d.index))
          .attr('y1', 0)
          .attr('x2', x(d.index))
          .attr('y2', height)
          .attr('stroke', '#9ca3af')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '4,4')
          .attr('opacity', 0.5);
      }
    });
  }, [chartData, hoveredPoint]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {selectedTrench?.name} - 发掘进度统计
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            基于快照记录的累计进度曲线 · 共 {snapshots.length} 个快照
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回快照面板
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {snapshots.length > 0 && (() => {
          const first = snapshots[0];
          const latest = snapshots[snapshots.length - 1];
          const totalCells = latest.totalCellCount;
          return (
            <>
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200 p-4">
                <div className="text-xs text-green-700 font-medium mb-1">
                  揭露进度变化
                </div>
                <div className="text-3xl font-bold text-green-800">
                  {totalCells > 0
                    ? (((latest.exposedCellCount - first.exposedCellCount) / totalCells) * 100).toFixed(1)
                    : 0}%
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {first.exposedCellCount}/{totalCells} → {latest.exposedCellCount}/{totalCells}
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-sky-100 rounded-xl border border-blue-200 p-4">
                <div className="text-xs text-blue-700 font-medium mb-1">
                  遗物累计增长
                </div>
                <div className="text-3xl font-bold text-blue-800">
                  +{latest.totalArtifacts - first.totalArtifacts}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {first.totalArtifacts} 件 → {latest.totalArtifacts} 件
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-xl border border-purple-200 p-4">
                <div className="text-xs text-purple-700 font-medium mb-1">
                  遗迹要素累计增长
                </div>
                <div className="text-3xl font-bold text-purple-800">
                  +{latest.totalFeatures - first.totalFeatures}
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  {first.totalFeatures} 个 → {latest.totalFeatures} 个
                </div>
              </div>
            </>
          );
        })()}
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
        <div className="flex items-center gap-6 mb-4 ml-8">
          <div className="flex items-center gap-2">
            <div className="w-5 h-1 bg-emerald-500 rounded" />
            <span className="text-xs font-medium text-gray-700">已揭露方格占比</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-0 border-t-2 border-dashed border-blue-500" />
            <span className="text-xs font-medium text-gray-700">遗物累计数</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 border-t-2 border-dotted border-purple-500" />
            <span className="text-xs font-medium text-gray-700">遗迹要素累计数</span>
          </div>
        </div>

        {chartData.length < 2 ? (
          <div className="h-[420px] flex flex-col items-center justify-center text-gray-500">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p className="text-lg font-medium text-gray-700 mb-1">至少需要 2 个快照才能生成曲线</p>
            <p className="text-sm">当前已有 {chartData.length} 个快照，请创建更多快照后查看</p>
          </div>
        ) : (
          <div ref={containerRef} className="relative">
            <svg
              ref={svgRef}
              width="100%"
              height={420}
              viewBox={`0 0 ${containerRef.current?.clientWidth || 900} 420`}
              preserveAspectRatio="xMidYMid meet"
            />

            {hoveredPoint && (
              <div
                className="absolute z-10 bg-white rounded-lg shadow-xl border border-gray-200 p-3 pointer-events-none min-w-[180px]"
                style={{
                  left: Math.min(
                    tooltipPos.x + 16,
                    (containerRef.current?.clientWidth || 900) - 200
                  ),
                  top: Math.max(tooltipPos.y - 40, 10),
                }}
              >
                <div className="text-sm font-semibold text-gray-800 border-b pb-2 mb-2">
                  {hoveredPoint.name}
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">创建时间</span>
                    <span className="font-medium text-gray-700">{hoveredPoint.dateLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                      揭露占比
                    </span>
                    <span className="font-semibold text-emerald-700">
                      {hoveredPoint.exposedRatio.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                      遗物总数
                    </span>
                    <span className="font-semibold text-blue-700">
                      {hoveredPoint.artifacts} 件
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
                      遗迹要素
                    </span>
                    <span className="font-semibold text-purple-700">
                      {hoveredPoint.features} 个
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {chartData.length >= 2 && (
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {chartData.map((d, idx) => {
              const snap = snapshots[idx] as Snapshot;
              const prev = idx > 0 ? snapshots[idx - 1] as Snapshot : null;
              const deltaCells = prev ? snap.exposedCellCount - prev.exposedCellCount : snap.exposedCellCount;
              const deltaArtifacts = prev ? snap.totalArtifacts - prev.totalArtifacts : snap.totalArtifacts;
              return (
                <div
                  key={d.snapshotId}
                  className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    hoveredPoint?.snapshotId === d.snapshotId
                      ? 'border-earth-400 bg-earth-50 shadow-md'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'
                  }`}
                  onMouseEnter={() => setHoveredPoint(d)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <div className="text-xs font-semibold text-gray-800 truncate">{d.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{d.dateLabel}</div>
                  <div className="flex items-center gap-3 mt-2 text-[10px]">
                    <span className="text-emerald-700 font-medium">
                      {d.exposedRatio.toFixed(0)}%
                      {deltaCells > 0 && (
                        <span className="text-emerald-600 ml-1">(+{deltaCells})</span>
                      )}
                    </span>
                    <span className="text-blue-700 font-medium">
                      {d.artifacts}件
                      {deltaArtifacts > 0 && (
                        <span className="text-blue-600 ml-1">(+{deltaArtifacts})</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
