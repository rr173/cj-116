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
  buildPhaseChronologyModel,
  exportPhaseChronologyJSON,
} from '../utils/chronology';
import {
  ChronologyModel,
  UnitChronology,
  ChronologyInversion,
  CalibratedSampleDate,
  ChronologyPhase,
  PhaseChronology,
  CulturalHiatus,
  PhaseOrderWarning,
  PhaseChronologyModel,
  StratigraphicUnit,
} from '../types';
import { PERIOD_COLORS } from '../utils';

type ChronologyViewMode = 'units' | 'phases';

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

  const phases = useAppStore((state) =>
    state.getChronologyPhasesByTrench(selectedTrenchId || '')
  );
  const createChronologyPhase = useAppStore((state) => state.createChronologyPhase);
  const updateChronologyPhase = useAppStore((state) => state.updateChronologyPhase);
  const deleteChronologyPhase = useAppStore((state) => state.deleteChronologyPhase);
  const assignUnitToPhase = useAppStore((state) => state.assignUnitToPhase);
  const unassignUnitFromPhase = useAppStore((state) => state.unassignUnitFromPhase);
  const moveChronologyPhase = useAppStore((state) => state.moveChronologyPhase);

  const [viewMode, setViewMode] = useState<ChronologyViewMode>('units');
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null);
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showSampleCalibration, setShowSampleCalibration] = useState<{
    sampleNumber: string;
    calibrated: CalibratedSampleDate;
  } | null>(null);
  const [showPhaseEditor, setShowPhaseEditor] = useState<ChronologyPhase | null>(null);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [showNewPhaseForm, setShowNewPhaseForm] = useState(false);

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

  const phaseModel: PhaseChronologyModel | null = useMemo(() => {
    if (!selectedTrenchId || !model) return null;
    return buildPhaseChronologyModel(selectedTrenchId, phases, model.units);
  }, [selectedTrenchId, phases, model]);

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

  const unitsWithoutPhase = useMemo(() => {
    const assignedUnitIds = new Set(phases.flatMap((p) => p.unitIds));
    return units.filter((u) => !assignedUnitIds.has(u.id));
  }, [units, phases]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (viewMode === 'units') {
      if (!model || model.units.length === 0) return;
      renderUnitTimeline();
    } else {
      if (!phaseModel || phaseModel.phases.length === 0) return;
      renderPhaseTimeline();
    }
  }, [model, phaseModel, viewMode, hoveredUnit, hoveredPhase]);

  const renderUnitTimeline = () => {
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

  const renderPhaseTimeline = () => {
    if (!svgRef.current || !phaseModel || phaseModel.phases.length === 0) return;
    const container = containerRef.current!;
    const width = container.clientWidth - 20;
    const height = Math.max(400, phaseModel.phases.length * 90 + 150);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const margin = { left: 180, right: 40, top: 40, bottom: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g');

    const datedPhases = phaseModel.phases.filter((p) => p.hasDateData);
    if (datedPhases.length === 0) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#6b7280')
        .text('暂无可视化的年代数据');
      return;
    }

    const allBPs = datedPhases.flatMap((p) => [
      p.startBP as number,
      p.endBP as number,
    ]);
    const minBP = Math.min(...allBPs) - 200;
    const maxBP = Math.max(...allBPs) + 200;

    const xScale = d3.scaleLinear().domain([maxBP, minBP]).range([0, innerWidth]);

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

    const phaseYStep = innerHeight / Math.max(phaseModel.phases.length, 1);
    const hiatusMap = new Map<string, CulturalHiatus>();
    phaseModel.hiatuses.forEach((h) => {
      hiatusMap.set(`${h.earlierPhaseId}-${h.laterPhaseId}`, h);
    });

    phaseModel.sortedPhaseIds.forEach((phaseId, idx) => {
      const phase = phaseModel.phases.find((p) => p.phaseId === phaseId);
      if (!phase) return;

      const y = margin.top + idx * phaseYStep + phaseYStep / 2;
      const isHovered = hoveredPhase === phaseId;
      const barHeight = Math.min(48, phaseYStep * 0.7);
      const phaseColor = PERIOD_COLORS[idx % PERIOD_COLORS.length];

      if (idx > 0) {
        const prevPhaseId = phaseModel.sortedPhaseIds[idx - 1];
        const hiatus = hiatusMap.get(`${prevPhaseId}-${phaseId}`);
        if (hiatus) {
          const gapXStart = margin.left + xScale(hiatus.earlierEndBP);
          const gapXEnd = margin.left + xScale(hiatus.laterStartBP);
          const gapXCenter = (gapXStart + gapXEnd) / 2;

          for (let dx = gapXStart + 6; dx < gapXEnd - 6; dx += 10) {
            g
              .append('line')
              .attr('x1', dx)
              .attr('x2', dx + 5)
              .attr('y1', y - phaseYStep / 2 + 10)
              .attr('y2', y - phaseYStep / 2 + 10)
              .attr('stroke', '#f59e0b')
              .attr('stroke-width', 2);
          }

          g
            .append('rect')
            .attr('x', gapXCenter - 40)
            .attr('y', y - phaseYStep / 2 - 2)
            .attr('width', 80)
            .attr('height', 20)
            .attr('rx', 4)
            .attr('fill', '#fef3c7')
            .attr('stroke', '#f59e0b')
            .attr('stroke-width', 1);

          g
            .append('text')
            .attr('x', gapXCenter)
            .attr('y', y - phaseYStep / 2 + 12)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('fill', '#b45309')
            .text(`间断 ${Math.round(hiatus.hiatusYears)} 年`);
        } else {
          const prevPhase = phaseModel.phases.find((p) => p.phaseId === prevPhaseId);
          if (prevPhase?.hasDateData && phase.hasDateData) {
            g
              .append('text')
              .attr('x', margin.left + 10)
              .attr('y', y - phaseYStep / 2 + 12)
              .attr('font-size', '10px')
              .attr('fill', '#10b981')
              .text('连续过渡');
          }
        }
      }

      g
        .append('text')
        .attr('x', margin.left - 10)
        .attr('y', y - 10)
        .attr('text-anchor', 'end')
        .attr('font-size', '14px')
        .attr('font-weight', isHovered ? 'bold' : '600')
        .attr('fill', '#1f2937')
        .text(`${phase.phaseName}`);

      g
        .append('text')
        .attr('x', margin.left - 10)
        .attr('y', y + 10)
        .attr('text-anchor', 'end')
        .attr('font-size', '11px')
        .attr('fill', '#6b7280')
        .text(`${phase.unitCount} 个单位`);

      if (phase.hasDateData && phase.startBP !== null && phase.endBP !== null) {
        const xStart = margin.left + xScale(phase.startBP);
        const xEnd = margin.left + xScale(phase.endBP);
        const xWidth = xEnd - xStart;

        g
          .append('rect')
          .attr('x', xStart)
          .attr('y', y - barHeight / 2)
          .attr('width', xWidth)
          .attr('height', barHeight)
          .attr('rx', 8)
          .attr('fill', phaseColor + '40')
          .attr('stroke', phaseColor)
          .attr('stroke-width', isHovered ? 2.5 : 2)
          .attr('cursor', 'pointer')
          .on('mouseenter', function (event) {
            setHoveredPhase(phaseId);
            setTooltipPos({ x: event.offsetX, y: event.offsetY });
          })
          .on('mousemove', function (event) {
            setTooltipPos({ x: event.offsetX, y: event.offsetY });
          })
          .on('mouseleave', function () {
            setHoveredPhase(null);
          });

        if (phase.meanBP !== null) {
          const xMean = margin.left + xScale(phase.meanBP);
          g
            .append('line')
            .attr('x1', xMean)
            .attr('x2', xMean)
            .attr('y1', y - barHeight / 2 - 4)
            .attr('y2', y + barHeight / 2 + 4)
            .attr('stroke', phaseColor)
            .attr('stroke-width', 2.5)
            .attr('stroke-dasharray', '4,2')
            .attr('pointer-events', 'none');
        }

        g
          .append('text')
          .attr('x', xStart - 4)
          .attr('y', y + 4)
          .attr('text-anchor', 'end')
          .attr('font-size', '10px')
          .attr('fill', '#374151')
          .text(phase.startCal || '');

        g
          .append('text')
          .attr('x', xEnd + 4)
          .attr('y', y + 4)
          .attr('text-anchor', 'start')
          .attr('font-size', '10px')
          .attr('fill', '#374151')
          .text(phase.endCal || '');
      } else {
        g
          .append('rect')
          .attr('x', margin.left + 10)
          .attr('y', y - barHeight / 2)
          .attr('width', innerWidth - 20)
          .attr('height', barHeight)
          .attr('rx', 8)
          .attr('fill', '#f3f4f6')
          .attr('stroke', '#d1d5db')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '6,4');

        g
          .append('text')
          .attr('x', margin.left + innerWidth / 2)
          .attr('y', y + 5)
          .attr('text-anchor', 'middle')
          .attr('font-size', '13px')
          .attr('font-weight', '500')
          .attr('fill', '#9ca3af')
          .text('年代未知（无测年数据）');
      }
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

  const handleExportPhase = () => {
    if (!phaseModel) return;
    const json = exportPhaseChronologyJSON(phaseModel);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phase-chronology-${trench?.code || 'trench'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleViewSampleCalibration = (sampleNumber: string, bp: number, error: number) => {
    const calibrated = calibrateRadiocarbon(bp, error, DEFAULT_CALIBRATION_CURVE);
    setShowSampleCalibration({ sampleNumber, calibrated });
  };

  const handleCreatePhase = () => {
    if (!selectedTrenchId || !newPhaseName.trim()) return;
    createChronologyPhase({
      trenchId: selectedTrenchId,
      name: newPhaseName.trim(),
      unitIds: [],
    });
    setNewPhaseName('');
    setShowNewPhaseForm(false);
  };

  const handleToggleUnitInPhase = (phaseId: string, unitId: string) => {
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) return;
    if (phase.unitIds.includes(unitId)) {
      unassignUnitFromPhase(unitId);
    } else {
      assignUnitToPhase(phaseId, unitId);
    }
  };

  const hoveredUnitData = hoveredUnit
    ? model?.units.find((u) => u.unitId === hoveredUnit) || null
    : null;

  const hoveredPhaseData = hoveredPhase
    ? phaseModel?.phases.find((p) => p.phaseId === hoveredPhase) || null
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
            {phaseModel && ` · ${phaseModel.phases.length} 个相位`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('units')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'units'
                  ? 'bg-white text-earth-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              地层单位视图
            </button>
            <button
              onClick={() => setViewMode('phases')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'phases'
                  ? 'bg-white text-earth-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              相位视图
            </button>
          </div>
          <button
            onClick={viewMode === 'units' ? handleExport : handleExportPhase}
            disabled={viewMode === 'units' ? !model || model.units.length === 0 : !phaseModel || phaseModel.phases.length === 0}
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
              <h3 className="font-medium text-gray-700">
                {viewMode === 'units' ? '地层单位年代序列图' : '相位年代序列图'}
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-3 rounded-sm border border-gray-400 bg-gray-200/60" />
                  95% 置信区间
                </span>
                {viewMode === 'units' && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-3 rounded-sm border border-gray-600 bg-gray-500/70" />
                      68% 置信区间
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-0.5 h-4 bg-gray-900" />
                      加权平均
                    </span>
                  </>
                )}
                {viewMode === 'phases' && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-0.5 bg-gray-500" style={{ borderStyle: 'dashed' }} />
                      代表年代
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-sm border border-amber-500 bg-amber-100 flex items-center justify-center text-[10px] text-amber-700 font-semibold">Hiatus</span>
                      文化间断
                    </span>
                  </>
                )}
              </div>
            </div>
            <div ref={containerRef} className="flex-1 overflow-auto p-3 relative">
              <svg ref={svgRef} className="block" />
              {hoveredUnitData && viewMode === 'units' && (
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
              {hoveredPhaseData && viewMode === 'phases' && (
                <div
                  className="absolute z-20 bg-gray-900 text-white text-xs rounded-lg shadow-2xl p-3 pointer-events-none min-w-[220px]"
                  style={{
                    left: Math.min(tooltipPos.x + 15, containerRef.current!.clientWidth - 240),
                    top: Math.max(tooltipPos.y + 15, 10),
                  }}
                >
                  <div className="font-bold text-sm mb-2">{hoveredPhaseData.phaseName}</div>
                  <div className="space-y-1 text-gray-200">
                    <div>包含单位: <span className="text-white font-medium">{hoveredPhaseData.unitCount} 个</span></div>
                    {hoveredPhaseData.unitCodes.length > 0 && (
                      <div className="text-gray-300">{hoveredPhaseData.unitCodes.join('、')}</div>
                    )}
                    {hoveredPhaseData.hasDateData ? (
                      <>
                        <div className="pt-1 mt-1 border-t border-gray-700">
                          开始边界: <span className="text-earth-300 font-medium">{hoveredPhaseData.startCal}</span>
                          <span className="text-gray-400"> ({Math.round(hoveredPhaseData.startBP!)} BP)</span>
                        </div>
                        <div>
                          结束边界: <span className="text-earth-300 font-medium">{hoveredPhaseData.endCal}</span>
                          <span className="text-gray-400"> ({Math.round(hoveredPhaseData.endBP!)} BP)</span>
                        </div>
                        <div>
                          代表年代: <span className="text-white font-medium">{hoveredPhaseData.meanCal}</span>
                        </div>
                      </>
                    ) : (
                      <div className="pt-1 mt-1 border-t border-gray-700 text-gray-400">
                        年代未知（无测年数据）
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 overflow-auto">
            {viewMode === 'phases' && phaseModel && phaseModel.orderWarnings.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-200 bg-amber-50 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="font-medium text-amber-700">相位顺序矛盾警告 ({phaseModel.orderWarnings.length})</h3>
                </div>
                <div className="p-4 space-y-2 max-h-48 overflow-auto">
                  {phaseModel.orderWarnings.map((w, idx) => (
                    <div key={idx} className="border border-amber-100 bg-amber-50/50 rounded-lg p-2 text-xs text-amber-800">
                      {w.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewMode === 'phases' && phaseModel && phaseModel.hiatuses.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-orange-200 bg-orange-50 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h3 className="font-medium text-orange-700">文化间断检测 ({phaseModel.hiatuses.length})</h3>
                </div>
                <div className="p-4 space-y-2 max-h-48 overflow-auto">
                  {phaseModel.hiatuses.map((h, idx) => (
                    <div key={idx} className="border border-orange-100 bg-orange-50/50 rounded-lg p-3 text-xs">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="px-2 py-0.5 bg-orange-600 text-white rounded font-medium">
                          {h.earlierPhaseName}
                        </span>
                        <span className="text-gray-500">→</span>
                        <span className="px-2 py-0.5 bg-orange-600 text-white rounded font-medium">
                          {h.laterPhaseName}
                        </span>
                      </div>
                      <div className="text-orange-700 font-semibold">
                        文化间断: {Math.round(h.hiatusYears)} 年
                      </div>
                      <div className="text-orange-600 text-[11px] mt-0.5">
                        {Math.round(h.earlierEndBP)} BP → {Math.round(h.laterStartBP)} BP
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {viewMode === 'phases' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h3 className="font-medium text-gray-700">相位分组管理</h3>
                  <button
                    onClick={() => setShowNewPhaseForm(true)}
                    className="px-2.5 py-1 text-xs bg-earth-600 text-white rounded hover:bg-earth-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    新建相位
                  </button>
                </div>

                {showNewPhaseForm && (
                  <div className="p-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPhaseName}
                        onChange={(e) => setNewPhaseName(e.target.value)}
                        placeholder="输入相位名称，如：第一期聚落"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreatePhase()}
                      />
                      <button
                        onClick={handleCreatePhase}
                        disabled={!newPhaseName.trim()}
                        className="px-3 py-1.5 text-sm bg-earth-600 text-white rounded-lg hover:bg-earth-700 disabled:opacity-50 transition-colors"
                      >
                        添加
                      </button>
                      <button
                        onClick={() => {
                          setShowNewPhaseForm(false);
                          setNewPhaseName('');
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-3 space-y-3 max-h-[500px] overflow-auto">
                  {phases.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-6">
                      暂无相位，点击右上角"新建相位"开始分组
                    </div>
                  ) : (
                    phases.map((phase, idx) => (
                      <div
                        key={phase.id}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <div
                          className="px-3 py-2 flex items-center justify-between"
                          style={{ backgroundColor: PERIOD_COLORS[idx % PERIOD_COLORS.length] + '15' }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => moveChronologyPhase(phase.id, 'up')}
                                disabled={phase.order === 1}
                                className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="上移"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => moveChronologyPhase(phase.id, 'down')}
                                disabled={phase.order === phases.length}
                                className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="下移"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            <span className="text-xs font-medium text-gray-500">#{phase.order}</span>
                            <span className="font-medium text-sm text-gray-800 truncate">{phase.name}</span>
                            <span className="text-xs text-gray-500">({phase.unitIds.length})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setShowPhaseEditor(phase)}
                              className="p-1 text-gray-400 hover:text-earth-600 transition-colors"
                              title="编辑"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`确定删除相位「${phase.name}」？`)) {
                                  deleteChronologyPhase(phase.id);
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="删除"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="px-3 py-2 bg-white">
                          <div className="text-xs text-gray-500 mb-2">包含的地层单位（点击移除）:</div>
                          <div className="flex flex-wrap gap-1.5">
                            {phase.unitIds.length === 0 ? (
                              <span className="text-xs text-gray-400">未分配单位</span>
                            ) : (
                              phase.unitIds.map((uid) => {
                                const unit = units.find((u) => u.id === uid);
                                if (!unit) return null;
                                return (
                                  <button
                                    key={uid}
                                    onClick={() => unassignUnitFromPhase(uid)}
                                    className="px-2 py-0.5 text-xs rounded-full border flex items-center gap-1 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                                    style={{
                                      backgroundColor: unit.color + '20',
                                      borderColor: unit.color,
                                      color: unit.color,
                                    }}
                                    title="点击从相位移除"
                                  >
                                    {unit.code}
                                    <span className="opacity-60">×</span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {unitsWithoutPhase.length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        未分配的地层单位（点击分配到相位）:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {unitsWithoutPhase.map((unit) => (
                          <div key={unit.id} className="group relative">
                            <span
                              className="px-2 py-0.5 text-xs rounded-full cursor-pointer transition-all"
                              style={{
                                backgroundColor: unit.color + '25',
                                border: `1px dashed ${unit.color}`,
                                color: unit.color,
                              }}
                            >
                              {unit.code}
                            </span>
                            <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[140px]">
                              <div className="text-xs text-gray-500 mb-1.5">分配到:</div>
                              <div className="space-y-0.5">
                                {phases.map((ph) => (
                                  <button
                                    key={ph.id}
                                    onClick={() => assignUnitToPhase(ph.id, unit.id)}
                                    className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded transition-colors"
                                  >
                                    #{ph.order} {ph.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    .map((unit) => {
                      const assignedPhase = phases.find((p) => p.unitIds.includes(unit.unitId));
                      return (
                        <div
                          key={unit.unitId}
                          className={`border rounded-lg p-3 ${
                            unit.isAnomaly
                              ? 'border-red-200 bg-red-50/50'
                              : 'border-gray-100 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <div
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: unit.unitColor }}
                            />
                            <span className="font-medium text-gray-800 text-sm">{unit.unitCode}</span>
                            <span className="text-xs text-gray-500">{unit.unitName}</span>
                            {assignedPhase && (
                              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-600">
                                {assignedPhase.name}
                              </span>
                            )}
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
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPhaseEditor && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowPhaseEditor(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">编辑相位</h3>
              <button
                onClick={() => setShowPhaseEditor(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <PhaseEditorContent
              phase={showPhaseEditor}
              units={units}
              phases={phases}
              onClose={() => setShowPhaseEditor(null)}
            />
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

function PhaseEditorContent({
  phase,
  units,
  phases,
  onClose,
}: {
  phase: ChronologyPhase;
  units: StratigraphicUnit[];
  phases: ChronologyPhase[];
  onClose: () => void;
}) {
  const updateChronologyPhase = useAppStore((state) => state.updateChronologyPhase);
  const assignUnitToPhase = useAppStore((state) => state.assignUnitToPhase);
  const unassignUnitFromPhase = useAppStore((state) => state.unassignUnitFromPhase);

  const [name, setName] = useState(phase.name);
  const [order, setOrder] = useState(phase.order);

  const handleSave = () => {
    updateChronologyPhase(phase.id, { name: name.trim(), order });
    onClose();
  };

  const handleToggleUnit = (unitId: string) => {
    if (phase.unitIds.includes(unitId)) {
      unassignUnitFromPhase(unitId);
    } else {
      assignUnitToPhase(phase.id, unitId);
    }
  };

  const assignedUnitIds = new Set(phase.unitIds);

  return (
    <div className="p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          相位名称
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          placeholder="如：第一期聚落"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          排序序号 (1 - {phases.length})
        </label>
        <input
          type="number"
          min={1}
          max={phases.length}
          value={order}
          onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          包含的地层单位
        </label>
        <div className="border border-gray-200 rounded-lg max-h-60 overflow-auto p-2 space-y-1 bg-gray-50">
          {units.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">暂无地层单位</p>
          ) : (
            units.map((unit) => {
              const assigned = assignedUnitIds.has(unit.id);
              const otherPhase = phases.find(
                (p) => p.id !== phase.id && p.unitIds.includes(unit.id)
              );
              return (
                <label
                  key={unit.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    assigned ? 'bg-earth-50' : 'hover:bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={assigned}
                    onChange={() => handleToggleUnit(unit.id)}
                    className="rounded text-earth-600 focus:ring-earth-500"
                  />
                  <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: unit.color }}
                  />
                  <span className="text-sm font-medium text-gray-800">
                    {unit.code}
                  </span>
                  <span className="text-xs text-gray-500">{unit.name}</span>
                  {otherPhase && (
                    <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      原属: {otherPhase.name}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          一个单位只能属于一个相位，勾选会自动从其他相位移除
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 disabled:opacity-50 transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  );
}