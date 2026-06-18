import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { calculateThickness, SOIL_COLORS } from '../utils';
import { SoilType } from '../types';

const SOIL_TYPES: SoilType[] = ['粘土', '砂土', '砾石', '粉土', '壤土', '有机质土', '生土', '其他'];

export default function StratigraphyPanel() {
  const selectedCellId = useAppStore((state) => state.selectedCellId);
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const getCellById = useAppStore((state) => state.getCellById);
  const addStratigraphy = useAppStore((state) => state.addStratigraphy);
  const updateStratigraphy = useAppStore((state) => state.updateStratigraphy);
  const deleteStratigraphy = useAppStore((state) => state.deleteStratigraphy);
  const stratigraphiesData = useAppStore((state) => state.stratigraphies);
  const units = useAppStore((state) => state.units.filter(u => u.trenchId === selectedTrenchId));
  const assignStratigraphyToUnit = useAppStore((state) => state.assignStratigraphyToUnit);
  const unassignStratigraphyFromUnit = useAppStore((state) => state.unassignStratigraphyFromUnit);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cell = getCellById(selectedCellId || '');
  const stratigraphies = useMemo(
    () => (selectedCellId 
      ? stratigraphiesData
          .filter((s) => s.cellId === selectedCellId)
          .sort((a, b) => b.topElevation - a.topElevation)
      : []
    ),
    [selectedCellId, stratigraphiesData]
  );

  const [formData, setFormData] = useState({
    layerNumber: 1,
    topElevation: 0,
    bottomElevation: 0,
    soilType: '粘土' as SoilType,
    munsellColor: '10YR5/3',
    description: '',
    inclusions: '',
  });

  const resetForm = () => {
    const nextLayer = stratigraphies.length + 1;
    const prevBottom = stratigraphies.length > 0 
      ? stratigraphies[stratigraphies.length - 1].bottomElevation 
      : 0;
    setFormData({
      layerNumber: nextLayer,
      topElevation: prevBottom,
      bottomElevation: prevBottom - 0.5,
      soilType: '粘土',
      munsellColor: '10YR5/3',
      description: '',
      inclusions: '',
    });
    setError(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowAddForm(true);
    setEditingId(null);
  };

  const handleEdit = (strat: typeof stratigraphies[0]) => {
    setFormData({
      layerNumber: strat.layerNumber,
      topElevation: strat.topElevation,
      bottomElevation: strat.bottomElevation,
      soilType: strat.soilType,
      munsellColor: strat.munsellColor,
      description: strat.description,
      inclusions: strat.inclusions,
    });
    setEditingId(strat.id);
    setShowAddForm(true);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCellId || !selectedTrenchId) return;

    if (formData.topElevation <= formData.bottomElevation) {
      setError('顶面标高必须大于底面标高');
      return;
    }

    if (editingId) {
      updateStratigraphy(editingId, formData);
    } else {
      const result = addStratigraphy({
        ...formData,
        cellId: selectedCellId,
        trenchId: selectedTrenchId,
      });
      if (!result) {
        setError('标高与现有地层交叉，请检查标高设置');
        return;
      }
    }

    setShowAddForm(false);
    setEditingId(null);
    setError(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条地层记录吗？')) {
      deleteStratigraphy(id);
    }
  };

  const getUnitForStrat = (unitId?: string) => {
    if (!unitId) return null;
    return units.find(u => u.id === unitId);
  };

  if (!cell) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <p>请先在方格网视图中选择一个方格</p>
        </div>
      </div>
    );
  }

  const thickness = calculateThickness(formData.topElevation, formData.bottomElevation);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            地层记录 - {cell.code}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            行{cell.row} 列{cell.col} · 坐标: ({cell.centerX.toFixed(2)}, {cell.centerY.toFixed(2)})
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加地层
        </button>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-700">地层列表</h3>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {stratigraphies.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-sm">暂无地层记录</p>
                  <p className="text-xs mt-1">点击"添加地层"开始记录</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {stratigraphies.map((strat, index) => {
                  const unit = getUnitForStrat(strat.unitId);
                  const stratThickness = calculateThickness(strat.topElevation, strat.bottomElevation);
                  return (
                    <div
                      key={strat.id}
                      className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div
                        className="h-12 flex items-center justify-between px-4"
                        style={{ backgroundColor: SOIL_COLORS[strat.soilType] + '30' }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-sm font-bold text-gray-700">
                            {strat.layerNumber}
                          </span>
                          <div>
                            <div className="font-medium text-gray-800">
                              第 {strat.layerNumber} 层 · {strat.soilType}
                            </div>
                            <div className="text-xs text-gray-500">
                              {strat.munsellColor} · 厚度 {stratThickness.toFixed(2)}m
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {unit && (
                            <span
                              className="px-2 py-0.5 text-xs text-white rounded-full"
                              style={{ backgroundColor: unit.color }}
                            >
                              {unit.code}
                            </span>
                          )}
                          <button
                            onClick={() => handleEdit(strat)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(strat.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-white grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">顶面标高:</span>
                          <span className="ml-2 font-medium">{strat.topElevation.toFixed(2)}m</span>
                        </div>
                        <div>
                          <span className="text-gray-500">底面标高:</span>
                          <span className="ml-2 font-medium">{strat.bottomElevation.toFixed(2)}m</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">描述:</span>
                          <span className="ml-2 text-gray-700">{strat.description || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">包含物:</span>
                          <span className="ml-2 text-gray-700">{strat.inclusions || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">地层单位:</span>
                          <select
                            value={strat.unitId || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                assignStratigraphyToUnit(strat.id, e.target.value);
                              } else {
                                unassignStratigraphyFromUnit(strat.id);
                              }
                            }}
                            className="ml-2 text-sm border border-gray-300 rounded px-2 py-0.5"
                          >
                            <option value="">未关联</option>
                            {units.map(u => (
                              <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-700">地层柱状图</h3>
          </div>
          <div className="flex-1 p-4 flex justify-center">
            <div className="w-32 relative h-full border-l-2 border-b-2 border-gray-400">
              {stratigraphies.length > 0 && (
                <>
                  <div className="absolute -top-1 -left-8 text-xs text-gray-500">
                    {stratigraphies[0].topElevation.toFixed(1)}m
                  </div>
                  {stratigraphies.map((strat, idx) => {
                    const totalHeight = stratigraphies.reduce(
                      (sum, s) => sum + calculateThickness(s.topElevation, s.bottomElevation),
                      0
                    );
                    const heightPercent = (calculateThickness(strat.topElevation, strat.bottomElevation) / totalHeight) * 100;
                    const topPercent = stratigraphies
                      .slice(0, idx)
                      .reduce((sum, s) => sum + calculateThickness(s.topElevation, s.bottomElevation), 0) / totalHeight * 100;

                    return (
                      <div
                        key={strat.id}
                        className="absolute left-0 right-0 flex items-center justify-center"
                        style={{
                          top: `${topPercent}%`,
                          height: `${heightPercent}%`,
                          backgroundColor: SOIL_COLORS[strat.soilType] || '#ccc',
                        }}
                      >
                        <span className="text-white text-xs font-bold drop-shadow">
                          {strat.layerNumber}
                        </span>
                      </div>
                    );
                  })}
                  <div className="absolute -bottom-1 -left-8 text-xs text-gray-500">
                    {stratigraphies[stratigraphies.length - 1].bottomElevation.toFixed(1)}m
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? '编辑地层' : '添加地层'}
              </h3>
              <button
                onClick={() => { setShowAddForm(false); setEditingId(null); setError(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    层号
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.layerNumber}
                    onChange={(e) => setFormData({ ...formData, layerNumber: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    顶面标高(m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.topElevation}
                    onChange={(e) => setFormData({ ...formData, topElevation: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    底面标高(m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.bottomElevation}
                    onChange={(e) => setFormData({ ...formData, bottomElevation: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    土质
                  </label>
                  <select
                    value={formData.soilType}
                    onChange={(e) => setFormData({ ...formData, soilType: e.target.value as SoilType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    {SOIL_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    土色 (Munsell)
                  </label>
                  <input
                    type="text"
                    value={formData.munsellColor}
                    onChange={(e) => setFormData({ ...formData, munsellColor: e.target.value })}
                    placeholder="如 10YR5/3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  厚度: <span className="font-normal text-earth-600">{thickness.toFixed(2)} m</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="地层描述..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  包含物
                </label>
                <textarea
                  value={formData.inclusions}
                  onChange={(e) => setFormData({ ...formData, inclusions: e.target.value })}
                  placeholder="陶片、石器、骨骼等..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingId(null); setError(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors"
                >
                  {editingId ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
