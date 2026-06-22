import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { SOIL_COLORS } from '../utils';
import SurveyMapOverlay from './SurveyMapOverlay';
import SpatialAnalysisOverlay from './SpatialAnalysisOverlay';
import { CONTROL_POINT_TYPE_COLORS, CONTROL_POINT_TYPE_ICONS } from '../utils/survey';
import { ControlPointType, IDWResult } from '../types';

export default function GridView() {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const selectedCellId = useAppStore((state) => state.selectedCellId);
  const setSelectedCell = useAppStore((state) => state.setSelectedCell);
  const getCellsByTrench = useAppStore((state) => state.getCellsByTrench);
  const getStratigraphiesByCell = useAppStore((state) => state.getStratigraphiesByCell);
  const getFeaturesByCell = useAppStore((state) => state.getFeaturesByCell);
  const contourConfig = useAppStore((state) => state.contourConfig);
  const setContourConfig = useAppStore((state) => state.setContourConfig);
  const showControlPointsOnMap = useAppStore((state) => state.showControlPointsOnMap);
  const setShowControlPointsOnMap = useAppStore((state) => state.setShowControlPointsOnMap);
  const densityHeatmapConfig = useAppStore((state) => state.densityHeatmapConfig);
  const setDensityHeatmapConfig = useAppStore((state) => state.setDensityHeatmapConfig);
  const interpolateElevationAt = useAppStore((state) => state.interpolateElevationAt);
  const selectedTrench = useAppStore((state) =>
    state.trenches.find((t) => t.id === selectedTrenchId)
  );

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridPixelSize, setGridPixelSize] = useState({ width: 0, height: 0 });
  const [queryMode, setQueryMode] = useState(false);
  const [queryPosition, setQueryPosition] = useState<{ x: number; y: number } | null>(null);
  const [queryResult, setQueryResult] = useState<IDWResult | null>(null);

  const cells = useMemo(
    () => (selectedTrenchId ? getCellsByTrench(selectedTrenchId) : []),
    [selectedTrenchId, getCellsByTrench]
  );

  const rows = selectedTrench?.rows || 0;
  const cols = selectedTrench?.cols || 0;
  const cellSize = selectedTrench?.cellSize || 1;

  const xMin = selectedTrench?.originX || 0;
  const yMin = selectedTrench?.originY || 0;
  const xMax = xMin + cols * cellSize;
  const yMax = yMin + rows * cellSize;

  const CELL_PIXEL_SIZE = 64;
  const PADDING = 64;

  const pixelWidth = cols * CELL_PIXEL_SIZE;
  const pixelHeight = rows * CELL_PIXEL_SIZE;

  const getCellStratCount = (cellId: string) => {
    return getStratigraphiesByCell(cellId).length;
  };

  const pointTypeOptions: { value: ControlPointType; label: string }[] = [
    { value: '基准点', label: '基准点' },
    { value: '加密点', label: '加密点' },
    { value: '临时点', label: '临时点' },
  ];

  const handleQueryElevation = (x: number, y: number) => {
    if (!selectedTrenchId) return;
    setQueryPosition({ x, y });
    setQueryResult(interpolateElevationAt(x, y, selectedTrenchId));
  };

  const handleQueryModeToggle = () => {
    const newMode = !queryMode;
    setQueryMode(newMode);
    if (!newMode) {
      setQueryPosition(null);
      setQueryResult(null);
    }
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!queryMode || !selectedTrenchId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const mapX = xMin + (px / pixelWidth) * (xMax - xMin);
    const mapY = yMax - (py / pixelHeight) * (yMax - yMin);

    setQueryPosition({ x: mapX, y: mapY });
    setQueryResult(interpolateElevationAt(mapX, mapY, selectedTrenchId));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {selectedTrench?.name} - 方格网视图
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {rows} 行 × {cols} 列，共 {cells.length} 个方格，每格 {selectedTrench?.cellSize}m × {selectedTrench?.cellSize}m
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            已记录地层: <span className="font-medium">{cells.filter(c => getCellStratCount(c.id) > 0).length}</span> / {cells.length} 格
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">等高线:</span>
          <button
            onClick={() => setContourConfig({ visible: !contourConfig.visible })}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              contourConfig.visible
                ? 'bg-earth-100 text-earth-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {contourConfig.visible ? '✓ 显示' : '显示'}
          </button>
          {contourConfig.visible && (
            <select
              value={contourConfig.interval}
              onChange={(e) => setContourConfig({ interval: parseFloat(e.target.value) })}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
            >
              <option value={0.1}>0.1m</option>
              <option value={0.2}>0.2m</option>
              <option value={0.5}>0.5m</option>
              <option value={1.0}>1.0m</option>
              <option value={2.0}>2.0m</option>
            </select>
          )}
        </div>

        <div className="w-px h-6 bg-gray-200" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">控制点:</span>
          <button
            onClick={() => setShowControlPointsOnMap(!showControlPointsOnMap)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              showControlPointsOnMap
                ? 'bg-earth-100 text-earth-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {showControlPointsOnMap ? '✓ 显示' : '显示'}
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">遗物热力图:</span>
          <button
            onClick={() => setDensityHeatmapConfig({ visible: !densityHeatmapConfig.visible })}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              densityHeatmapConfig.visible
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {densityHeatmapConfig.visible ? '✓ 显示' : '显示'}
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">标高查询:</span>
          <button
            onClick={handleQueryModeToggle}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              queryMode
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {queryMode ? '✓ 开启中' : '点击开启'}
          </button>
          {queryMode && (
            <span className="text-xs text-blue-600">
              点击地图任意位置查询推算标高
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 overflow-auto">
        <div className="inline-block relative" ref={gridContainerRef}>
          <div className="relative" style={{ width: pixelWidth + PADDING, height: pixelHeight + PADDING }}>
            <div className="absolute top-0 left-0 right-0 h-8 flex">
              <div style={{ width: PADDING }} />
              {Array.from({ length: cols }, (_, i) => (
                <div
                  key={i}
                  style={{ width: CELL_PIXEL_SIZE }}
                  className="h-8 flex items-center justify-center text-xs text-gray-500 font-medium"
                >
                  E{i + 1}
                </div>
              ))}
            </div>

            <div className="absolute left-0 top-8 bottom-0 flex flex-col">
              {Array.from({ length: rows }, (_, rowIdx) => {
                const rowNum = rows - rowIdx;
                return (
                  <div
                    key={rowNum}
                    style={{ height: CELL_PIXEL_SIZE, width: PADDING }}
                    className="flex items-center justify-center text-xs text-gray-500 font-medium"
                  >
                    N{rowNum}
                  </div>
                );
              })}
            </div>

            <div
              className="absolute"
              style={{
                left: PADDING,
                top: PADDING / 2,
                width: pixelWidth,
                height: pixelHeight,
              }}
            >
              {Array.from({ length: rows }, (_, rowIdx) => {
                const rowNum = rows - rowIdx;
                return (
                  <div key={rowNum} className="flex">
                    {Array.from({ length: cols }, (_, colIdx) => {
                      const colNum = colIdx + 1;
                      const cell = cells.find(
                        (c) => c.row === rowNum && c.col === colNum
                      );
                      if (!cell) return <div key={colNum} style={{ width: CELL_PIXEL_SIZE, height: CELL_PIXEL_SIZE }} />;

                      const isSelected = cell.id === selectedCellId;
                      const stratCount = getCellStratCount(cell.id);
                      const strats = getStratigraphiesByCell(cell.id);
                      const cellFeatures = getFeaturesByCell(cell.id);
                      const featureCount = cellFeatures.length;

                      return (
                        <button
                          key={cell.id}
                          onClick={() => setSelectedCell(cell.id)}
                          className="border-2 relative transition-all"
                          style={{
                            width: CELL_PIXEL_SIZE,
                            height: CELL_PIXEL_SIZE,
                            borderColor: isSelected ? '#92400e' : '#d1d5db',
                            boxShadow: isSelected ? '0 0 0 2px #fde68a' : 'none',
                            zIndex: isSelected ? 10 : 1,
                            backgroundColor: strats.length > 0 
                              ? SOIL_COLORS[strats[0].soilType] + '40'
                              : undefined,
                          }}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-xs font-medium ${
                              isSelected ? 'text-earth-700' : 'text-gray-600'
                            }`}>
                              {cell.code.replace(selectedTrench?.code || '', '')}
                            </span>
                            {stratCount > 0 && (
                              <span className="text-xs text-gray-500 mt-0.5">
                                {stratCount}层
                              </span>
                            )}
                          </div>
                          {featureCount > 0 && (
                            <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-earth-600 text-white text-[10px] font-bold flex items-center justify-center">
                              {featureCount}
                            </div>
                          )}
                          {strats.length > 1 && (
                            <div className="absolute bottom-0 left-0 right-0 flex">
                              {strats.slice(0, 5).map((strat, idx) => (
                                <div
                                  key={strat.id}
                                  className="flex-1 h-1"
                                  style={{
                                    backgroundColor: SOIL_COLORS[strat.soilType] || '#ccc',
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <svg
              className={`absolute ${queryMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
              style={{
                left: PADDING,
                top: PADDING / 2,
                width: pixelWidth,
                height: pixelHeight,
              }}
              width={pixelWidth}
              height={pixelHeight}
              onClick={handleMapClick}
            >
              {queryMode && (
                <rect
                  x={0}
                  y={0}
                  width={pixelWidth}
                  height={pixelHeight}
                  fill="transparent"
                />
              )}
              {selectedTrenchId && (
                <SurveyMapOverlay
                  trenchId={selectedTrenchId}
                  xMin={xMin}
                  yMin={yMin}
                  xMax={xMax}
                  yMax={yMax}
                  pixelWidth={pixelWidth}
                  pixelHeight={pixelHeight}
                  queryMode={queryMode}
                  onQueryElevation={handleQueryElevation}
                  queryResult={queryResult}
                  queryPosition={queryPosition}
                />
              )}
              {selectedTrenchId && (
                <SpatialAnalysisOverlay
                  trenchId={selectedTrenchId}
                  xMin={xMin}
                  yMin={yMin}
                  xMax={xMax}
                  yMax={yMax}
                  pixelWidth={pixelWidth}
                  pixelHeight={pixelHeight}
                />
              )}
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">图例 - 土质类型</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(SOIL_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600">{type}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">图例 - 控制点</h3>
          <div className="space-y-2">
            {pointTypeOptions.map((type) => (
              <div key={type.value} className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-white text-xs"
                  style={{
                    borderColor: CONTROL_POINT_TYPE_COLORS[type.value],
                    color: CONTROL_POINT_TYPE_COLORS[type.value],
                    backgroundColor: 'white',
                  }}
                >
                  {CONTROL_POINT_TYPE_ICONS[type.value]}
                </div>
                <span className="text-xs text-gray-600">{type.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
              <div className="w-5 h-0.5 bg-earth-600" />
              <span className="text-xs text-gray-600">等高线</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">操作说明</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• 点击方格进入地层记录界面</li>
            <li>• 方格颜色表示最上层土质</li>
            <li>• 底部色条显示该格所有地层</li>
            <li>• 点击空白处查询推算标高</li>
            <li>• 悬停控制点查看详情</li>
          </ul>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">方格详情</h3>
          {selectedCellId ? (
            <div className="text-xs text-gray-600 space-y-1">
              <p>方格编号: {cells.find(c => c.id === selectedCellId)?.code}</p>
              <p>X范围: {cells.find(c => c.id === selectedCellId)?.xMin.toFixed(2)} - {cells.find(c => c.id === selectedCellId)?.xMax.toFixed(2)}m</p>
              <p>Y范围: {cells.find(c => c.id === selectedCellId)?.yMin.toFixed(2)} - {cells.find(c => c.id === selectedCellId)?.yMax.toFixed(2)}m</p>
              <p>中心: ({cells.find(c => c.id === selectedCellId)?.centerX.toFixed(2)}, {cells.find(c => c.id === selectedCellId)?.centerY.toFixed(2)})</p>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="font-medium text-gray-700 mb-1">
                  穿过该格的遗迹要素 ({getFeaturesByCell(selectedCellId).length}个)
                </p>
                {getFeaturesByCell(selectedCellId).length === 0 ? (
                  <p className="text-gray-400">暂无</p>
                ) : (
                  <div className="space-y-1">
                    {getFeaturesByCell(selectedCellId).map((f) => (
                      <div key={f.id} className="flex items-center gap-2 py-0.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-earth-500" />
                        <span className="font-medium text-gray-800">{f.featureNumber}</span>
                        <span className="text-gray-500">({f.featureType})</span>
                        <span className="text-gray-400">开口 {f.topElevation}m · 底 {f.bottomElevation}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">请选择一个方格查看详情</p>
          )}
        </div>
      </div>
    </div>
  );
}
