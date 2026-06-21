import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { usePermission } from '../hooks/usePermission';
import { Coordinate, FeatureType, RelicFeature, FeatureSpatialRelation, Period } from '../types';
import { FEATURE_TYPE_OPTIONS, generateFeatureNumber, PERIOD_COLORS, SOIL_COLORS } from '../utils';

type DrawMode = 'select' | 'draw' | 'move' | 'editVertex';

const CELL_SIZE = 64;
const LABEL_SIZE = 64;

export default function FeatureDrawingPanel() {
  const selectedTrenchId = useAppStore((s) => s.selectedTrenchId);
  const selectedTrench = useAppStore((s) => s.trenches.find((t) => t.id === selectedTrenchId));
  const cells = useAppStore((s) => s.cells);
  const units = useAppStore((s) => s.units);
  const features = useAppStore((s) => s.features);
  const periods = useAppStore((s) => s.periods);
  const featureSpatialRelations = useAppStore((s) => s.featureSpatialRelations);
  const getStratigraphiesByCell = useAppStore((s) => s.getStratigraphiesByCell);

  const addFeature = useAppStore((s) => s.addFeature);
  const updateFeature = useAppStore((s) => s.updateFeature);
  const deleteFeature = useAppStore((s) => s.deleteFeature);
  const getFeaturesByTrench = useAppStore((s) => s.getFeaturesByTrench);
  const getFeaturesByCell = useAppStore((s) => s.getFeaturesByCell);
  const setSelectedFeature = useAppStore((s) => s.setSelectedFeature);
  const selectedFeatureId = useAppStore((s) => s.selectedFeatureId);
  const detectSpatialRelations = useAppStore((s) => s.detectSpatialRelations);
  const confirmSpatialRelation = useAppStore((s) => s.confirmSpatialRelation);
  const rejectSpatialRelation = useAppStore((s) => s.rejectSpatialRelation);
  const createPeriod = useAppStore((s) => s.createPeriod);
  const updatePeriod = useAppStore((s) => s.updatePeriod);
  const deletePeriod = useAppStore((s) => s.deletePeriod);
  const getPeriodsByTrench = useAppStore((s) => s.getPeriodsByTrench);
  const assignFeatureToPeriod = useAppStore((s) => s.assignFeatureToPeriod);
  const unassignFeatureFromPeriod = useAppStore((s) => s.unassignFeatureFromPeriod);
  const getFeaturesByPeriod = useAppStore((s) => s.getFeaturesByPeriod);
  const getFeaturesByUnit = useAppStore((s) => s.getFeaturesByUnit);

  const { can } = usePermission();

  const [drawMode, setDrawMode] = useState<DrawMode>('select');
  const [drawingVertices, setDrawingVertices] = useState<Coordinate[]>([]);
  const [showFeatureForm, setShowFeatureForm] = useState(false);
  const [editingFeature, setEditingFeature] = useState<RelicFeature | null>(null);
  const [dragVertexInfo, setDragVertexInfo] = useState<{ featureId: string; vertexIdx: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'features' | 'periods' | 'relations' | 'stats'>('features');
  const [periodFilter, setPeriodFilter] = useState<string | 'all'>('all');
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const trenchCells = useMemo(
    () => (selectedTrenchId ? cells.filter((c) => c.trenchId === selectedTrenchId) : []),
    [cells, selectedTrenchId]
  );

  const trenchFeatures = useMemo(
    () => (selectedTrenchId ? getFeaturesByTrench(selectedTrenchId) : []),
    [selectedTrenchId, getFeaturesByTrench, features]
  );

  const trenchPeriods = useMemo(
    () => (selectedTrenchId ? getPeriodsByTrench(selectedTrenchId) : []),
    [selectedTrenchId, getPeriodsByTrench, periods]
  );

  const trenchRelations = useMemo(
    () => (selectedTrenchId ? featureSpatialRelations.filter((r) => r.trenchId === selectedTrenchId) : []),
    [selectedTrenchId, featureSpatialRelations]
  );

  const trenchUnits = useMemo(
    () => (selectedTrenchId ? units.filter((u) => u.trenchId === selectedTrenchId) : []),
    [units, selectedTrenchId]
  );

  const rows = selectedTrench?.rows || 0;
  const cols = selectedTrench?.cols || 0;
  const cellSize = selectedTrench?.cellSize || 1;

  const toSvgX = useCallback(
    (worldX: number) => ((worldX - (selectedTrench?.originX || 0)) / cellSize) * CELL_SIZE + LABEL_SIZE,
    [selectedTrench, cellSize]
  );
  const toSvgY = useCallback(
    (worldY: number) => ((rows * cellSize - (worldY - (selectedTrench?.originY || 0))) / cellSize) * CELL_SIZE + LABEL_SIZE,
    [selectedTrench, cellSize, rows]
  );
  const toWorldX = useCallback(
    (svgX: number) => ((svgX - LABEL_SIZE) / CELL_SIZE) * cellSize + (selectedTrench?.originX || 0),
    [selectedTrench, cellSize]
  );
  const toWorldY = useCallback(
    (svgY: number) => rows * cellSize - ((svgY - LABEL_SIZE) / CELL_SIZE) * cellSize + (selectedTrench?.originY || 0),
    [selectedTrench, cellSize, rows]
  );

  const getFeatureColor = useCallback(
    (feature: RelicFeature): string => {
      if (feature.periodId) {
        const period = periods.find((p) => p.id === feature.periodId);
        if (period) return period.color;
      }
      return '#6B7280';
    },
    [periods]
  );

  const filteredFeatures = useMemo(() => {
    if (periodFilter === 'all') return trenchFeatures;
    if (periodFilter === 'unassigned') return trenchFeatures.filter((f) => !f.periodId);
    return trenchFeatures.filter((f) => f.periodId === periodFilter);
  }, [trenchFeatures, periodFilter]);

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (drawMode !== 'draw') return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const svgX = e.clientX - rect.left;
      const svgY = e.clientY - rect.top;
      const worldX = toWorldX(svgX);
      const worldY = toWorldY(svgY);
      setDrawingVertices((prev) => [...prev, { x: Math.round(worldX * 100) / 100, y: Math.round(worldY * 100) / 100 }]);
    },
    [drawMode, toWorldX, toWorldY]
  );

  const handleClosePolygon = useCallback(() => {
    if (drawingVertices.length < 3) return;
    setShowFeatureForm(true);
  }, [drawingVertices]);

  const handleUndoVertex = useCallback(() => {
    setDrawingVertices((prev) => prev.slice(0, -1));
  }, []);

  const handleCancelDraw = useCallback(() => {
    setDrawingVertices([]);
    setDrawMode('select');
    setShowFeatureForm(false);
  }, []);

  const handleFeatureFormSubmit = useCallback(
    (data: { featureNumber: string; featureType: FeatureType; unitId: string; topElevation: number; bottomElevation: number; description: string; photoNumbers: string }) => {
      if (!selectedTrenchId) return;
      if (editingFeature) {
        updateFeature(editingFeature.id, {
          ...data,
          vertices: editingFeature.vertices,
        });
        setEditingFeature(null);
      } else {
        const existingInTrench = getFeaturesByTrench(selectedTrenchId);
        const isDuplicate = existingInTrench.some((f) => f.featureNumber === data.featureNumber);
        if (isDuplicate) {
          alert(`要素编号"${data.featureNumber}"在发掘区内已存在，请使用唯一编号`);
          return;
        }
        addFeature({
          ...data,
          trenchId: selectedTrenchId,
          vertices: drawingVertices,
        });
        setDrawingVertices([]);
        setDrawMode('select');
        detectSpatialRelations(selectedTrenchId);
      }
      setShowFeatureForm(false);
    },
    [selectedTrenchId, editingFeature, drawingVertices, addFeature, updateFeature, getFeaturesByTrench, detectSpatialRelations]
  );

  const handleFeatureClick = useCallback(
    (featureId: string) => {
      if (drawMode !== 'select') return;
      setSelectedFeature(featureId);
    },
    [drawMode, setSelectedFeature]
  );

  const handleDeleteFeature = useCallback(
    (id: string) => {
      if (!confirm('确定删除该遗迹要素？')) return;
      deleteFeature(id);
      setSelectedFeature(null);
    },
    [deleteFeature, setSelectedFeature]
  );

  const handleSvgMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (drawMode !== 'editVertex' && drawMode !== 'move') return;
      const target = e.target as SVGElement;
      const vertexEl = target.closest('[data-vertex-idx]');
      const featureEl = target.closest('[data-feature-id]');

      if (drawMode === 'editVertex' && vertexEl && featureEl) {
        const featureId = featureEl.getAttribute('data-feature-id')!;
        const vertexIdx = parseInt(vertexEl.getAttribute('data-vertex-idx')!, 10);
        setDragVertexInfo({ featureId, vertexIdx });
        e.preventDefault();
      } else if (drawMode === 'move' && featureEl) {
        const featureId = featureEl.getAttribute('data-feature-id')!;
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const svgX = e.clientX - rect.left;
        const svgY = e.clientY - rect.top;
        const feature = trenchFeatures.find((f) => f.id === featureId);
        if (!feature) return;
        const firstVertSvgX = toSvgX(feature.vertices[0].x);
        const firstVertSvgY = toSvgY(feature.vertices[0].y);
        setDragOffset({ dx: svgX - firstVertSvgX, dy: svgY - firstVertSvgY });
        setDragVertexInfo({ featureId, vertexIdx: -1 });
        e.preventDefault();
      }
    },
    [drawMode, trenchFeatures, toSvgX, toSvgY]
  );

  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragVertexInfo) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const svgX = e.clientX - rect.left;
      const svgY = e.clientY - rect.top;
      const worldX = toWorldX(svgX);
      const worldY = toWorldY(svgY);

      if (dragVertexInfo.vertexIdx >= 0) {
        const feature = trenchFeatures.find((f) => f.id === dragVertexInfo.featureId);
        if (!feature) return;
        const newVertices = [...feature.vertices];
        newVertices[dragVertexInfo.vertexIdx] = { x: Math.round(worldX * 100) / 100, y: Math.round(worldY * 100) / 100 };
        updateFeature(feature.id, { vertices: newVertices });
      } else {
        const feature = trenchFeatures.find((f) => f.id === dragVertexInfo.featureId);
        if (!feature || !dragOffset) return;
        const dx = worldX - feature.vertices[0].x;
        const dy = worldY - feature.vertices[0].y;
        const newVertices = feature.vertices.map((v) => ({
          x: Math.round((v.x + dx) * 100) / 100,
          y: Math.round((v.y + dy) * 100) / 100,
        }));
        updateFeature(feature.id, { vertices: newVertices });
      }
    },
    [dragVertexInfo, dragOffset, trenchFeatures, toWorldX, toWorldY, updateFeature]
  );

  const handleSvgMouseUp = useCallback(() => {
    setDragVertexInfo(null);
    setDragOffset(null);
  }, []);

  useEffect(() => {
    const handler = () => handleSvgMouseUp();
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [handleSvgMouseUp]);

  const handleAssignPeriod = useCallback(
    (featureId: string, periodId: string) => {
      assignFeatureToPeriod(featureId, periodId);
    },
    [assignFeatureToPeriod]
  );

  const handleUnassignPeriod = useCallback(
    (featureId: string) => {
      unassignFeatureFromPeriod(featureId);
    },
    [unassignFeatureFromPeriod]
  );

  const handleCreatePeriod = useCallback(() => {
    if (!selectedTrenchId) return;
    const name = prompt('时期名称（如"第一期"）:');
    if (!name) return;
    const dateRange = prompt('起止年代范围描述（如"商代早期 约公元前1600-1300年"）:') || '';
    createPeriod({ trenchId: selectedTrenchId, name, dateRange });
  }, [selectedTrenchId, createPeriod]);

  const handleDeletePeriod = useCallback(
    (id: string) => {
      if (!confirm('确定删除该时期？该时期下的要素将变为未分配。')) return;
      deletePeriod(id);
    },
    [deletePeriod]
  );

  const svgWidth = cols * CELL_SIZE + LABEL_SIZE;
  const svgHeight = rows * CELL_SIZE + LABEL_SIZE;

  const selectedFeature = trenchFeatures.find((f) => f.id === selectedFeatureId);

  const statsByTypeAndPeriod = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const f of trenchFeatures) {
      const periodName = f.periodId ? periods.find((p) => p.id === f.periodId)?.name || '未分配' : '未分配';
      if (!map[f.featureType]) map[f.featureType] = {};
      map[f.featureType][periodName] = (map[f.featureType][periodName] || 0) + 1;
    }
    return map;
  }, [trenchFeatures, periods]);

  const cellFeaturesMap = useMemo(() => {
    const map: Record<string, RelicFeature[]> = {};
    for (const f of trenchFeatures) {
      for (const cellId of f.coveredCellIds) {
        if (!map[cellId]) map[cellId] = [];
        map[cellId].push(f);
      }
    }
    return map;
  }, [trenchFeatures]);

  const unitFeaturesMap = useMemo(() => {
    const map: Record<string, RelicFeature[]> = {};
    for (const f of trenchFeatures) {
      if (!map[f.unitId]) map[f.unitId] = [];
      map[f.unitId].push(f);
    }
    return map;
  }, [trenchFeatures]);

  const unconfirmedRelations = trenchRelations.filter((r) => !r.confirmed);
  const confirmedRelations = trenchRelations.filter((r) => r.confirmed);

  if (!selectedTrenchId || !selectedTrench) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        请先选择一个发掘区
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {selectedTrench.name} - 遗迹要素绘图与分期标注
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {trenchFeatures.length} 个遗迹要素，{trenchPeriods.length} 个时期
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can('feature:create') && (
            <>
              <button
                onClick={() => { setDrawMode('draw'); setDrawingVertices([]); setSelectedFeature(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  drawMode === 'draw' ? 'bg-earth-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                绘制要素
              </button>
              <button
                onClick={() => { setDrawMode('select'); setDrawingVertices([]); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  drawMode === 'select' ? 'bg-earth-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                选择
              </button>
              {selectedFeatureId && (
                <>
                  <button
                    onClick={() => setDrawMode('editVertex')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      drawMode === 'editVertex' ? 'bg-earth-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    编辑顶点
                  </button>
                  <button
                    onClick={() => setDrawMode('move')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      drawMode === 'move' ? 'bg-earth-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    平移
                  </button>
                </>
              )}
            </>
          )}
          <button
            onClick={() => detectSpatialRelations(selectedTrenchId)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            检测空间关系
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
        <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto">
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            onClick={handleSvgClick}
            onMouseDown={handleSvgMouseDown}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            className="select-none"
            style={{ cursor: drawMode === 'draw' ? 'crosshair' : drawMode === 'editVertex' ? 'pointer' : drawMode === 'move' ? 'grab' : 'default' }}
          >
            <g>
              <line x1={LABEL_SIZE} y1={0} x2={LABEL_SIZE} y2={svgHeight} stroke="#e5e7eb" strokeWidth={1} />
              {Array.from({ length: cols }, (_, i) => (
                <text
                  key={`col-${i}`}
                  x={LABEL_SIZE + i * CELL_SIZE + CELL_SIZE / 2}
                  y={LABEL_SIZE - 8}
                  textAnchor="middle"
                  className="text-xs fill-gray-500"
                  fontSize={11}
                >
                  E{i + 1}
                </text>
              ))}
              {Array.from({ length: rows }, (_, i) => (
                <text
                  key={`row-${i}`}
                  x={LABEL_SIZE - 8}
                  y={LABEL_SIZE + i * CELL_SIZE + CELL_SIZE / 2 + 4}
                  textAnchor="end"
                  className="text-xs fill-gray-500"
                  fontSize={11}
                >
                  N{rows - i}
                </text>
              ))}
            </g>

            <g>
              {trenchCells.map((cell) => {
                const colIdx = cell.col - 1;
                const rowIdx = rows - cell.row;
                const x = LABEL_SIZE + colIdx * CELL_SIZE;
                const y = LABEL_SIZE + rowIdx * CELL_SIZE;
                const strats = getStratigraphiesByCell(cell.id);
                const bgFill = strats.length > 0 ? SOIL_COLORS[strats[0].soilType] + '30' : '#ffffff';
                const isHovered = cell.id === hoveredCellId;
                const cellFeats = cellFeaturesMap[cell.id] || [];
                return (
                  <g
                    key={cell.id}
                    onMouseEnter={() => setHoveredCellId(cell.id)}
                    onMouseLeave={() => setHoveredCellId(null)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      fill={bgFill}
                      stroke={isHovered ? '#8B6340' : '#d1d5db'}
                      strokeWidth={isHovered ? 2 : 1}
                    />
                    <text
                      x={x + CELL_SIZE / 2}
                      y={y + CELL_SIZE / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10}
                      fill="#6b7280"
                    >
                      {cell.code.replace(selectedTrench?.code || '', '')}
                    </text>
                    {cellFeats.length > 0 && (
                      <text
                        x={x + CELL_SIZE - 4}
                        y={y + 12}
                        textAnchor="end"
                        fontSize={9}
                        fill="#8B6340"
                        fontWeight="bold"
                      >
                        {cellFeats.length}要
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            <g>
              {filteredFeatures.map((feature) => {
                const isSelected = feature.id === selectedFeatureId;
                const color = getFeatureColor(feature);
                const points = feature.vertices.map((v) => `${toSvgX(v.x)},${toSvgY(v.y)}`).join(' ');
                return (
                  <g key={feature.id} data-feature-id={feature.id} onClick={() => handleFeatureClick(feature.id)}>
                    <polygon
                      points={points}
                      fill={color + '40'}
                      stroke={isSelected ? '#1f2937' : color}
                      strokeWidth={isSelected ? 3 : 2}
                      strokeDasharray={isSelected ? 'none' : undefined}
                    />
                    {feature.vertices.length > 0 && (() => {
                      const cx = feature.vertices.reduce((s, v) => s + v.x, 0) / feature.vertices.length;
                      const cy = feature.vertices.reduce((s, v) => s + v.y, 0) / feature.vertices.length;
                      return (
                        <text
                          x={toSvgX(cx)}
                          y={toSvgY(cy)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={12}
                          fontWeight="bold"
                          fill={color}
                          stroke="white"
                          strokeWidth={3}
                          paintOrder="stroke"
                          style={{ pointerEvents: 'none' }}
                        >
                          {feature.featureNumber}
                        </text>
                      );
                    })()}
                    {(drawMode === 'editVertex' && isSelected) && feature.vertices.map((v, idx) => (
                      <circle
                        key={idx}
                        cx={toSvgX(v.x)}
                        cy={toSvgY(v.y)}
                        r={5}
                        fill="white"
                        stroke={color}
                        strokeWidth={2}
                        data-vertex-idx={idx}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </g>
                );
              })}
            </g>

            {drawMode === 'draw' && drawingVertices.length > 0 && (
              <g>
                <polyline
                  points={drawingVertices.map((v) => `${toSvgX(v.x)},${toSvgY(v.y)}`).join(' ')}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="6,3"
                />
                {drawingVertices.map((v, idx) => (
                  <circle
                    key={idx}
                    cx={toSvgX(v.x)}
                    cy={toSvgY(v.y)}
                    r={4}
                    fill="#EF4444"
                    stroke="white"
                    strokeWidth={2}
                  />
                ))}
                {drawingVertices.length >= 3 && (() => {
                  const first = drawingVertices[0];
                  const last = drawingVertices[drawingVertices.length - 1];
                  const dist = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2);
                  if (dist < cellSize * 0.3) {
                    return (
                      <circle
                        cx={toSvgX(first.x)}
                        cy={toSvgY(first.y)}
                        r={8}
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth={2}
                        strokeDasharray="3,3"
                      />
                    );
                  }
                  return null;
                })()}
              </g>
            )}

            {hoveredCellId && (() => {
              const cell = trenchCells.find((c) => c.id === hoveredCellId);
              if (!cell) return null;
              const colIdx = cell.col - 1;
              const rowIdx = rows - cell.row;
              const x = LABEL_SIZE + colIdx * CELL_SIZE;
              const y = LABEL_SIZE + rowIdx * CELL_SIZE;
              return (
                <rect
                  x={x}
                  y={y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  fill="transparent"
                  stroke="#8B6340"
                  strokeWidth={2}
                  pointerEvents="none"
                />
              );
            })()}
          </svg>

          {drawMode === 'draw' && (
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
              <span className="text-sm text-gray-600">
                绘制模式 - 已点 {drawingVertices.length} 个顶点
                {drawingVertices.length < 3 && ' (至少需要3个)'}
              </span>
              {drawingVertices.length >= 3 && (
                <button
                  onClick={handleClosePolygon}
                  className="px-3 py-1.5 bg-earth-600 text-white rounded-lg text-sm font-medium hover:bg-earth-700"
                >
                  闭合多边形
                </button>
              )}
              {drawingVertices.length > 0 && (
                <button
                  onClick={handleUndoVertex}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  撤销顶点
                </button>
              )}
              <button
                onClick={handleCancelDraw}
                className="px-3 py-1.5 border border-gray-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
              >
                取消
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex border-b border-gray-200">
            {(['features', 'periods', 'relations', 'stats'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-earth-700 border-b-2 border-earth-600 bg-earth-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'features' ? '要素' : tab === 'periods' ? '分期' : tab === 'relations' ? '关系' : '统计'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-3">
            {activeTab === 'features' && (
              <div className="space-y-3">
                {selectedFeature ? (
                  <FeatureDetailPanel
                    feature={selectedFeature}
                    units={trenchUnits}
                    periods={trenchPeriods}
                    trenchCells={trenchCells}
                    onClose={() => setSelectedFeature(null)}
                    onEdit={(f) => { setEditingFeature(f); setShowFeatureForm(true); }}
                    onDelete={handleDeleteFeature}
                    onAssignPeriod={handleAssignPeriod}
                    onUnassignPeriod={handleUnassignPeriod}
                    canEdit={can('feature:edit')}
                    canDelete={can('feature:delete')}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs text-gray-500">时期筛选:</label>
                      <select
                        value={periodFilter}
                        onChange={(e) => setPeriodFilter(e.target.value)}
                        className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="all">全部时期</option>
                        <option value="unassigned">未分配时期</option>
                        {trenchPeriods.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    {filteredFeatures.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">
                        暂无遗迹要素{drawMode !== 'draw' ? '，点击"绘制要素"开始' : ''}
                      </p>
                    ) : (
                      filteredFeatures.map((f) => (
                        <div
                          key={f.id}
                          onClick={() => setSelectedFeature(f.id)}
                          className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                            f.id === selectedFeatureId
                              ? 'border-earth-400 bg-earth-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: getFeatureColor(f) }}
                            />
                            <span className="text-sm font-medium text-gray-800">{f.featureNumber}</span>
                            <span className="text-xs text-gray-500">{f.featureType}</span>
                          </div>
                          <div className="mt-1 text-xs text-gray-400">
                            覆盖{f.coveredCellIds.length}格 · {f.periodId ? periods.find((p) => p.id === f.periodId)?.name || '未分期' : '未分期'}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'periods' && (
              <div className="space-y-3">
                {can('period:create') && (
                  <button
                    onClick={handleCreatePeriod}
                    className="w-full px-3 py-2 bg-earth-600 text-white rounded-lg text-sm font-medium hover:bg-earth-700"
                  >
                    + 新建时期
                  </button>
                )}
                {trenchPeriods.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">暂无时期</p>
                ) : (
                  trenchPeriods.map((p) => {
                    const count = getFeaturesByPeriod(p.id).length;
                    return (
                      <div key={p.id} className="p-3 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: p.color }} />
                          <span className="text-sm font-medium text-gray-800">{p.name}</span>
                          <span className="text-xs text-gray-400 ml-auto">序号 {p.order}</span>
                        </div>
                        <div className="text-xs text-gray-500">{p.dateRange || '未设置年代范围'}</div>
                        <div className="text-xs text-gray-400 mt-1">包含 {count} 个要素</div>
                        <div className="flex gap-2 mt-2">
                          {can('period:edit') && (
                            <button
                              onClick={() => {
                                const newName = prompt('时期名称:', p.name);
                                if (newName) {
                                  const newRange = prompt('年代范围:', p.dateRange);
                                  updatePeriod(p.id, { name: newName, dateRange: newRange !== null ? newRange : p.dateRange });
                                }
                              }}
                              className="text-xs text-earth-600 hover:text-earth-800"
                            >
                              编辑
                            </button>
                          )}
                          {can('period:delete') && (
                            <button
                              onClick={() => handleDeletePeriod(p.id)}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {trenchPeriods.length > 0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">图例</h4>
                    <div className="space-y-1">
                      {trenchPeriods.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: p.color + '60' }} />
                          <span className="text-xs text-gray-600">{p.name} ({getFeaturesByPeriod(p.id).length})</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: '#6B728060' }} />
                        <span className="text-xs text-gray-600">未分期 ({trenchFeatures.filter((f) => !f.periodId).length})</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'relations' && (
              <div className="space-y-3">
                {unconfirmedRelations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-orange-600 mb-2">待确认关系 ({unconfirmedRelations.length})</h4>
                    {unconfirmedRelations.map((r) => {
                      const fA = trenchFeatures.find((f) => f.id === r.featureIdA);
                      const fB = trenchFeatures.find((f) => f.id === r.featureIdB);
                      return (
                        <div key={r.id} className="p-2 rounded-lg border border-orange-200 bg-orange-50 mb-2">
                          <div className="text-xs text-gray-800">
                            <span className="font-medium">{fA?.featureNumber || '?'}</span>
                            {' → '}
                            <span className="font-medium">{fB?.featureNumber || '?'}</span>
                            <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-orange-200 text-orange-800">{r.type}</span>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => confirmSpatialRelation(r.id)}
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              确认
                            </button>
                            <button
                              onClick={() => rejectSpatialRelation(r.id)}
                              className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
                            >
                              拒绝
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">已确认关系 ({confirmedRelations.length})</h4>
                  {confirmedRelations.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">暂无已确认关系</p>
                  ) : (
                    confirmedRelations.map((r) => {
                      const fA = trenchFeatures.find((f) => f.id === r.featureIdA);
                      const fB = trenchFeatures.find((f) => f.id === r.featureIdB);
                      const typeColor = r.type === '打破' ? 'text-red-600 bg-red-100' : r.type === '叠压' ? 'text-blue-600 bg-blue-100' : 'text-green-600 bg-green-100';
                      return (
                        <div key={r.id} className="p-2 rounded-lg border border-gray-200 mb-1">
                          <div className="text-xs text-gray-800">
                            <span className="font-medium">{fA?.featureNumber || '?'}</span>
                            {' → '}
                            <span className="font-medium">{fB?.featureNumber || '?'}</span>
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${typeColor}`}>{r.type}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">按类型×时期统计</h4>
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-1 pr-2 text-gray-500 font-medium">类型</th>
                          {trenchPeriods.map((p) => (
                            <th key={p.id} className="text-center py-1 px-1 text-gray-500 font-medium">{p.name}</th>
                          ))}
                          <th className="text-center py-1 px-1 text-gray-500 font-medium">未分期</th>
                          <th className="text-center py-1 px-1 text-gray-500 font-medium">合计</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(statsByTypeAndPeriod).map(([type, periodMap]) => (
                          <tr key={type} className="border-b border-gray-100">
                            <td className="py-1 pr-2 font-medium text-gray-700">{type}</td>
                            {trenchPeriods.map((p) => (
                              <td key={p.id} className="text-center py-1 px-1 text-gray-600">
                                {periodMap[p.name] || 0}
                              </td>
                            ))}
                            <td className="text-center py-1 px-1 text-gray-600">
                              {periodMap['未分配'] || 0}
                            </td>
                            <td className="text-center py-1 px-1 font-medium text-gray-800">
                              {Object.values(periodMap).reduce((a, b) => a + b, 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">按地层单位查询要素</h4>
                  <div className="space-y-1 max-h-48 overflow-auto">
                    {trenchUnits.length === 0 ? (
                      <p className="text-xs text-gray-400">暂无地层单位</p>
                    ) : (
                      trenchUnits.map((u) => {
                        const uFeats = unitFeaturesMap[u.id] || [];
                        return (
                          <div key={u.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: u.color }} />
                            <span className="text-xs font-medium text-gray-700">{u.code}</span>
                            <span className="text-xs text-gray-400">({uFeats.length}个要素)</span>
                            {uFeats.length > 0 && (
                              <span className="text-xs text-gray-500 truncate">
                                {uFeats.map((f) => f.featureNumber).join(', ')}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">按方格查询要素</h4>
                  <div className="space-y-1 max-h-48 overflow-auto">
                    {Object.entries(cellFeaturesMap).length === 0 ? (
                      <p className="text-xs text-gray-400">暂无数据</p>
                    ) : (
                      Object.entries(cellFeaturesMap).map(([cellId, feats]) => {
                        const cell = trenchCells.find((c) => c.id === cellId);
                        return (
                          <div key={cellId} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                            <span className="text-xs font-medium text-gray-700">{cell?.code || cellId}</span>
                            <span className="text-xs text-gray-500 truncate">
                              {feats.map((f) => f.featureNumber).join(', ')}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showFeatureForm && (
        <FeatureFormModal
          editingFeature={editingFeature}
          trenchFeatures={trenchFeatures}
          units={trenchUnits}
          onSubmit={handleFeatureFormSubmit}
          onCancel={() => { setShowFeatureForm(false); setEditingFeature(null); if (!editingFeature) handleCancelDraw(); }}
        />
      )}
    </div>
  );
}

function FeatureDetailPanel({
  feature,
  units,
  periods,
  trenchCells,
  onClose,
  onEdit,
  onDelete,
  onAssignPeriod,
  onUnassignPeriod,
  canEdit,
  canDelete,
}: {
  feature: RelicFeature;
  units: { id: string; code: string; name: string }[];
  periods: Period[];
  trenchCells: { id: string; code: string }[];
  onClose: () => void;
  onEdit: (f: RelicFeature) => void;
  onDelete: (id: string) => void;
  onAssignPeriod: (featureId: string, periodId: string) => void;
  onUnassignPeriod: (featureId: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const unit = units.find((u) => u.id === feature.unitId);
  const period = periods.find((p) => p.id === feature.periodId);
  const coveredCells = trenchCells.filter((c) => feature.coveredCellIds.includes(c.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">{feature.featureNumber}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">类型</span>
          <span className="text-gray-800 font-medium">{feature.featureType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">地层单位</span>
          <span className="text-gray-800">{unit ? `${unit.code} (${unit.name})` : '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">开口标高</span>
          <span className="text-gray-800">{feature.topElevation}m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">底部标高</span>
          <span className="text-gray-800">{feature.bottomElevation}m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">覆盖方格</span>
          <span className="text-gray-800">{coveredCells.length}格</span>
        </div>
        {coveredCells.length > 0 && (
          <div className="text-gray-500">
            {coveredCells.map((c) => c.code).join(', ')}
          </div>
        )}
        {feature.description && (
          <div>
            <span className="text-gray-500">描述</span>
            <p className="text-gray-700 mt-1">{feature.description}</p>
          </div>
        )}
        {feature.photoNumbers && (
          <div className="flex justify-between">
            <span className="text-gray-500">照片编号</span>
            <span className="text-gray-800">{feature.photoNumbers}</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">所属时期</span>
          {feature.periodId && (
            <button
              onClick={() => onUnassignPeriod(feature.id)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              取消分配
            </button>
          )}
        </div>
        {feature.periodId ? (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: period?.color || '#6B7280' }} />
            <span className="text-sm text-gray-800">{period?.name || '未知'}</span>
          </div>
        ) : (
          <select
            onChange={(e) => {
              if (e.target.value) onAssignPeriod(feature.id, e.target.value);
            }}
            value=""
            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value="">选择时期...</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        {canEdit && (
          <button
            onClick={() => onEdit(feature)}
            className="flex-1 px-3 py-1.5 text-xs bg-earth-600 text-white rounded-lg hover:bg-earth-700"
          >
            编辑
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(feature.id)}
            className="flex-1 px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
          >
            删除
          </button>
        )}
      </div>
    </div>
  );
}

function FeatureFormModal({
  editingFeature,
  trenchFeatures,
  units,
  onSubmit,
  onCancel,
}: {
  editingFeature: RelicFeature | null;
  trenchFeatures: RelicFeature[];
  units: { id: string; code: string; name: string }[];
  onSubmit: (data: { featureNumber: string; featureType: FeatureType; unitId: string; topElevation: number; bottomElevation: number; description: string; photoNumbers: string }) => void;
  onCancel: () => void;
}) {
  const [featureNumber, setFeatureNumber] = useState(editingFeature?.featureNumber || '');
  const [featureType, setFeatureType] = useState<FeatureType>(editingFeature?.featureType || '灰坑');
  const [unitId, setUnitId] = useState(editingFeature?.unitId || '');
  const [topElevation, setTopElevation] = useState(editingFeature?.topElevation?.toString() || '');
  const [bottomElevation, setBottomElevation] = useState(editingFeature?.bottomElevation?.toString() || '');
  const [description, setDescription] = useState(editingFeature?.description || '');
  const [photoNumbers, setPhotoNumbers] = useState(editingFeature?.photoNumbers || '');

  useEffect(() => {
    if (!editingFeature && featureType) {
      const suggested = generateFeatureNumber(featureType, trenchFeatures);
      setFeatureNumber(suggested);
    }
  }, [featureType, editingFeature, trenchFeatures]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const top = parseFloat(topElevation);
    const bottom = parseFloat(bottomElevation);
    if (isNaN(top) || isNaN(bottom)) {
      alert('请输入有效的标高数值');
      return;
    }
    if (!unitId) {
      alert('请选择所属地层单位');
      return;
    }
    onSubmit({
      featureNumber: featureNumber.trim(),
      featureType,
      unitId,
      topElevation: top,
      bottomElevation: bottom,
      description,
      photoNumbers,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          {editingFeature ? '编辑遗迹要素' : '新建遗迹要素'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">要素编号 *</label>
              <input
                type="text"
                value={featureNumber}
                onChange={(e) => setFeatureNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-earth-300 focus:border-earth-500 outline-none"
                placeholder="如 H1, F2"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">要素类型 *</label>
              <select
                value={featureType}
                onChange={(e) => setFeatureType(e.target.value as FeatureType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-earth-300 focus:border-earth-500 outline-none"
              >
                {FEATURE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">所属地层单位 *</label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-earth-300 focus:border-earth-500 outline-none"
              required
            >
              <option value="">选择地层单位...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">开口标高(m) *</label>
              <input
                type="number"
                step="0.01"
                value={topElevation}
                onChange={(e) => setTopElevation(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-earth-300 focus:border-earth-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">底部标高(m) *</label>
              <input
                type="number"
                step="0.01"
                value={bottomElevation}
                onChange={(e) => setBottomElevation(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-earth-300 focus:border-earth-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">描述文字</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-earth-300 focus:border-earth-500 outline-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">关联照片编号</label>
            <input
              type="text"
              value={photoNumbers}
              onChange={(e) => setPhotoNumbers(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-earth-300 focus:border-earth-500 outline-none"
              placeholder="如 P001, P002"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg text-sm font-medium hover:bg-earth-700"
            >
              {editingFeature ? '保存修改' : '创建要素'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
