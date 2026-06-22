import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import SpatialAnalysisOverlay from './SpatialAnalysisOverlay';
import { SpatialAnalysisTab, ARTIFACT_CATEGORIES, ArtifactCategory } from '../types';
import { getClusterColor } from '../utils/spatialAnalysis';
import { CATEGORY_COLORS } from '../types';

export default function SpatialAnalysisPanel() {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const selectedTrench = useAppStore((state) =>
    state.trenches.find((t) => t.id === selectedTrenchId)
  );
  const artifacts = useAppStore((state) => state.artifacts);
  const features = useAppStore((state) => state.features);
  const artifactSubtypes = useAppStore((state) => state.artifactSubtypes);

  const densityHeatmapConfig = useAppStore((state) => state.densityHeatmapConfig);
  const bufferQueryConfig = useAppStore((state) => state.bufferQueryConfig);
  const nearestNeighborConfig = useAppStore((state) => state.nearestNeighborConfig);
  const clusterConfig = useAppStore((state) => state.clusterConfig);

  const setDensityHeatmapConfig = useAppStore((state) => state.setDensityHeatmapConfig);
  const setBufferQueryConfig = useAppStore((state) => state.setBufferQueryConfig);
  const setNearestNeighborConfig = useAppStore((state) => state.setNearestNeighborConfig);
  const setClusterConfig = useAppStore((state) => state.setClusterConfig);

  const getDensityGrid = useAppStore((state) => state.getDensityGrid);
  const getBufferQueryResult = useAppStore((state) => state.getBufferQueryResult);
  const getNearestNeighbors = useAppStore((state) => state.getNearestNeighbors);
  const getDistributionStats = useAppStore((state) => state.getDistributionStats);
  const getArtifactClusters = useAppStore((state) => state.getArtifactClusters);

  const [activeTab, setActiveTab] = useState<SpatialAnalysisTab>('heatmap');
  const [selectedArtifactForStats, setSelectedArtifactForStats] = useState<'all' | 'buffer'>('all');

  const rows = selectedTrench?.rows || 0;
  const cols = selectedTrench?.cols || 0;
  const cellSize = selectedTrench?.cellSize || 1;

  const xMin = selectedTrench?.originX || 0;
  const yMin = selectedTrench?.originY || 0;
  const xMax = xMin + cols * cellSize;
  const yMax = yMin + rows * cellSize;

  const CELL_PIXEL_SIZE = 48;
  const PADDING = 56;

  const pixelWidth = cols * CELL_PIXEL_SIZE;
  const pixelHeight = rows * CELL_PIXEL_SIZE;

  const trenchArtifacts = useMemo(() =>
    artifacts.filter((a) => a.trenchId === selectedTrenchId),
    [artifacts, selectedTrenchId]
  );

  const trenchFeatures = useMemo(() =>
    features.filter((f) => f.trenchId === selectedTrenchId),
    [features, selectedTrenchId]
  );

  const densityGrid = useMemo(() => {
    if (!selectedTrenchId) return [];
    return getDensityGrid(selectedTrenchId);
  }, [selectedTrenchId, getDensityGrid]);

  const maxDensity = useMemo(() => {
    if (densityGrid.length === 0) return 0;
    return Math.max(...densityGrid.map((c) => c.count));
  }, [densityGrid]);

  const bufferResult = useMemo(() => {
    if (!selectedTrenchId) return null;
    return getBufferQueryResult(selectedTrenchId);
  }, [selectedTrenchId, getBufferQueryResult]);

  const nearestResult = useMemo(() => {
    if (!selectedTrenchId) return null;
    return getNearestNeighbors(selectedTrenchId);
  }, [selectedTrenchId, getNearestNeighbors]);

  const targetArtifact = useMemo(() => {
    if (!nearestResult) return null;
    return artifacts.find((a) => a.id === nearestResult.artifactId) || null;
  }, [nearestResult, artifacts]);

  const statsArtifacts = useMemo(() => {
    if (selectedArtifactForStats === 'buffer' && bufferResult) {
      return bufferResult.artifacts.map((a) => a.id);
    }
    return undefined;
  }, [selectedArtifactForStats, bufferResult]);

  const distributionStats = useMemo(() => {
    return getDistributionStats(statsArtifacts);
  }, [getDistributionStats, statsArtifacts]);

  const clusters = useMemo(() => {
    if (!selectedTrenchId) return [];
    return getArtifactClusters(selectedTrenchId);
  }, [selectedTrenchId, getArtifactClusters]);

  const handleMapClick = (mapX: number, mapY: number) => {
    if (activeTab === 'buffer' && bufferQueryConfig.mode === 'point') {
      setBufferQueryConfig({
        centerPoint: { x: mapX, y: mapY },
        active: true,
      });
    } else if (activeTab === 'nearest') {
      let closestArtifact = null;
      let closestDist = Infinity;

      for (const a of trenchArtifacts) {
        const dist = Math.sqrt((a.x - mapX) ** 2 + (a.y - mapY) ** 2);
        if (dist < closestDist) {
          closestDist = dist;
          closestArtifact = a;
        }
      }

      if (closestArtifact && closestDist < cellSize) {
        setNearestNeighborConfig({
          artifactId: closestArtifact.id,
          active: true,
        });
      }
    }
  };

  const clickMode = activeTab === 'buffer' && bufferQueryConfig.mode === 'point'
    ? 'buffer'
    : activeTab === 'nearest'
    ? 'nearest'
    : 'none';

  const tabs: { id: SpatialAnalysisTab; label: string; icon: string }[] = [
    { id: 'heatmap', label: '密度热力图', icon: '🔥' },
    { id: 'buffer', label: '缓冲区查询', icon: '⭕' },
    { id: 'nearest', label: '最近邻分析', icon: '📍' },
    { id: 'stats', label: '分布统计', icon: '📊' },
    { id: 'cluster', label: '聚类识别', icon: '🔵' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          {selectedTrench?.name} - 遗物空间分布分析
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          共 {trenchArtifacts.length} 件遗物，{trenchFeatures.length} 个遗迹要素
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 overflow-auto">
          <div className="inline-block relative">
            <div
              className="relative"
              style={{ width: pixelWidth + PADDING, height: pixelHeight + PADDING }}
            >
              <div className="absolute top-0 left-0 right-0 h-7 flex">
                <div style={{ width: PADDING }} />
                {Array.from({ length: cols }, (_, i) => (
                  <div
                    key={i}
                    style={{ width: CELL_PIXEL_SIZE }}
                    className="h-7 flex items-center justify-center text-[10px] text-gray-400 font-medium"
                  >
                    E{i + 1}
                  </div>
                ))}
              </div>

              <div className="absolute left-0 top-7 bottom-0 flex flex-col">
                {Array.from({ length: rows }, (_, rowIdx) => {
                  const rowNum = rows - rowIdx;
                  return (
                    <div
                      key={rowNum}
                      style={{ height: CELL_PIXEL_SIZE, width: PADDING }}
                      className="flex items-center justify-center text-[10px] text-gray-400 font-medium"
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
                        return (
                          <div
                            key={`${rowNum}-${colNum}`}
                            className="border border-gray-200 bg-gray-50"
                            style={{
                              width: CELL_PIXEL_SIZE,
                              height: CELL_PIXEL_SIZE,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}

                <svg
                  className="absolute top-0 left-0"
                  width={pixelWidth}
                  height={pixelHeight}
                >
                  {selectedTrenchId && (
                    <SpatialAnalysisOverlay
                      trenchId={selectedTrenchId}
                      xMin={xMin}
                      yMin={yMin}
                      xMax={xMax}
                      yMax={yMax}
                      pixelWidth={pixelWidth}
                      pixelHeight={pixelHeight}
                      onMapClick={handleMapClick}
                      clickMode={clickMode}
                    />
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-earth-700 border-b-2 border-earth-600 bg-earth-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'heatmap' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-800 mb-3">密度热力图设置</h3>

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">显示热力图</span>
                    <button
                      onClick={() => setDensityHeatmapConfig({ visible: !densityHeatmapConfig.visible })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        densityHeatmapConfig.visible ? 'bg-earth-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          densityHeatmapConfig.visible ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mb-3">
                    <label className="text-sm text-gray-600 block mb-2">
                      网格精度: {densityHeatmapConfig.gridSize.toFixed(1)}m
                    </label>
                    <input
                      type="range"
                      min="0.2"
                      max="2"
                      step="0.1"
                      value={densityHeatmapConfig.gridSize}
                      onChange={(e) => setDensityHeatmapConfig({ gridSize: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-earth-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0.2m</span>
                      <span>2m</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">遗物大类筛选</label>
                    <select
                      value={densityHeatmapConfig.selectedCategory}
                      onChange={(e) => setDensityHeatmapConfig({ selectedCategory: e.target.value as ArtifactCategory | 'all' })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
                    >
                      <option value="all">全部类别</option>
                      {ARTIFACT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">图例</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-4 rounded bg-gradient-to-r from-orange-100 to-red-500" />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0 件</span>
                    <span>{maxDensity} 件</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    当前网格数: {densityGrid.length} 格
                    <br />
                    有遗物网格: {densityGrid.filter((c) => c.count > 0).length} 格
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'buffer' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-800 mb-3">缓冲区查询设置</h3>

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">启用查询</span>
                    <button
                      onClick={() => setBufferQueryConfig({ active: !bufferQueryConfig.active })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        bufferQueryConfig.active ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          bufferQueryConfig.active ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mb-3">
                    <label className="text-sm text-gray-600 block mb-2">查询模式</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBufferQueryConfig({ mode: 'point' })}
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                          bufferQueryConfig.mode === 'point'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        点击选点
                      </button>
                      <button
                        onClick={() => setBufferQueryConfig({ mode: 'feature' })}
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                          bufferQueryConfig.mode === 'feature'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        选择遗迹
                      </button>
                    </div>
                  </div>

                  {bufferQueryConfig.mode === 'point' && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                      💡 点击地图任意位置设置圆心
                    </div>
                  )}

                  {bufferQueryConfig.mode === 'feature' && (
                    <div className="mb-3">
                      <label className="text-sm text-gray-600 block mb-2">选择遗迹要素</label>
                      <select
                        value={bufferQueryConfig.selectedFeatureId || ''}
                        onChange={(e) => {
                          setBufferQueryConfig({
                            selectedFeatureId: e.target.value || null,
                            active: true,
                          });
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">请选择遗迹</option>
                        {trenchFeatures.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.featureNumber} ({f.featureType})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      缓冲距离: {bufferQueryConfig.radius.toFixed(1)}m
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={bufferQueryConfig.radius}
                      onChange={(e) => setBufferQueryConfig({ radius: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0.5m</span>
                      <span>5m</span>
                    </div>
                  </div>
                </div>

                {bufferResult && bufferResult.artifacts.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      查询结果 ({bufferResult.artifacts.length} 件)
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {bufferResult.artifacts.map((artifact) => (
                        <div
                          key={artifact.id}
                          className="p-2 bg-blue-50 rounded text-xs"
                        >
                          <div className="font-medium text-gray-800">
                            {artifact.catalogNumber}
                          </div>
                          <div className="text-gray-500 mt-0.5">
                            {artifact.type} · {artifact.material}
                          </div>
                          <div className="text-gray-400 text-[10px] mt-0.5">
                            坐标: ({artifact.x.toFixed(2)}, {artifact.y.toFixed(2)}, {artifact.z.toFixed(2)})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bufferResult && bufferResult.artifacts.length === 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-sm text-gray-400">该范围内暂无遗物</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'nearest' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-800 mb-3">最近邻分析设置</h3>

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">启用分析</span>
                    <button
                      onClick={() => setNearestNeighborConfig({ active: !nearestNeighborConfig.active })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        nearestNeighborConfig.active ? 'bg-purple-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          nearestNeighborConfig.active ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mb-3 p-3 bg-purple-50 rounded-lg text-xs text-purple-700">
                    💡 点击地图上的遗物选择分析目标
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      邻近数量: {nearestNeighborConfig.neighborCount} 件
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="1"
                      value={nearestNeighborConfig.neighborCount}
                      onChange={(e) => setNearestNeighborConfig({ neighborCount: parseInt(e.target.value, 10) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>1件</span>
                      <span>20件</span>
                    </div>
                  </div>
                </div>

                {targetArtifact && (
                  <div className="pt-3 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">目标遗物</h4>
                    <div className="p-3 bg-purple-100 rounded-lg mb-3">
                      <div className="font-medium text-purple-800">
                        {targetArtifact.catalogNumber}
                      </div>
                      <div className="text-purple-600 text-xs mt-1">
                        {targetArtifact.type} · {targetArtifact.material}
                      </div>
                    </div>

                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      最近的 {nearestResult?.neighbors.length || 0} 件遗物
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {nearestResult?.neighbors.map((item, idx) => (
                        <div
                          key={item.artifact.id}
                          className="p-2 bg-purple-50 rounded text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">
                              <span className="text-purple-600 mr-1">#{idx + 1}</span>
                              {item.artifact.catalogNumber}
                            </span>
                            <span className="text-purple-600 font-medium">
                              {item.distance.toFixed(3)}m
                            </span>
                          </div>
                          <div className="text-gray-500 mt-0.5">
                            {item.artifact.type}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-800 mb-3">分布统计</h3>

                  <div className="mb-3">
                    <label className="text-sm text-gray-600 block mb-2">统计范围</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedArtifactForStats('all')}
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                          selectedArtifactForStats === 'all'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        全部遗物
                      </button>
                      <button
                        onClick={() => setSelectedArtifactForStats('buffer')}
                        disabled={!bufferResult}
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                          selectedArtifactForStats === 'buffer'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        } ${!bufferResult ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        缓冲区结果
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-xs text-green-600 mb-1">遗物总数</div>
                    <div className="text-2xl font-bold text-green-700">
                      {distributionStats.count} 件
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-2">平面分布范围</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">宽度:</span>
                        <span className="font-medium text-gray-800 ml-1">
                          {distributionStats.boundingBox.width.toFixed(2)}m
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">高度:</span>
                        <span className="font-medium text-gray-800 ml-1">
                          {distributionStats.boundingBox.height.toFixed(2)}m
                        </span>
                      </div>
                      <div className="col-span-2 text-xs text-gray-400">
                        X: {distributionStats.boundingBox.xMin.toFixed(2)} - {distributionStats.boundingBox.xMax.toFixed(2)}m
                        <br />
                        Y: {distributionStats.boundingBox.yMin.toFixed(2)} - {distributionStats.boundingBox.yMax.toFixed(2)}m
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-xs text-blue-600 mb-2">标高分布区间</div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-500">最高:</span>
                        <span className="font-medium text-blue-700">
                          {distributionStats.elevationRange.max.toFixed(3)}m
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-500">最低:</span>
                        <span className="font-medium text-blue-700">
                          {distributionStats.elevationRange.min.toFixed(3)}m
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-blue-200 pt-1 mt-1">
                        <span className="text-blue-600">极差:</span>
                        <span className="font-bold text-blue-700">
                          {distributionStats.elevationRange.range.toFixed(3)}m
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-lg">
                    <div className="text-xs text-amber-600 mb-1">平均最近邻距离</div>
                    <div className="text-xl font-bold text-amber-700">
                      {distributionStats.averageNearestNeighborDistance.toFixed(3)}m
                    </div>
                    <div className="text-[10px] text-amber-500 mt-1">
                      基于三维欧氏距离计算
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cluster' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-800 mb-3">聚类识别设置</h3>

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">显示聚类</span>
                    <button
                      onClick={() => setClusterConfig({ visible: !clusterConfig.visible })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        clusterConfig.visible ? 'bg-teal-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          clusterConfig.visible ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mb-3">
                    <label className="text-sm text-gray-600 block mb-2">
                      距离阈值: {clusterConfig.distanceThreshold.toFixed(2)}m
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={clusterConfig.distanceThreshold}
                      onChange={(e) => setClusterConfig({ distanceThreshold: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0.1m</span>
                      <span>1m</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      最小聚类成员数: {clusterConfig.minClusterSize} 件
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="1"
                      value={clusterConfig.minClusterSize}
                      onChange={(e) => setClusterConfig({ minClusterSize: parseInt(e.target.value, 10) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>2件</span>
                      <span>10件</span>
                    </div>
                  </div>
                </div>

                {clusterConfig.visible && (
                  <div className="pt-3 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      识别到 {clusters.length} 个聚类
                    </h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {clusters.map((cluster, idx) => {
                        const color = getClusterColor(idx);
                        return (
                          <div
                            key={cluster.id}
                            className="p-3 rounded-lg border"
                            style={{ borderColor: color + '40', backgroundColor: color + '10' }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className="text-sm font-bold"
                                style={{ color }}
                              >
                                聚类 C{idx + 1}
                              </span>
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: color + '30', color }}
                              >
                                {cluster.members.length} 件
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              中心: ({cluster.centroid.x.toFixed(2)}, {cluster.centroid.y.toFixed(2)})
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {cluster.members.slice(0, 3).map((m) => (
                                <span
                                  key={m.id}
                                  className="text-[10px] px-1.5 py-0.5 bg-white rounded border"
                                  style={{ borderColor: color + '30' }}
                                >
                                  {m.catalogNumber}
                                </span>
                              ))}
                              {cluster.members.length > 3 && (
                                <span className="text-[10px] px-1.5 py-0.5 text-gray-400">
                                  +{cluster.members.length - 3}件
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {clusterConfig.visible && clusters.length === 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-sm text-gray-400">未识别到符合条件的聚类</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
