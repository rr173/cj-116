import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Artifact } from '../types';
import { exportArtifactsToCSV, downloadCSV } from '../utils';

const ARTIFACT_TYPES = [
  '陶片', '石器', '骨器', '蚌器', '玉器', '青铜器', '铁器', '瓷片', '动物骨骼', '植物遗存', '其他'
];

const MATERIALS = [
  '泥质陶', '夹砂陶', '彩陶', '灰陶', '红陶', '黑陶',
  '石器', '骨器', '蚌器', '玉质', '青铜', '铁', '瓷', '其他'
];

interface FilterState {
  types: string[];
  materials: string[];
  layerNumbers: number[];
  cellIds: string[];
  keyword: string;
}

interface Props {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClose: () => void;
}

export default function ArtifactsAdvancedSearch({ filters, onFiltersChange, onClose }: Props) {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const cells = useAppStore((state) =>
    state.cells.filter((c) => c.trenchId === selectedTrenchId)
  );
  const stratigraphies = useAppStore((state) =>
    state.stratigraphies.filter((s) => s.trenchId === selectedTrenchId)
  );
  const units = useAppStore((state) =>
    state.units.filter((u) => u.trenchId === selectedTrenchId)
  );
  const artifacts = useAppStore((state) =>
    state.artifacts.filter((a) => a.trenchId === selectedTrenchId)
  );

  const availableLayerNumbers = useMemo(() => {
    const nums = new Set<number>();
    stratigraphies.forEach((s) => nums.add(s.layerNumber));
    return Array.from(nums).sort((a, b) => a - b);
  }, [stratigraphies]);

  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((a: Artifact) => {
      if (filters.types.length > 0 && !filters.types.includes(a.type)) return false;
      if (filters.materials.length > 0 && !filters.materials.includes(a.material)) return false;
      if (filters.layerNumbers.length > 0) {
        if (!a.stratigraphyId) return false;
        const strat = stratigraphies.find((s) => s.id === a.stratigraphyId);
        if (!strat || !filters.layerNumbers.includes(strat.layerNumber)) return false;
      }
      if (filters.cellIds.length > 0 && !filters.cellIds.includes(a.cellId)) return false;
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        const cell = cells.find((c) => c.id === a.cellId);
        const searchText = [
          a.catalogNumber,
          a.type,
          a.material,
          a.description,
          a.dimensions,
          a.photoNumber,
          cell?.code || '',
        ].join(' ').toLowerCase();
        if (!searchText.includes(kw)) return false;
      }
      return true;
    });
  }, [artifacts, filters, cells, stratigraphies]);

  const toggleItem = (arr: string[], item: string): string[] => {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
  };

  const toggleLayerNumber = (arr: number[], item: number): number[] => {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
  };

  const activeCount = 
    filters.types.length + 
    filters.materials.length + 
    filters.layerNumbers.length + 
    filters.cellIds.length + 
    (filters.keyword ? 1 : 0);

  const handleExport = () => {
    const csv = exportArtifactsToCSV(filteredArtifacts, cells, units, stratigraphies);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `遗物_筛选结果_${date}.csv`);
  };

  const handleReset = () => {
    onFiltersChange({
      types: [],
      materials: [],
      layerNumbers: [],
      cellIds: [],
      keyword: '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-800">高级检索</h3>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 bg-earth-100 text-earth-700 text-xs rounded-full">
                {activeCount} 个筛选条件
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">关键词搜索</label>
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => onFiltersChange({ ...filters, keyword: e.target.value })}
              placeholder="搜索编号、类型、材质、描述..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              遗物类型 {filters.types.length > 0 && <span className="text-earth-600 text-xs">({filters.types.length}项已选)</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {ARTIFACT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => onFiltersChange({ ...filters, types: toggleItem(filters.types, t) })}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    filters.types.includes(t)
                      ? 'bg-earth-600 text-white border-earth-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-earth-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              材质 {filters.materials.length > 0 && <span className="text-earth-600 text-xs">({filters.materials.length}项已选)</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {MATERIALS.map((m) => (
                <button
                  key={m}
                  onClick={() => onFiltersChange({ ...filters, materials: toggleItem(filters.materials, m) })}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    filters.materials.includes(m)
                      ? 'bg-earth-600 text-white border-earth-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-earth-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              出土层位 {filters.layerNumbers.length > 0 && <span className="text-earth-600 text-xs">({filters.layerNumbers.length}项已选)</span>}
            </label>
            {availableLayerNumbers.length === 0 ? (
              <p className="text-sm text-gray-400">暂未录入地层信息</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableLayerNumbers.map((n) => (
                  <button
                    key={n}
                    onClick={() => onFiltersChange({ ...filters, layerNumbers: toggleLayerNumber(filters.layerNumbers, n) })}
                    className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${
                      filters.layerNumbers.includes(n)
                        ? 'bg-earth-600 text-white border-earth-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-earth-400'
                    }`}
                  >
                    第{n}层
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              出土方格 {filters.cellIds.length > 0 && <span className="text-earth-600 text-xs">({filters.cellIds.length}项已选)</span>}
            </label>
            {cells.length === 0 ? (
              <p className="text-sm text-gray-400">暂无方格数据</p>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                <div className="flex flex-wrap gap-2">
                  {cells.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onFiltersChange({ ...filters, cellIds: toggleItem(filters.cellIds, c.id) })}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors font-mono ${
                        filters.cellIds.includes(c.id)
                          ? 'bg-earth-600 text-white border-earth-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-earth-400'
                      }`}
                    >
                      {c.code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                筛选结果: <span className="font-semibold text-gray-800">{filteredArtifacts.length}</span> 件遗物
              </span>
              <button
                onClick={handleExport}
                disabled={filteredArtifacts.length === 0}
                className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors text-sm flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                导出 CSV
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            重置筛选
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-6 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors"
          >
            应用筛选
          </button>
        </div>
      </div>
    </div>
  );
}

export type { FilterState };
