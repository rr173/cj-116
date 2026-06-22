import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { usePermission } from '../hooks/usePermission';
import ArtifactsBatchImport from './ArtifactsBatchImport';
import ArtifactsAdvancedSearch, { FilterState } from './ArtifactsAdvancedSearch';
import ArtifactTypeManager from './ArtifactTypeManager';
import ArtifactStatistics from './ArtifactStatistics';
import { exportArtifactsToCSV, downloadCSV } from '../utils';
import {
  ARTIFACT_CATEGORIES,
  ArtifactCategory,
  CATEGORY_COLORS,
  ArtifactSubtype,
} from '../types';

const defaultFilters: FilterState = {
  types: [],
  materials: [],
  layerNumbers: [],
  cellIds: [],
  keyword: '',
};

type ViewMode = 'list' | 'statistics';

export default function ArtifactsPanel() {
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
  const subtypes = useAppStore((state) => state.artifactSubtypes);

  const addArtifact = useAppStore((state) => state.addArtifact);
  const updateArtifact = useAppStore((state) => state.updateArtifact);
  const deleteArtifact = useAppStore((state) => state.deleteArtifact);
  const matchArtifactSubtype = useAppStore((state) => state.matchArtifactSubtype);
  const getSubtypesByCategory = useAppStore((state) => state.getSubtypesByCategory);
  const autoAssignSubtypes = useAppStore((state) => state.autoAssignSubtypes);

  const { can, canEditArtifact, canDeleteArtifact } = usePermission();

  const autoAssignRan = useRef(false);
  useEffect(() => {
    if (!autoAssignRan.current && subtypes.length > 0 && artifacts.length > 0) {
      const unassigned = artifacts.filter(a => !a.subtypeId);
      if (unassigned.length > 0) {
        autoAssignSubtypes();
      }
      autoAssignRan.current = true;
    }
  }, [subtypes.length, artifacts.length]);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterUnit, setFilterUnit] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>(defaultFilters);

  const [formData, setFormData] = useState({
    cellId: '',
    stratigraphyId: '',
    unitId: '',
    catalogNumber: '',
    category: '陶器' as ArtifactCategory,
    subtypeId: '',
    type: '',
    material: '',
    description: '',
    dimensions: '',
    photoNumber: '',
    x: 0,
    y: 0,
    z: 0,
  });

  const hasAdvancedFilters =
    advancedFilters.types.length > 0 ||
    advancedFilters.materials.length > 0 ||
    advancedFilters.layerNumbers.length > 0 ||
    advancedFilters.cellIds.length > 0 ||
    advancedFilters.keyword.length > 0;

  const categorySubtypes = useMemo(
    () => getSubtypesByCategory(formData.category),
    [formData.category, getSubtypesByCategory]
  );

  const getSubtypeById = (id?: string): ArtifactSubtype | undefined => {
    if (!id) return undefined;
    return subtypes.find((s) => s.id === id);
  };

  const getCategoryOfSubtype = (subtypeId?: string): ArtifactCategory | undefined => {
    const subtype = getSubtypeById(subtypeId);
    return subtype?.category;
  };

  const filteredArtifacts = useMemo(() => {
    let result = [...artifacts];
    if (filterUnit) {
      result = result.filter((a) => a.unitId === filterUnit);
    }
    if (filterCategory) {
      if (filterCategory === '__unassigned__') {
        result = result.filter((a) => !a.subtypeId);
      } else {
        result = result.filter((a) => {
          const cat = getCategoryOfSubtype(a.subtypeId);
          return cat === filterCategory;
        });
      }
    }
    if (hasAdvancedFilters) {
      result = result.filter((a) => {
        if (advancedFilters.types.length > 0) {
          const subtype = getSubtypeById(a.subtypeId);
          const fullType = subtype ? `${subtype.category}${subtype.name}` : a.type;
          if (!advancedFilters.types.some((t) => fullType.includes(t) || a.type.includes(t))) return false;
        }
        if (advancedFilters.materials.length > 0 && !advancedFilters.materials.includes(a.material)) return false;
        if (advancedFilters.layerNumbers.length > 0) {
          if (!a.stratigraphyId) return false;
          const strat = stratigraphies.find((s) => s.id === a.stratigraphyId);
          if (!strat || !advancedFilters.layerNumbers.includes(strat.layerNumber)) return false;
        }
        if (advancedFilters.cellIds.length > 0 && !advancedFilters.cellIds.includes(a.cellId)) return false;
        if (advancedFilters.keyword) {
          const kw = advancedFilters.keyword.toLowerCase();
          const cell = cells.find((c) => c.id === a.cellId);
          const subtype = getSubtypeById(a.subtypeId);
          const searchText = [
            a.catalogNumber,
            a.type,
            subtype?.name || '',
            subtype?.category || '',
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
    }
    return result.sort((a, b) => a.catalogNumber.localeCompare(b.catalogNumber));
  }, [artifacts, filterUnit, filterCategory, advancedFilters, cells, hasAdvancedFilters, stratigraphies, subtypes]);

  const statsByCategory = useMemo(() => {
    const stats = new Map<ArtifactCategory | '__unassigned__', { count: number; units: Set<string> }>();
    ARTIFACT_CATEGORIES.forEach((c) => stats.set(c, { count: 0, units: new Set() }));
    stats.set('__unassigned__', { count: 0, units: new Set() });
    artifacts.forEach((a) => {
      const cat = getCategoryOfSubtype(a.subtypeId) || '__unassigned__';
      const s = stats.get(cat)!;
      s.count++;
      if (a.unitId) s.units.add(a.unitId);
    });
    return stats;
  }, [artifacts, subtypes]);

  const statsByUnit = useMemo(() => {
    const stats = new Map<string, { count: number; categories: Set<ArtifactCategory> }>();
    artifacts.forEach((a) => {
      const unitKey = a.unitId || '未分类';
      if (!stats.has(unitKey)) {
        stats.set(unitKey, { count: 0, categories: new Set() });
      }
      const s = stats.get(unitKey)!;
      s.count++;
      const cat = getCategoryOfSubtype(a.subtypeId);
      if (cat) s.categories.add(cat);
    });
    return stats;
  }, [artifacts, subtypes]);

  const getCellCode = (cellId: string) => {
    return cells.find((c) => c.id === cellId)?.code || '-';
  };

  const getUnitCode = (unitId?: string) => {
    if (!unitId) return '-';
    return units.find((u) => u.id === unitId)?.code || '-';
  };

  const getUnitColor = (unitId?: string) => {
    if (!unitId) return '#9ca3af';
    return units.find((u) => u.id === unitId)?.color || '#9ca3af';
  };

  const resetForm = () => {
    const firstSubtype = categorySubtypes[0];
    setFormData({
      cellId: cells[0]?.id || '',
      stratigraphyId: '',
      unitId: '',
      catalogNumber: `WP${artifacts.length + 1}`,
      category: '陶器',
      subtypeId: firstSubtype?.id || '',
      type: firstSubtype?.name || '',
      material: '',
      description: '',
      dimensions: '',
      photoNumber: '',
      x: cells[0]?.centerX || 0,
      y: cells[0]?.centerY || 0,
      z: 0,
    });
  };

  const handleAdd = () => {
    resetForm();
    setShowAddForm(true);
    setEditingId(null);
  };

  const handleEdit = (artifact: typeof artifacts[0]) => {
    const subtype = getSubtypeById(artifact.subtypeId);
    const category = subtype?.category || '陶器';
    const categoryTypes = getSubtypesByCategory(category);
    setFormData({
      cellId: artifact.cellId,
      stratigraphyId: artifact.stratigraphyId || '',
      unitId: artifact.unitId || '',
      catalogNumber: artifact.catalogNumber,
      category,
      subtypeId: artifact.subtypeId || categoryTypes[0]?.id || '',
      type: artifact.type,
      material: artifact.material,
      description: artifact.description,
      dimensions: artifact.dimensions,
      photoNumber: artifact.photoNumber,
      x: artifact.x,
      y: artifact.y,
      z: artifact.z,
    });
    setEditingId(artifact.id);
    setShowAddForm(true);
  };

  const handleCategoryChange = (cat: ArtifactCategory) => {
    const newSubtypes = getSubtypesByCategory(cat);
    const firstSubtype = newSubtypes[0];
    setFormData({
      ...formData,
      category: cat,
      subtypeId: firstSubtype?.id || '',
      type: firstSubtype?.name || formData.type,
    });
  };

  const handleSubtypeChange = (subtypeId: string) => {
    const subtype = subtypes.find((s) => s.id === subtypeId);
    setFormData({
      ...formData,
      subtypeId,
      type: subtype?.name || formData.type,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrenchId) return;

    let finalSubtypeId = formData.subtypeId;
    if (!finalSubtypeId && formData.type) {
      const matched = matchArtifactSubtype(formData.type);
      if (matched) finalSubtypeId = matched.id;
    }

    const submitData = {
      cellId: formData.cellId,
      stratigraphyId: formData.stratigraphyId || undefined,
      unitId: formData.unitId || undefined,
      catalogNumber: formData.catalogNumber,
      type: formData.type,
      subtypeId: finalSubtypeId || undefined,
      material: formData.material,
      description: formData.description,
      dimensions: formData.dimensions,
      photoNumber: formData.photoNumber,
      x: formData.x,
      y: formData.y,
      z: formData.z,
    };

    if (editingId) {
      updateArtifact(editingId, submitData);
    } else {
      addArtifact({
        ...submitData,
        trenchId: selectedTrenchId,
      });
    }

    setShowAddForm(false);
    setEditingId(null);
  };

  const handleCellChange = (cellId: string) => {
    const cellStrats = stratigraphies.filter((s) => s.cellId === cellId);
    setFormData({
      ...formData,
      cellId,
      stratigraphyId: cellStrats[0]?.id || '',
      unitId: cellStrats[0]?.unitId || '',
      x: cells.find((c) => c.id === cellId)?.centerX || 0,
      y: cells.find((c) => c.id === cellId)?.centerY || 0,
    });
  };

  const handleStratChange = (stratId: string) => {
    const strat = stratigraphies.find((s) => s.id === stratId);
    setFormData({
      ...formData,
      stratigraphyId: stratId,
      unitId: strat?.unitId || '',
      z: strat ? (strat.topElevation + strat.bottomElevation) / 2 : 0,
    });
  };

  const handleExportCSV = () => {
    const csv = exportArtifactsToCSV(filteredArtifacts, cells, units, stratigraphies, subtypes);
    const date = new Date().toISOString().slice(0, 10);
    const suffix = hasAdvancedFilters ? '筛选' : '全部';
    downloadCSV(csv, `遗物_${suffix}_${date}.csv`);
  };

  const activeFilterCount =
    (filterUnit ? 1 : 0) +
    (filterCategory ? 1 : 0) +
    (hasAdvancedFilters ? (
      advancedFilters.types.length +
      advancedFilters.materials.length +
      advancedFilters.layerNumbers.length +
      advancedFilters.cellIds.length +
      (advancedFilters.keyword ? 1 : 0)
    ) : 0);

  const displayType = (artifact: typeof artifacts[0]) => {
    const subtype = getSubtypeById(artifact.subtypeId);
    if (subtype) {
      return (
        <div className="flex flex-col">
          <span className="font-medium text-gray-700">
            {subtype.category} · {subtype.name}
          </span>
          {artifact.type && artifact.type !== subtype.name && (
            <span className="text-xs text-gray-400">原名: {artifact.type}</span>
          )}
        </div>
      );
    }
    return (
      <span className="text-orange-600">
        {artifact.type || '(待归类)'}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">遗物登记</h2>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-earth-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                列表
              </button>
              <button
                onClick={() => setViewMode('statistics')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'statistics'
                    ? 'bg-white text-earth-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                组合统计
              </button>
            </div>
          </div>
          {viewMode === 'list' && (
            <p className="text-sm text-gray-500 mt-1">
              共 {artifacts.length} 件遗物
              {filteredArtifacts.length !== artifacts.length && (
                <span className="ml-2 text-earth-600">
                  (筛选显示 {filteredArtifacts.length} 件
                  {activeFilterCount > 0 && `, ${activeFilterCount} 个筛选条件`})
                </span>
              )}
            </p>
          )}
        </div>

        {viewMode === 'list' && (
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            >
              <option value="">全部地层单位</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} - {u.name}
                </option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            >
              <option value="">全部分类</option>
              {ARTIFACT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__unassigned__">待归类</option>
            </select>
            <button
              onClick={() => setShowTypeManager(true)}
              className="px-4 py-2 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              分类管理
            </button>
            <button
              onClick={() => setShowAdvancedSearch(true)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                hasAdvancedFilters
                  ? 'bg-earth-100 text-earth-700 border border-earth-300 hover:bg-earth-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              高级检索
              {hasAdvancedFilters && (
                <span className="px-1.5 py-0.5 bg-earth-600 text-white text-xs rounded-full">
                  {advancedFilters.types.length + advancedFilters.materials.length + advancedFilters.layerNumbers.length + advancedFilters.cellIds.length + (advancedFilters.keyword ? 1 : 0)}
                </span>
              )}
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredArtifacts.length === 0}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              导出
            </button>
            <button
              onClick={() => setShowBatchImport(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              批量导入
            </button>
            <button
              onClick={handleAdd}
              disabled={!can('artifact:create')}
              className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              登记遗物
            </button>
          </div>
        )}
      </div>

      {viewMode === 'statistics' ? (
        <ArtifactStatistics />
      ) : (
        <>
          {hasAdvancedFilters && (
            <div className="mb-3 p-3 bg-earth-50 border border-earth-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-earth-700 font-medium">已激活筛选:</span>
                {advancedFilters.keyword && (
                  <span className="px-2 py-0.5 bg-white border border-earth-300 rounded text-earth-700">
                    关键词: {advancedFilters.keyword}
                  </span>
                )}
                {advancedFilters.types.length > 0 && (
                  <span className="px-2 py-0.5 bg-white border border-earth-300 rounded text-earth-700">
                    类型 ×{advancedFilters.types.length}
                  </span>
                )}
                {advancedFilters.materials.length > 0 && (
                  <span className="px-2 py-0.5 bg-white border border-earth-300 rounded text-earth-700">
                    材质 ×{advancedFilters.materials.length}
                  </span>
                )}
                {advancedFilters.layerNumbers.length > 0 && (
                  <span className="px-2 py-0.5 bg-white border border-earth-300 rounded text-earth-700">
                    层位 ×{advancedFilters.layerNumbers.length}
                  </span>
                )}
                {advancedFilters.cellIds.length > 0 && (
                  <span className="px-2 py-0.5 bg-white border border-earth-300 rounded text-earth-700">
                    方格 ×{advancedFilters.cellIds.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setAdvancedFilters(defaultFilters)}
                className="text-sm text-earth-700 hover:text-earth-800"
              >
                清除全部
              </button>
            </div>
          )}

          <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
            <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="font-medium text-gray-700">遗物列表</h3>
                {filteredArtifacts.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {filteredArtifacts.length} 条记录
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {filteredArtifacts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p>{hasAdvancedFilters || filterUnit || filterCategory ? '没有符合筛选条件的遗物' : '暂无遗物记录'}</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">编号</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">类型学分类</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">材质</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">出土地层</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">出土方格</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">坐标</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-600">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredArtifacts.map((artifact) => {
                        const subtype = getSubtypeById(artifact.subtypeId);
                        const cat = subtype?.category;
                        return (
                          <tr key={artifact.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {artifact.catalogNumber}
                            </td>
                            <td className="px-4 py-3">
                              {cat ? (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                                  />
                                  {displayType(artifact)}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 bg-orange-200 border border-dashed border-orange-400" />
                                  {displayType(artifact)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {artifact.material || <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="px-2 py-0.5 text-xs text-white rounded-full"
                                style={{ backgroundColor: getUnitColor(artifact.unitId) }}
                              >
                                {getUnitCode(artifact.unitId)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {getCellCode(artifact.cellId)}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              ({artifact.x.toFixed(2)}, {artifact.y.toFixed(2)}, {artifact.z.toFixed(2)})
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleEdit(artifact)}
                                disabled={!canEditArtifact(artifact.id)}
                                className="text-blue-600 hover:text-blue-700 mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('确定删除这件遗物吗？')) {
                                    deleteArtifact(artifact.id);
                                  }
                                }}
                                disabled={!canDeleteArtifact(artifact.id)}
                                className="text-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                删除
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-medium text-gray-700">按大类统计</h3>
                </div>
                <div className="p-4 space-y-2">
                  {ARTIFACT_CATEGORIES.map((cat) => {
                    const data = statsByCategory.get(cat);
                    return (
                      <div key={cat} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                          />
                          <span className="text-gray-600">{cat}</span>
                        </div>
                        <span className="font-medium text-gray-800">{data?.count || 0} 件</span>
                      </div>
                    );
                  })}
                  {statsByCategory.get('__unassigned__')!.count > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 mt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-orange-200 border border-dashed border-orange-400" />
                        <span className="text-orange-600">待归类</span>
                      </div>
                      <span className="font-medium text-orange-700">
                        {statsByCategory.get('__unassigned__')!.count} 件
                      </span>
                    </div>
                  )}
                  {subtypes.length === 0 && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                      尚未配置器型分类，请先点击「分类管理」配置
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-medium text-gray-700">按地层统计</h3>
                </div>
                <div className="p-4 space-y-2">
                  {Array.from(statsByUnit.entries()).map(([unitId, data]) => {
                    const unit = units.find((u) => u.id === unitId);
                    return (
                      <div key={unitId} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: unit?.color || '#9ca3af' }}
                          />
                          <span className="text-gray-600">
                            {unit ? unit.code : '未分类'}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800">{data.count} 件</span>
                      </div>
                    );
                  })}
                  {statsByUnit.size === 0 && (
                    <p className="text-sm text-gray-400 text-center">暂无数据</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? '编辑遗物' : '登记遗物'}
              </h3>
              <button
                onClick={() => { setShowAddForm(false); setEditingId(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    标本编号
                  </label>
                  <input
                    type="text"
                    value={formData.catalogNumber}
                    onChange={(e) => setFormData({ ...formData, catalogNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    照片编号
                  </label>
                  <input
                    type="text"
                    value={formData.photoNumber}
                    onChange={(e) => setFormData({ ...formData, photoNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    大类
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value as ArtifactCategory)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    {ARTIFACT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        <span className="inline-block w-3 h-3 mr-2" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    器型
                  </label>
                  <select
                    value={formData.subtypeId}
                    onChange={(e) => handleSubtypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    <option value="">(待归类)</option>
                    {categorySubtypes.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {categorySubtypes.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      此类尚无器型，请在「分类管理」中添加
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    原类型文字（可选）
                  </label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="用于保留原始记录，未选器型时尝试自动匹配"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    材质
                  </label>
                  <input
                    type="text"
                    value={formData.material}
                    onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                    placeholder="如: 泥质陶、夹砂陶、青铜..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    出土方格
                  </label>
                  <select
                    value={formData.cellId}
                    onChange={(e) => handleCellChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  >
                    <option value="">请选择</option>
                    {cells.map((c) => (
                      <option key={c.id} value={c.id}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    出土层位
                  </label>
                  <select
                    value={formData.stratigraphyId}
                    onChange={(e) => handleStratChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    <option value="">请选择</option>
                    {stratigraphies
                      .filter((s) => s.cellId === formData.cellId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          第{s.layerNumber}层 ({s.soilType})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    地层单位
                  </label>
                  <select
                    value={formData.unitId}
                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    <option value="">未分类</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    X坐标 (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.x}
                    onChange={(e) => setFormData({ ...formData, x: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Y坐标 (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.y}
                    onChange={(e) => setFormData({ ...formData, y: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Z标高 (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.z}
                    onChange={(e) => setFormData({ ...formData, z: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  尺寸描述
                </label>
                <input
                  type="text"
                  value={formData.dimensions}
                  onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  placeholder="长×宽×高..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  rows={3}
                  placeholder="遗物描述..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingId(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors"
                >
                  {editingId ? '保存' : '登记'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBatchImport && (
        <ArtifactsBatchImport onClose={() => setShowBatchImport(false)} />
      )}

      {showAdvancedSearch && (
        <ArtifactsAdvancedSearch
          filters={advancedFilters}
          onFiltersChange={setAdvancedFilters}
          onClose={() => setShowAdvancedSearch(false)}
        />
      )}

      {showTypeManager && (
        <ArtifactTypeManager onClose={() => setShowTypeManager(false)} />
      )}
    </div>
  );
}
