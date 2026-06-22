import { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../store/useAppStore';
import { useSampleStore } from '../store/useSampleStore';
import {
  buildChronologyModel,
  exportChronologyJSON,
  calibrateRadiocarbon,
  bpToCalendarString,
  DEFAULT_CALIBRATION_CURVE,
} from '../utils/chronology';
import { ChronologyModel, UnitChronology, ChronologyInversion, CalibratedSampleDate } from '../types';

export default function ChronologyPanel() {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const trench = useAppStore((state) =>
    state.trenches.find((t) => t.id === selectedTrenchId)
  );
  const units = useAppStore((state) =>
    state.units.filter((u) => u.trenchId === selectedTrenchId)
  );
  const relations = useAppStore((state) =>
    state.relations.filter((r) => r.trenchId === selectedTrenchId)
  );
  const samples = useSampleStore((state) => state.samples);

  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showSampleCalibration, setShowSampleCalibration] = useState<{
    sampleNumber: string;
    calibrated: CalibratedSampleDate;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const model: ChronologyModel | null = useMemo(() => {
    if (!selectedTrenchId) return null;
    return buildChronologyModel(
      selectedTrenchId,
      units,
      samples,
      relations,
      DEFAULT_CALIBRATION_CURVE
    );
  }, [selectedTrenchId, units, samples, relations]);

  const c14Samples = useMemo(() => {
    return samples.filter(
      (s) =>
        s.trenchId === selectedTrenchId &&
        s.type === '碳十四测年' &&
        s.status === '结果回填' &&
        s.result &&
        typeof s.result.values.bpValue === 'number' &&
        typeof s.result.values.errorRange === 'number'
    );
  }, [samples, selectedTrenchId]);

  useEffect(() => {
    if (!model || model.units.length === 0 || !svgRef.current || !containerRef.current) return;
    renderTimeline();
  }, [model, hoveredUnit]);

  const renderTimeline = () => {
    if (!svgRef.current || !model || model.units.length === 0) return;
    const container = containerRef.current!;
    const width = container.clientWidth - 20;
    const height = Math.max(400, model.sortedUnitIds.length * 60 + 100);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const margin = { left: 160, right: 40, top: 40, bottom: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const allBPs = model.units.flatMap((u) => [
      u.combinedConfidence95.lowerBP,
      u.combinedConfidence95.upperBP,
    ]);
    const minBP = Math.min(...allBPs) - 100;
    const maxBP = Math.max(...allBPs) + 100;

    const xScale = d3.scaleLinear().domain([maxBP, minBP]).range([0, innerWidth]);

    const unitYStep = innerHeight / Math.max(model.sortedUnitIds.length, 1);
    const yForUnit = (unitId: string) => {
      const idx = model.sortedUnitIds.indexOf(unitId);
      return margin.top + idx * unitYStep + unitYStep / 2;
    };

    const g = svg.append('g');

    const xAxis = d3.axisBottom(xScale).tickFormat((d) => {
      const bp = d as number;
      if (bp <= 1000) return `${bp} BP`;
      return `${(bp / 1000).toFixed(1)}k BP`;
    });

    const axisG = g
      .append('g')
      .attr('transform', `translate(${margin.left}, ${height - margin.bottom})`)
      .call(xAxis);
    axisG.selectAll('text').style('font-size', '11px').style('fill', '#6b7280');

    g
      .append('text')
      .attr('x', width / 2)
      .attr('y', height - 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#4b5563')
      .attr('font-weight', '500')
      .text('日历年代 (距今 BP)');

    const gridG = g.append('g').attr('class', 'grid');
    xScale.ticks(8).forEach((tick) => {
      gridG
        .append('line')
        .attr('x1', margin.left + xScale(tick))
        .attr('x2', margin.left + xScale(tick))
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .attr('stroke', '#e5e7eb')
        .attr('stroke-dasharray', '4,4');
    });

    model.sortedUnitIds.forEach((unitId) => {
      const unit = model.units.find((u) => u.unitId === unitId);
      if (!unit) return;

      const y = yForUnit(unitId);
      const isHovered = hoveredUnit === unitId;
      const barHeight = Math.min(28, unitYStep * 0.6);

      g
        .append('text')
        .attr('x', margin.left - 10)
        .attr('y', y + 4)
        .attr('text-anchor', 'end')
        .attr('font-size', '13px')
        .attr('font-weight', isHovered ? 'bold' : '500')
        .attr('fill', unit.isAnomaly ? '#dc2626' : '#1f2937')
        .text(`${unit.unitCode}`);

      const x95Start = margin.left + xScale(unit.combinedConfidence95.upperBP);
      const x95End = margin.left + xScale(unit.combinedConfidence95.lowerBP);
      const x95Width = x95End - x95Start;

      g
        .append('rect')
        .attr('x', x95Start)
        .attr('y', y - barHeight / 2)
        .attr('width', x95Width)
        .attr('height', barHeight)
        .attr('rx', 6)
        .attr('fill', unit.isAnomaly ? '#fee2e2' : unit.unitColor + '40')
        .attr('stroke', unit.isAnomaly ? '#dc2626' : unit.unitColor)
        .attr('stroke-width', isHovered ? 2.5 : 1.5)
        .attr('cursor', 'pointer')
        .on('mouseenter', function (event) {
          setHoveredUnit(unitId);
          setTooltipPos({ x: event.offsetX, y: event.offsetY });
        })
        .on('mousemove', function (event) {
          setTooltipPos({ x: event.offsetX, y: event.offsetY });
        })
        .on('mouseleave', function () {
          setHoveredUnit(null);
        });

      const x68Start = margin.left + xScale(unit.combinedConfidence68.upperBP);
      const x68End = margin.left + xScale(unit.combinedConfidence68.lowerBP);
      const x68Width = x68End - x68Start;

      g
        .append('rect')
        .attr('x', x68Start)
        .attr('y', y - barHeight / 2)
        .attr('width', x68Width)
        .attr('height', barHeight)
        .attr('rx', 6)
        .attr('fill', unit.isAnomaly ? '#fca5a5' : unit.unitColor + '90')
        .attr('pointer-events', 'none');

      const xMean = margin.left + xScale(unit.weightedMeanBP);
      g
        .append('line')
        .attr('x1', xMean)
        .attr('x2', xMean)
        .attr('y1', y - barHeight / 2 - 4)
        .attr('y2', y + barHeight / 2 + 4)
        .attr('stroke', unit.isAnomaly ? '#991b1b' : '#111827')
        .attr('stroke-width', 2)
        .attr('pointer-events', 'none');
    });
  };

  const handleExport = () => {
    if (!model) return;
    const json = exportChronologyJSON(model);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronology-model-${trench?.code || 'trench'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleViewSampleCalibration = (sampleNumber: string, bp: number, error: number) => {
    const calibrated = calibrateRadiocarbon(bp, error, DEFAULT_CALIBRATION_CURVE);
    setShowSampleCalibration({ sampleNumber, calibrated });
  };

  const hoveredUnitData = hoveredUnit
    ? model?.units.find((u) => u.unitId === hoveredUnit) || null
    : null;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">测年校正与年代序列建模</h2>
          <p className="text-sm text-gray-500 mt-1">
            {trench ? `${trench.name} (${trench.code})` : '请先选择发掘区'} ·{' '}
            {c14Samples.length} 个碳十四样品已出结果 ·{' '}
            {model ? `${model.units.length} 个地层单位有年代数据` : '0'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={!model || model.units.length === 0}
            className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出 JSON
          </button>
        </div>
      </div>

      {!selectedTrenchId ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-200">
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>请先在顶部选择一个发掘区</p>
          </div>
        </div>
      ) : c14Samples.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-200">
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <p>尚无已回填结果的碳十四测年样品</p>
            <p className="text-xs mt-1">请在"样品采集"模块中登记碳十四样品并回填检测结果</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
          <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-medium text-gray-700">年代序列图</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-3 rounded-sm border border-gray-400 bg-gray-200/60" />
                  95% 置信区间
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-3 rounded-sm border border-gray-600 bg-gray-500/70" />
                  68% 置信区间
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-0.5 h-4 bg-gray-900" />
                  加权平均
                </span>
              </div>
            </div>
            <div ref={containerRef} className="flex-1 overflow-auto p-3 relative">
              <svg ref={svgRef} className="block" />
              {hoveredUnitData && (
                <div
                  className="absolute z-20 bg-gray-900 text-white text-xs rounded-lg shadow-2xl p-3 pointer-events-none min-w-[200px]"
                  style={{
                    left: Math.min(tooltipPos.x + 15, containerRef.current!.clientWidth - 220),
                    top: Math.max(tooltipPos.y + 15, 10),
                  }}
                >
                  <div className="font-bold text-sm mb-2">{hoveredUnitData.unitCode} - {hoveredUnitData.unitName}</div>
                  <div className="space-y-1 text-gray-200">
                    <div>样品数: <span className="text-white font-medium">{hoveredUnitData.sampleCount}</span></div>
                    <div>综合年代: <span className="text-white font-medium">{hoveredUnitData.weightedMeanCal}</span></div>
                    <div>
                      (<span className="text-earth-300">{Math.round(hoveredUnitData.weightedMeanBP)} BP</span>, ±{Math.round(hoveredUnitData.weightedError)} 年)
                    </div>
                    <div className="pt-1 mt-1 border-t border-gray-700">
                      68% CI: {hoveredUnitData.combinedConfidence68.lowerCal} ~ {hoveredUnitData.combinedConfidence68.upperCal}
                    </div>
                    <div>
                      95% CI: {hoveredUnitData.combinedConfidence95.lowerCal} ~ {hoveredUnitData.combinedConfidence95.upperCal}
                    </div>
                    {hoveredUnitData.isAnomaly && (
                      <div className="pt-1 mt-1 border-t border-gray-700 text-red-300 font-medium">
                        ⚠ 年代倒置异常
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 overflow-auto">
            {model && model.inversions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-red-200 bg-red-50 flex items-center justify-between">
                  <h3 className="font-medium text-red-700 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    年代倒置异常 ({model.inversions.length})
                  </h3>
                </div>
                <div className="p-4 space-y-3 max-h-64 overflow-auto">
                  {model.inversions.map((inv, idx) => (
                    <div key={idx} className="border border-red-100 bg-red-50/50 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded font-medium">
                          {inv.earlierUnitCode}
                        </span>
                        <span className="text-gray-500 text-xs">↓ 应早于 ↓</span>
                        <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded font-medium">
                          {inv.laterUnitCode}
                        </span>
                      </div>
                      <div className="text-red-700 text-xs mb-1">
                        {inv.earlierUnitCode}: {Math.round(inv.earlierMeanBP)} BP
                        <span className="text-gray-500"> ({Math.round(inv.earlier95Lower)}~{Math.round(inv.earlier95Upper)})</span>
                      </div>
                      <div className="text-red-700 text-xs mb-1">
                        {inv.laterUnitCode}: {Math.round(inv.laterMeanBP)} BP
                        <span className="text-gray-500"> ({Math.round(inv.later95Lower)}~{Math.round(inv.later95Upper)})</span>
                      </div>
                      {inv.gapYears > 0 && (
                        <div className="text-xs font-medium text-red-600">
                          相差 {Math.round(inv.gapYears)} 年
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-medium text-gray-700">碳十四样品校正详情</h3>
              </div>
              <div className="p-4 space-y-3 max-h-96 overflow-auto">
                {c14Samples.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center">暂无数据</p>
                ) : (
                  c14Samples.map((sample) => {
                    const bp = sample.result!.values.bpValue;
                    const err = sample.result!.values.errorRange;
                    const cal = calibrateRadiocarbon(bp, err, DEFAULT_CALIBRATION_CURVE);
                    const unit = units.find((u) => u.id === sample.unitId);
                    return (
                      <div
                        key={sample.id}
                        className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleViewSampleCalibration(sample.sampleNumber, bp, err)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-800 text-sm">{sample.sampleNumber}</span>
                          {unit && (
                            <span
                              className="px-2 py-0.5 text-xs text-white rounded-full"
                              style={{ backgroundColor: unit.color }}
                            >
                              {unit.code}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div>原始: {bp} ± {err} BP</div>
                          <div>校正: {cal.pointEstimateCal} ({Math.round(cal.pointEstimateBP)} BP)</div>
                          <div className="text-gray-500">
                            95%: {cal.confidence95.lowerCal} ~ {cal.confidence95.upperCal}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-medium text-gray-700">地层单位年代汇总</h3>
              </div>
              <div className="p-4 space-y-3 max-h-80 overflow-auto">
                {!model || model.units.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center">暂无数据</p>
                ) : (
                  model.units
                    .sort((a, b) => a.harrisLevel - b.harrisLevel)
                    .map((unit) => (
                      <div
                        key={unit.unitId}
                        className={`border rounded-lg p-3 ${
                          unit.isAnomaly
                            ? 'border-red-200 bg-red-50/50'
                            : 'border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: unit.unitColor }}
                          />
                          <span className="font-medium text-gray-800 text-sm">{unit.unitCode}</span>
                          <span className="text-xs text-gray-500">{unit.unitName}</span>
                          {unit.isAnomaly && (
                            <span className="ml-auto text-xs text-red-600 font-medium">异常</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5 pl-5">
                          <div className="font-medium text-earth-700">
                            {unit.weightedMeanCal} ({Math.round(unit.weightedMeanBP)} BP)
                          </div>
                          <div>
                            {unit.sampleCount} 个样品 · 加权误差 ±{Math.round(unit.weightedError)} 年
                          </div>
                          <div className="text-gray-500">
                            95% CI: {Math.round(unit.combinedConfidence95.lowerBP)} ~ {Math.round(unit.combinedConfidence95.upperBP)} BP
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSampleCalibration && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowSampleCalibration(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                样品 {showSampleCalibration.sampleNumber} 校正结果
              </h3>
              <button
                onClick={() => setShowSampleCalibration(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">最可能日历年代</div>
                  <div className="text-lg font-bold text-gray-800">
                    {showSampleCalibration.calibrated.pointEstimateCal}
                  </div>
                  <div className="text-sm text-gray-600">
                    {Math.round(showSampleCalibration.calibrated.pointEstimateBP)} BP
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">原始测年数据</div>
                  <div className="text-lg font-bold text-gray-800">
                    {showSampleCalibration.calibrated.rawBP} ± {showSampleCalibration.calibrated.rawError} BP
                  </div>
                  <div className="text-sm text-gray-500">未校正</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                <div>
                  <div className="text-xs text-gray-500 mb-1">68% 置信区间</div>
                  <div className="text-sm font-medium text-gray-800">
                    {showSampleCalibration.calibrated.confidence68.lowerCal}
                  </div>
                  <div className="text-sm text-gray-500">
                    ~ {showSampleCalibration.calibrated.confidence68.upperCal}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {Math.round(showSampleCalibration.calibrated.confidence68.lowerBP)} ~ {Math.round(showSampleCalibration.calibrated.confidence68.upperBP)} BP
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">95% 置信区间</div>
                  <div className="text-sm font-medium text-gray-800">
                    {showSampleCalibration.calibrated.confidence95.lowerCal}
                  </div>
                  <div className="text-sm text-gray-500">
                    ~ {showSampleCalibration.calibrated.confidence95.upperCal}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {Math.round(showSampleCalibration.calibrated.confidence95.lowerBP)} ~ {Math.round(showSampleCalibration.calibrated.confidence95.upperBP)} BP
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2">校正曲线</div>
                <div className="text-sm text-gray-700">{DEFAULT_CALIBRATION_CURVE.name}</div>
                <div className="text-xs text-gray-500 mt-1">{DEFAULT_CALIBRATION_CURVE.description}</div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowSampleCalibration(null)}
                className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
