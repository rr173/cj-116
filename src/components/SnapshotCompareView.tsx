import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSnapshotStore } from '../store/useSnapshotStore';
import { formatDate } from '../utils';

interface SnapshotCompareViewProps {
  snapshotAId: string;
  snapshotBId: string;
  onBack: () => void;
}

export default function SnapshotCompareView({ snapshotAId, snapshotBId, onBack }: SnapshotCompareViewProps) {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const selectedTrench = useAppStore((state) =>
    state.trenches.find((t) => t.id === selectedTrenchId)
  );
  const getCellsByTrench = useAppStore((state) => state.getCellsByTrench);
  const compareSnapshots = useSnapshotStore((state) => state.compareSnapshots);

  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  const cells = useMemo(
    () => (selectedTrenchId ? getCellsByTrench(selectedTrenchId) : []),
    [selectedTrenchId, getCellsByTrench]
  );

  const compareResult = useMemo(
    () => compareSnapshots(snapshotAId, snapshotBId),
    [compareSnapshots, snapshotAId, snapshotBId]
  );

  const rows = selectedTrench?.rows || 0;
  const cols = selectedTrench?.cols || 0;

  const CELL_PIXEL_SIZE = 64;
  const PADDING = 64;
  const pixelWidth = cols * CELL_PIXEL_SIZE;
  const pixelHeight = rows * CELL_PIXEL_SIZE;

  const snapshotA = compareResult?.snapshotA;
  const snapshotB = compareResult?.snapshotB;

  const cellStateAMap = useMemo(() => {
    const map = new Map();
    snapshotA?.cellStates.forEach((cs) => map.set(cs.cellId, cs));
    return map;
  }, [snapshotA]);

  const cellStateBMap = useMemo(() => {
    const map = new Map();
    snapshotB?.cellStates.forEach((cs) => map.set(cs.cellId, cs));
    return map;
  }, [snapshotB]);

  const selectedCell = cells.find((c) => c.id === selectedCellId);
  const selectedStateA = selectedCellId ? cellStateAMap.get(selectedCellId) : undefined;
  const selectedStateB = selectedCellId ? cellStateBMap.get(selectedCellId) : undefined;
  const selectedDiff = selectedCellId ? compareResult?.cellDifferences[selectedCellId] : undefined;

  if (!compareResult || !snapshotA || !snapshotB || !selectedTrench) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        无法加载对比数据
      </div>
    );
  }

  const timeDiffDays = Math.ceil(
    (snapshotB.createdAt - snapshotA.createdAt) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 bg-gradient-to-r from-blue-50 via-purple-50 to-orange-50 border-2 border-purple-300 rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-6">
            <div className="flex items-center gap-4">
              <div className="px-4 py-3 bg-green-100 border-2 border-green-300 rounded-xl">
                <div className="text-xs font-medium text-green-700 mb-0.5">快照 A（较早）</div>
                <div className="font-bold text-green-800">{snapshotA.name}</div>
                <div className="text-xs text-green-600 mt-0.5">{formatDate(new Date(snapshotA.createdAt))}</div>
              </div>
              <div className="flex flex-col items-center justify-center py-2">
                <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div className="text-xs text-purple-600 font-medium mt-1">
                  间隔 {timeDiffDays} 天
                </div>
              </div>
              <div className="px-4 py-3 bg-orange-100 border-2 border-orange-300 rounded-xl">
                <div className="text-xs font-medium text-orange-700 mb-0.5">快照 B（较晚）</div>
                <div className="font-bold text-orange-800">{snapshotB.name}</div>
                <div className="text-xs text-orange-600 mt-0.5">{formatDate(new Date(snapshotB.createdAt))}</div>
              </div>
            </div>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border-2 border-green-200 p-4">
          <div className="text-xs text-gray-500 mb-1">新揭露方格</div>
          <div className="text-2xl font-bold text-green-700">+{compareResult.newlyExposedCells.length}</div>
          <div className="text-xs text-green-600 mt-1">B 比 A 新增揭露</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-orange-200 p-4">
          <div className="text-xs text-gray-500 mb-1">加深方格</div>
          <div className="text-2xl font-bold text-orange-700">+{compareResult.deepenedCells.length}</div>
          <div className="text-xs text-orange-600 mt-1">揭露层数增加</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-blue-200 p-4">
          <div className="text-xs text-gray-500 mb-1">新增地层 / 遗物</div>
          <div className="text-2xl font-bold text-blue-700">
            +{compareResult.newStratigraphies}
            <span className="text-sm font-normal text-gray-400 mx-1">/</span>
            +{compareResult.newArtifacts}
          </div>
          <div className="text-xs text-blue-600 mt-1">条 / 件</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-purple-200 p-4">
          <div className="text-xs text-gray-500 mb-1">新增遗迹 / 关系</div>
          <div className="text-2xl font-bold text-purple-700">
            +{compareResult.newFeatures}
            <span className="text-sm font-normal text-gray-400 mx-1">/</span>
            +{compareResult.newRelations}
          </div>
          <div className="text-xs text-purple-600 mt-1">个 / 条</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-earth-200 p-4">
          <div className="text-xs text-gray-500 mb-1">新增样品 / 总变化</div>
          <div className="text-2xl font-bold text-earth-700">
            +{compareResult.newSamples}
            <span className="text-sm font-normal text-gray-400 mx-1">/</span>
            {compareResult.newlyExposedCells.length + compareResult.deepenedCells.length}
          </div>
          <div className="text-xs text-earth-600 mt-1">件 / 变动格数</div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 overflow-auto">
        <div className="flex flex-col lg:flex-row gap-4 h-full">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              差异可视化对比视图
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
                          const diff = compareResult.cellDifferences[cell.id];
                          const stateB = cellStateBMap.get(cell.id);
                          const layerB = stateB?.deepestLayerNumber ?? 0;

                          let borderColor = '#e5e7eb';
                          let borderWidth = 'border-2';
                          let bgColor = '#f9fafb';
                          let opacityClass = '';

                          if (diff) {
                            if (diff.status === 'new') {
                              borderColor = '#16a34a';
                              borderWidth = 'border-[3px]';
                              bgColor = '#dcfce7';
                            } else if (diff.status === 'deepened') {
                              borderColor = '#ea580c';
                              borderWidth = 'border-[3px]';
                              bgColor = '#ffedd5';
                            } else {
                              opacityClass = 'opacity-50';
                              bgColor = '#f3f4f6';
                            }
                          } else {
                            const stateA = cellStateAMap.get(cell.id);
                            const layerA = stateA?.deepestLayerNumber ?? 0;
                            if (layerA === 0 && layerB === 0) {
                              opacityClass = 'opacity-40';
                            } else if (layerA > 0 && !stateB) {
                              opacityClass = 'opacity-50';
                            }
                          }

                          if (layerB > 0 && !diff) {
                            const maxLayer = Math.max(
                              ...snapshotB.cellStates.map((c) => c.deepestLayerNumber),
                              1
                            );
                            const intensity = Math.min(layerB / maxLayer, 1);
                            const r = Math.round(254 - intensity * 160);
                            const g = Math.round(243 - intensity * 150);
                            const b = Math.round(199 - intensity * 100);
                            bgColor = `rgb(${r}, ${g}, ${b})`;
                          }

                          return (
                            <button
                              key={cell.id}
                              onClick={() => setSelectedCellId(cell.id)}
                              className={`${borderWidth} relative transition-all ${opacityClass}`}
                              style={{
                                width: CELL_PIXEL_SIZE,
                                height: CELL_PIXEL_SIZE,
                                borderColor: isSelected ? '#7c3aed' : borderColor,
                                boxShadow: isSelected ? '0 0 0 2px #e9d5ff' : 'none',
                                zIndex: isSelected ? 10 : diff ? 5 : 1,
                                backgroundColor: bgColor,
                              }}
                            >
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span
                                  className={`text-xs font-medium ${
                                    diff?.status === 'new'
                                      ? 'text-green-800'
                                      : diff?.status === 'deepened'
                                      ? 'text-orange-800'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  {cell.code.replace(selectedTrench?.code || '', '')}
                                </span>
                                {layerB > 0 && (
                                  <span
                                    className={`text-xs font-semibold mt-0.5 ${
                                      diff?.status === 'new'
                                        ? 'text-green-700'
                                        : diff?.status === 'deepened'
                                        ? 'text-orange-700'
                                        : 'text-gray-600'
                                    }`}
                                  >
                                    {layerB}层
                                    {diff?.layerDelta && diff.layerDelta > 0 && (
                                      <span className="ml-0.5 text-[10px] font-bold">
                                        +{diff.layerDelta}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                              {diff?.status === 'new' && (
                                <div className="absolute -top-1 -left-1">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-[9px] font-bold">
                                    新
                                  </span>
                                </div>
                              )}
                              {diff?.status === 'deepened' && (
                                <div className="absolute -top-1 -left-1">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-600 text-white text-[9px] font-bold">
                                    ↑
                                  </span>
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
              <h3 className="text-sm font-medium text-gray-700 mb-3">图例 - 差异状态</h3>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded border-[3px] border-green-600 bg-green-100 flex items-center justify-center">
                    <span className="text-green-800 text-[10px] font-bold">新</span>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-green-700">新揭露方格</div>
                    <div className="text-xs text-gray-500">B 中首次揭露的方格</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded border-[3px] border-orange-600 bg-orange-100 flex items-center justify-center">
                    <span className="text-orange-800 text-[10px] font-bold">↑</span>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-orange-700">加深方格</div>
                    <div className="text-xs text-gray-500">揭露层数增加的方格</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded border-2 border-gray-300 bg-gray-100 opacity-50" />
                  <div>
                    <div className="text-xs font-medium text-gray-600">无变化</div>
                    <div className="text-xs text-gray-500">灰显 · 状态未变</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">方格对比详情</h3>
              {selectedCell ? (
                <div className="text-xs text-gray-600 space-y-2">
                  <p className="font-medium text-gray-800 text-sm border-b pb-2">
                    {selectedCell.code} · 行{selectedCell.row} 列{selectedCell.col}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 rounded-lg p-2.5 border border-green-200">
                      <div className="text-[10px] font-medium text-green-700 mb-1">快照 A</div>
                      <div className="space-y-0.5">
                        <div>
                          最深层:{' '}
                          <span className="font-semibold text-green-800">
                            {selectedStateA?.deepestLayerNumber || 0}
                          </span>
                        </div>
                        <div>
                          地层:{' '}
                          <span className="font-semibold">
                            {selectedStateA?.stratigraphyCount || 0}
                          </span>
                        </div>
                        <div>
                          遗迹:{' '}
                          <span className="font-semibold">
                            {selectedStateA?.featureIds.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2.5 border border-orange-200">
                      <div className="text-[10px] font-medium text-orange-700 mb-1">快照 B</div>
                      <div className="space-y-0.5">
                        <div>
                          最深层:{' '}
                          <span className="font-semibold text-orange-800">
                            {selectedStateB?.deepestLayerNumber || 0}
                          </span>
                        </div>
                        <div>
                          地层:{' '}
                          <span className="font-semibold">
                            {selectedStateB?.stratigraphyCount || 0}
                          </span>
                        </div>
                        <div>
                          遗迹:{' '}
                          <span className="font-semibold">
                            {selectedStateB?.featureIds.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedDiff && (
                    <div
                      className={`rounded-lg p-2.5 border ${
                        selectedDiff.status === 'new'
                          ? 'bg-green-50 border-green-200'
                          : selectedDiff.status === 'deepened'
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div
                        className={`text-[10px] font-medium mb-1 ${
                          selectedDiff.status === 'new'
                            ? 'text-green-700'
                            : selectedDiff.status === 'deepened'
                            ? 'text-orange-700'
                            : 'text-gray-600'
                        }`}
                      >
                        变化状态
                      </div>
                      <div className="space-y-0.5">
                        <div>
                          状态:{' '}
                          <span className="font-semibold">
                            {selectedDiff.status === 'new'
                              ? '新揭露'
                              : selectedDiff.status === 'deepened'
                              ? '加深揭露'
                              : '无变化'}
                          </span>
                        </div>
                        {selectedDiff.layerDelta !== 0 && (
                          <div>
                            层数变化:{' '}
                            <span className="font-semibold text-earth-700">
                              +{selectedDiff.layerDelta} 层
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">请选择一个方格查看对比详情</p>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-72 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                新揭露方格列表 ({compareResult.newlyExposedCells.length})
              </h3>
              {compareResult.newlyExposedCells.length === 0 ? (
                <p className="text-xs text-gray-400">无新增揭露方格</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {compareResult.newlyExposedCells.map((cellId) => {
                    const cell = cells.find((c) => c.id === cellId);
                    return (
                      <button
                        key={cellId}
                        onClick={() => setSelectedCellId(cellId)}
                        className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                          selectedCellId === cellId
                            ? 'bg-green-600 text-white'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {cell?.code.replace(selectedTrench?.code || '', '')}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  加深方格列表 ({compareResult.deepenedCells.length})
                </h3>
                {compareResult.deepenedCells.length === 0 ? (
                  <p className="text-xs text-gray-400">无加深揭露方格</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {compareResult.deepenedCells.map((cellId) => {
                      const cell = cells.find((c) => c.id === cellId);
                      const diff = compareResult.cellDifferences[cellId];
                      return (
                        <button
                          key={cellId}
                          onClick={() => setSelectedCellId(cellId)}
                          className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                            selectedCellId === cellId
                              ? 'bg-orange-600 text-white'
                              : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          }`}
                        >
                          {cell?.code.replace(selectedTrench?.code || '', '')}
                          {diff?.layerDelta ? ` +${diff.layerDelta}` : ''}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
