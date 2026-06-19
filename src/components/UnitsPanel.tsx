import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSampleStore } from '../store/useSampleStore';
import { checkElevationContinuity } from '../utils';
import { RelationType } from '../types';

export default function UnitsPanel() {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const units = useAppStore((state) =>
    state.units.filter((u) => u.trenchId === selectedTrenchId)
  );
  const stratigraphies = useAppStore((state) =>
    state.stratigraphies.filter((s) => s.trenchId === selectedTrenchId)
  );
  const relations = useAppStore((state) =>
    state.relations.filter((r) => r.trenchId === selectedTrenchId)
  );
  const cells = useAppStore((state) =>
    state.cells.filter((c) => c.trenchId === selectedTrenchId)
  );
  const samples = useSampleStore((state) =>
    state.samples.filter((s) => s.trenchId === selectedTrenchId)
  );

  const createUnit = useAppStore((state) => state.createUnit);
  const deleteUnit = useAppStore((state) => state.deleteUnit);
  const updateUnit = useAppStore((state) => state.updateUnit);
  const addRelation = useAppStore((state) => state.addRelation);
  const deleteRelation = useAppStore((state) => state.deleteRelation);
  const assignStratigraphyToUnit = useAppStore((state) => state.assignStratigraphyToUnit);
  const unassignStratigraphyFromUnit = useAppStore((state) => state.unassignStratigraphyFromUnit);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [showRelationForm, setShowRelationForm] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const [unitForm, setUnitForm] = useState({
    code: '',
    name: '',
    description: '',
  });

  const [relationForm, setRelationForm] = useState({
    fromUnitId: '',
    toUnitId: '',
    type: '叠压' as RelationType,
    description: '',
  });

  const handleCreateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrenchId) return;
    createUnit({ ...unitForm, trenchId: selectedTrenchId });
    setUnitForm({ code: '', name: '', description: '' });
    setShowCreateForm(false);
  };

  const handleAddRelation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrenchId) return;
    if (!relationForm.fromUnitId || !relationForm.toUnitId) return;
    
    addRelation({
      trenchId: selectedTrenchId,
      ...relationForm,
    });
    setRelationForm({ fromUnitId: '', toUnitId: '', type: '叠压', description: '' });
    setShowRelationForm(false);
  };

  const unassignedStrats = useMemo(
    () => stratigraphies.filter((s) => !s.unitId),
    [stratigraphies]
  );

  const getStratsForUnit = (unitId: string) => {
    return stratigraphies.filter((s) => s.unitId === unitId);
  };

  const getCellCode = (cellId: string) => {
    return cells.find((c) => c.id === cellId)?.code || '-';
  };

  const getSamplesForUnit = (unitId: string) => {
    return samples.filter((s) => s.unitId === unitId);
  };

  const handleAssignStrat = (stratId: string, unitId: string) => {
    const strat = stratigraphies.find((s) => s.id === stratId);
    if (!strat) return;

    const unitStrats = getStratsForUnit(unitId);
    if (unitStrats.length > 0) {
      const avgTop = unitStrats.reduce((sum, s) => sum + s.topElevation, 0) / unitStrats.length;
      const avgBottom = unitStrats.reduce((sum, s) => sum + s.bottomElevation, 0) / unitStrats.length;
      
      const topDiff = Math.abs(strat.topElevation - avgTop);
      const bottomDiff = Math.abs(strat.bottomElevation - avgBottom);
      
      if (topDiff > 0.3 || bottomDiff > 0.3) {
        if (!confirm(`标高差异较大 (顶: ${topDiff.toFixed(2)}m, 底: ${bottomDiff.toFixed(2)}m)，是否仍要关联？`)) {
          return;
        }
      }
    }

    assignStratigraphyToUnit(stratId, unitId);
  };

  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">地层单位管理</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {units.length} 个地层单位，{stratigraphies.length} 条地层记录
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRelationForm(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            添加关系
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建地层单位
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-700">地层单位列表</h3>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {units.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                暂无地层单位
              </div>
            ) : (
              <div className="space-y-2">
                {units.map((unit) => {
                  const strats = getStratsForUnit(unit.id);
                  return (
                    <div
                      key={unit.id}
                      onClick={() => setSelectedUnitId(unit.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedUnitId === unit.id
                          ? 'border-earth-500 bg-earth-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: unit.color }}
                        />
                        <span className="font-medium text-gray-800">{unit.code}</span>
                        <span className="text-sm text-gray-500">{unit.name}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {strats.length} 个方格记录
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="font-medium text-gray-700">
              {selectedUnit ? `${selectedUnit.code} - ${selectedUnit.name}` : '单位详情'}
            </h3>
            {selectedUnit && (
              <button
                onClick={() => {
                  if (confirm('确定删除这个地层单位吗？')) {
                    deleteUnit(selectedUnit.id);
                    setSelectedUnitId(null);
                  }
                }}
                className="text-red-500 hover:text-red-600 text-sm"
              >
                删除
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {selectedUnit ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">描述</label>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedUnit.description || '暂无描述'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">包含的地层</label>
                    <span className="text-xs text-gray-500">
                      {getStratsForUnit(selectedUnit.id).length} 条记录
                    </span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {getStratsForUnit(selectedUnit.id).map((strat) => (
                      <div
                        key={strat.id}
                        className="p-2 bg-gray-50 rounded-lg text-sm flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-gray-700">
                            {getCellCode(strat.cellId)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {strat.topElevation.toFixed(2)} - {strat.bottomElevation.toFixed(2)}m
                          </div>
                        </div>
                        <button
                          onClick={() => unassignStratigraphyFromUnit(strat.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">关联样品检测结果</label>
                    <span className="text-xs text-gray-500">
                      {getSamplesForUnit(selectedUnit.id).length} 个样品
                    </span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {getSamplesForUnit(selectedUnit.id).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">暂无关联样品</p>
                    ) : (
                      getSamplesForUnit(selectedUnit.id).map((sample) => (
                        <div
                          key={sample.id}
                          className="p-2 bg-gray-50 rounded-lg text-sm"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-700">
                              {sample.sampleNumber}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {sample.type}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mb-1">
                            状态: {sample.status} · 采集人: {sample.collector}
                            {sample.laboratory && ` · 实验室: ${sample.laboratory}`}
                          </div>
                          {sample.result ? (
                            <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                              <div className="text-xs font-medium text-green-700 mb-1">检测结果</div>
                              {Object.entries(sample.result.values).length > 0 && (
                                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 mb-1">
                                  {Object.entries(sample.result.values).map(([k, v]) => (
                                    <div key={k}>
                                      <span className="text-gray-500">{k}:</span>
                                      <span className="ml-1 font-medium text-gray-700">{v}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {sample.result.description && (
                                <p className="text-xs text-gray-600">
                                  {sample.result.description}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-orange-600">
                              暂无检测结果
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                选择一个地层单位查看详情
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-700">未关联地层</h3>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {unassignedStrats.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                所有地层都已关联
              </div>
            ) : (
              <div className="space-y-2">
                {unassignedStrats.map((strat) => (
                  <div
                    key={strat.id}
                    className="p-2 bg-gray-50 rounded-lg text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">
                        {getCellCode(strat.cellId)} · 第{strat.layerNumber}层
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {strat.soilType} · {strat.topElevation.toFixed(2)} - {strat.bottomElevation.toFixed(2)}m
                    </div>
                    {selectedUnitId && (
                      <button
                        onClick={() => handleAssignStrat(strat.id, selectedUnitId)}
                        className="mt-2 w-full py-1 text-xs text-earth-600 bg-earth-50 hover:bg-earth-100 rounded transition-colors"
                      >
                        关联到 {selectedUnit?.code}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="font-medium text-gray-700 mb-3">地层关系列表</h3>
        {relations.length === 0 ? (
          <p className="text-sm text-gray-400">暂无地层关系记录</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {relations.map((rel) => {
              const fromUnit = units.find((u) => u.id === rel.fromUnitId);
              const toUnit = units.find((u) => u.id === rel.toUnitId);
              return (
                <div
                  key={rel.id}
                  className="p-2 bg-gray-50 rounded-lg text-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-1">
                    <span style={{ color: fromUnit?.color }} className="font-medium">
                      {fromUnit?.code}
                    </span>
                    <span className="text-gray-400">
                      {rel.type === '叠压' ? '→' : rel.type === '打破' ? '⤓' : '⤒'}
                    </span>
                    <span style={{ color: toUnit?.color }} className="font-medium">
                      {toUnit?.code}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">{rel.type}</span>
                  </div>
                  <button
                    onClick={() => deleteRelation(rel.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">新建地层单位</h3>
            </div>
            <form onSubmit={handleCreateUnit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  单位编号
                </label>
                <input
                  type="text"
                  value={unitForm.code}
                  onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value })}
                  placeholder="如 ③ 或 H1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名称
                </label>
                <input
                  type="text"
                  value={unitForm.name}
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                  placeholder="如 汉代文化层"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={unitForm.description}
                  onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRelationForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">添加地层关系</h3>
            </div>
            <form onSubmit={handleAddRelation} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    上层/打破者
                  </label>
                  <select
                    value={relationForm.fromUnitId}
                    onChange={(e) => setRelationForm({ ...relationForm, fromUnitId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  >
                    <option value="">请选择</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} - {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    下层/被打破者
                  </label>
                  <select
                    value={relationForm.toUnitId}
                    onChange={(e) => setRelationForm({ ...relationForm, toUnitId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  >
                    <option value="">请选择</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} - {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  关系类型
                </label>
                <select
                  value={relationForm.type}
                  onChange={(e) => setRelationForm({ ...relationForm, type: e.target.value as RelationType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                >
                  <option value="叠压">叠压 (A覆盖在B上面)</option>
                  <option value="打破">打破 (A挖穿了B)</option>
                  <option value="被打破">被打破 (B被A挖穿)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={relationForm.description}
                  onChange={(e) => setRelationForm({ ...relationForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  rows={2}
                  placeholder="关系说明..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRelationForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors"
                >
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
