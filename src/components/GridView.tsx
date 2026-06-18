import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { SOIL_COLORS } from '../utils';

export default function GridView() {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const selectedCellId = useAppStore((state) => state.selectedCellId);
  const setSelectedCell = useAppStore((state) => state.setSelectedCell);
  const getCellsByTrench = useAppStore((state) => state.getCellsByTrench);
  const getStratigraphiesByCell = useAppStore((state) => state.getStratigraphiesByCell);
  const selectedTrench = useAppStore((state) =>
    state.trenches.find((t) => t.id === selectedTrenchId)
  );

  const cells = useMemo(
    () => (selectedTrenchId ? getCellsByTrench(selectedTrenchId) : []),
    [selectedTrenchId, getCellsByTrench]
  );

  const rows = selectedTrench?.rows || 0;
  const cols = selectedTrench?.cols || 0;

  const getCellColor = (cellId: string) => {
    const strats = getStratigraphiesByCell(cellId);
    if (strats.length === 0) return 'bg-white';
    
    const topStrat = strats[0];
    const color = SOIL_COLORS[topStrat.soilType] || '#e5e7eb';
    return `bg-[${color}]`;
  };

  const getCellStratCount = (cellId: string) => {
    return getStratigraphiesByCell(cellId).length;
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

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 overflow-auto">
        <div className="inline-block">
          <div className="flex mb-2">
            <div className="w-16" />
            {Array.from({ length: cols }, (_, i) => (
              <div
                key={i}
                className="w-16 h-8 flex items-center justify-center text-xs text-gray-500 font-medium"
              >
                E{i + 1}
              </div>
            ))}
          </div>

          {Array.from({ length: rows }, (_, rowIdx) => {
            const rowNum = rows - rowIdx;
            return (
              <div key={rowNum} className="flex">
                <div className="w-16 h-16 flex items-center justify-center text-xs text-gray-500 font-medium">
                  N{rowNum}
                </div>
                {Array.from({ length: cols }, (_, colIdx) => {
                  const colNum = colIdx + 1;
                  const cell = cells.find(
                    (c) => c.row === rowNum && c.col === colNum
                  );
                  if (!cell) return <div key={colNum} className="w-16 h-16" />;

                  const isSelected = cell.id === selectedCellId;
                  const stratCount = getCellStratCount(cell.id);
                  const strats = getStratigraphiesByCell(cell.id);

                  return (
                    <button
                      key={cell.id}
                      onClick={() => setSelectedCell(cell.id)}
                      className={`w-16 h-16 border-2 relative transition-all ${
                        isSelected
                          ? 'border-earth-600 ring-2 ring-earth-300 z-10'
                          : 'border-gray-300 hover:border-earth-400'
                      }`}
                      style={{
                        backgroundColor: strats.length > 0 
                          ? SOIL_COLORS[strats[0].soilType] + '40'
                          : undefined
                      }}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-xs font-medium ${
                          isSelected ? 'text-earth-700' : 'text-gray-600'
                        }`}>
                          {cell.code.replace(selectedTrench?.code || '', '')}
                        </span>
                        {stratCount > 0 && (
                          <span className="text-xs text-gray-500 mt-1">
                            {stratCount}层
                          </span>
                        )}
                      </div>
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
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
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
          <h3 className="text-sm font-medium text-gray-700 mb-2">操作说明</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• 点击方格进入地层记录界面</li>
            <li>• 方格颜色表示最上层土质</li>
            <li>• 底部色条显示该格所有地层</li>
            <li>• 数字表示已记录的地层数</li>
          </ul>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">坐标信息</h3>
          {selectedCellId ? (
            <div className="text-xs text-gray-600 space-y-1">
              <p>方格编号: {cells.find(c => c.id === selectedCellId)?.code}</p>
              <p>X范围: {cells.find(c => c.id === selectedCellId)?.xMin.toFixed(2)} - {cells.find(c => c.id === selectedCellId)?.xMax.toFixed(2)}m</p>
              <p>Y范围: {cells.find(c => c.id === selectedCellId)?.yMin.toFixed(2)} - {cells.find(c => c.id === selectedCellId)?.yMax.toFixed(2)}m</p>
              <p>中心: ({cells.find(c => c.id === selectedCellId)?.centerX.toFixed(2)}, {cells.find(c => c.id === selectedCellId)?.centerY.toFixed(2)})</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">请选择一个方格查看详情</p>
          )}
        </div>
      </div>
    </div>
  );
}
