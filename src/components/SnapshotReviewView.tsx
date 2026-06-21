import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSnapshotStore } from '../store/useSnapshotStore';
import { SnapshotCellState } from '../types';
import { formatDate } from '../utils';

interface SnapshotReviewViewProps {
  snapshotId: string;
  onBack: () => void;
}

export default function SnapshotReviewView({ snapshotId, onBack }: SnapshotReviewViewProps) {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const selectedTrench = useAppStore((state) =>
    state.trenches.find((t) => t.id === selectedTrenchId)
  );
  const getCellsByTrench = useAppStore((state) => state.getCellsByTrench);
  const snapshot = useSnapshotStore((state) => state.getSnapshotById(snapshotId));

  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  const cells = useMemo(
    () => (selectedTrenchId ? getCellsByTrench(selectedTrenchId) : []),
    [selectedTrenchId, getCellsByTrench]
  );

  const cellStateMap = useMemo(() => {
    const map = new Map<string, SnapshotCellState>();
    if (snapshot) {
      snapshot.cellStates.forEach((cs) => map.set(cs.cellId, cs));
    }
    return map;
  }, [snapshot]);

  const rows = selectedTrench?.rows || 0;
  const cols = selectedTrench?.cols || 0;

  const CELL_PIXEL_SIZE = 64;
  const PADDING = 64;
  const pixelWidth = cols * CELL_PIXEL_SIZE;
  const pixelHeight = rows * CELL_PIXEL_SIZE;

  const maxLayer = useMemo(() => {
    if (!snapshot) return 0;
    let max = 0;
    snapshot.cellStates.forEach((cs) => {
      if (cs.deepestLayerNumber > max) max = cs.deepestLayerNumber;
    });
    return max || 1;
  }, [snapshot]);

  const getLayerColor = (layerNum: number) => {
    if (layerNum === 0) return '#f9fafb';
    const intensity = Math.min(layerNum / maxLayer, 1);
    const r = Math.round(254 - intensity * 160);
    const g = Math.round(243 - intensity * 150);
    const b = Math.round(199 - intensity * 100);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const selectedCell = cells.find((c) => c.id === selectedCellId);
  const selectedCellState = selectedCellId ? cellStateMap.get(selectedCellId) : undefined;
  const featuresInSelectedCell = snapshot?.featureSnapshots.filter(
    (f) => selectedCellId && f.coveredCellIds.includes(selectedCellId)
  ) || [];

  if (!snapshot || !selectedTrench) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        快照数据不存在
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-200 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-amber-800">
              正在查看历史快照 · 所有编辑操作已禁用
            </div>
            <div className="text-amber-700 mt-0.5">
              <span className="font-semibold">{snapshot.name}</span>
              <span className="mx-2">·</span>
              <span>{formatDate(new Date(snapshot.createdAt))}</span>
              {snapshot.remark && (
                <>
                  <span className="mx-2">·</span>
                  <span className="text-amber-600">{snapshot.remark}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回快照列表
        </button>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">已揭露方格</div>
          <div className="text-2xl font-bold text-gray-800">
            {snapshot.exposedCellCount}
            <span className="text-sm font-normal text-gray-500">/{snapshot.totalCellCount}</span>
          </div>
          <div className="text-xs text-earth-600 mt-1">
            {snapshot.totalCellCount > 0
              ? ((snapshot.exposedCellCount / snapshot.totalCellCount) * 100).toFixed(1) + '%'
              : '0%'}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">地层记录</div>
          <div className="text-2xl font-bold text-gray-800">{snapshot.totalStratigraphies}</div>
          <div className="text-xs text-gray-500 mt-1">条</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">遗物总数</div>
          <div className="text-2xl font-bold text-gray-800">{snapshot.totalArtifacts}</div>
          <div className="text-xs text-gray-500 mt-1">件</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">遗迹要素</div>
          <div className="text-2xl font-bold text-gray-800">{snapshot.totalFeatures}</div>
          <div className="text-xs text-gray-500 mt-1">个</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">地层关系 / 样品</div>
          <div className="text-2xl font-bold text-gray-800">
            {snapshot.totalRelations}
            <span className="text-sm font-normal text-gray-400 mx-1">/</span>
            {snapshot.totalSamples}
          </div>
          <div className="text-xs text-gray-500 mt-1">条 / 件</div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 overflow-auto">
        <div className="flex-1 flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {selectedTrench.name} - 方格揭露进度（{snapshot.name}）
            </h3>
            <div className="inline-block relative">
              <div
                className="relative"
                style={{ width: pixelWidth + PADDING, height: pixelHeight + PADDING }}
              >
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
                          if (!cell)
                            return (
                              <div
                                key={colNum}
                                style={{ width: CELL_PIXEL_SIZE, height: CELL_PIXEL_SIZE }}
                              />
                            );

                          const isSelected = cell.id === selectedCellId;
                          const cellState = cellStateMap.get(cell.id);
                          const layerNum = cellState?.deepestLayerNumber ?? 0;
                          const featureCount = cellState?.featureIds.length ?? 0;
                          const bgColor = getLayerColor(layerNum);

                          return (
                            <button
                              key={cell.id}
                              onClick={() => setSelectedCellId(cell.id)}
                              className="border-2 relative transition-all"
                              style={{
                                width: CELL_PIXEL_SIZE,
                                height: CELL_PIXEL_SIZE,
                                borderColor: isSelected ? '#b45309' : layerNum > 0 ? '#d97706' : '#e5e7eb',
                                boxShadow: isSelected ? '0 0 0 2px #fef3c7' : 'none',
                                zIndex: isSelected ? 10 : 1,
                                backgroundColor: bgColor,
                              }}
                            >
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span
                                  className={`text-xs font-medium ${
                                    isSelected ? 'text-earth-800' : layerNum > 0 ? 'text-earth-700' : 'text-gray-400'
                                  }`}
                                >
                                  {cell.code.replace(selectedTrench?.code || '', '')}
                                </span>
                                {layerNum > 0 && (
                                  <span className="text-xs font-semibold text-earth-800 mt-0.5">
                                    {layerNum}层
                                  </span>
                                )}
                              </div>
                              {featureCount > 0 && (
                                <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-earth-700 text-white text-[10px] font-bold flex items-center justify-center">
                                  {featureCount}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-80 space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">图例 - 揭露深度</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: getLayerColor(0) }} />
                  <span className="text-xs text-gray-600">未揭露</span>
                </div>
                {Array.from({ length: Math.min(maxLayer, 6) }, (_, i) => {
                  const ln = i + 1;
                  return (
                    <div key={ln} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-earth-300"
                        style={{ backgroundColor: getLayerColor(ln) }}
                      />
                      <span className="text-xs text-gray-600">第{ln}层</span>
                    </div>
                  );
                })}
                {maxLayer > 6 && (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border border-earth-500"
                      style={{ backgroundColor: getLayerColor(maxLayer) }}
                    />
                    <span className="text-xs text-gray-600">最深 {maxLayer} 层</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full bg-earth-700 text-white text-[8px] font-bold flex items-center justify-center">
                    N
                  </div>
                  <span className="text-xs text-gray-600">方格内遗迹要素数量</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">方格详情</h3>
              {selectedCell && selectedCellState ? (
                <div className="text-xs text-gray-600 space-y-1">
                  <p className="font-medium text-gray-800 text-sm">{selectedCell.code}</p>
                  <p>行{selectedCell.row} 列{selectedCell.col}</p>
                  <p>
                    X范围: {selectedCell.xMin.toFixed(2)} - {selectedCell.xMax.toFixed(2)}m
                  </p>
                  <p>
                    Y范围: {selectedCell.yMin.toFixed(2)} - {selectedCell.yMax.toFixed(2)}m
                  </p>
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                    <p>
                      <span className="text-gray-500">最深层数:</span>{' '}
                      <span className="font-semibold text-earth-700">
                        {selectedCellState.deepestLayerNumber || 0} 层
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">地层记录:</span>{' '}
                      <span className="font-semibold">{selectedCellState.stratigraphyCount} 条</span>
                    </p>
                    <p>
                      <span className="text-gray-500">遗迹要素:</span>{' '}
                      <span className="font-semibold">{selectedCellState.featureIds.length} 个</span>
                    </p>
                  </div>
                  {featuresInSelectedCell.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="font-medium text-gray-700 mb-1">穿过的遗迹要素</p>
                      <div className="space-y-1">
                        {featuresInSelectedCell.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center gap-2 py-0.5"
                          >
                            <span className="inline-block w-2 h-2 rounded-full bg-earth-500" />
                            <span className="font-medium text-gray-800">
                              {f.featureNumber}
                            </span>
                            <span className="text-gray-500">({f.featureType})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">请选择一个方格查看详情</p>
              )}
            </div>

            {snapshot.featureSnapshots.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-80 overflow-y-auto">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  遗迹要素列表 ({snapshot.featureSnapshots.length})
                </h3>
                <div className="space-y-1.5">
                  {snapshot.featureSnapshots.map((f) => (
                    <div
                      key={f.id}
                      className="p-2 bg-gray-50 rounded text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-earth-500" />
                        <span className="font-medium text-gray-800">{f.featureNumber}</span>
                        <span className="text-gray-500">({f.featureType})</span>
                      </div>
                      <div className="text-gray-500 mt-0.5 ml-4">
                        覆盖 {f.coveredCellIds.length} 格 · 开口 {f.topElevation}m / 底 {f.bottomElevation}m
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
