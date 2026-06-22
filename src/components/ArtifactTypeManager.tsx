import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { usePermission } from '../hooks/usePermission';
import {
  ARTIFACT_CATEGORIES,
  ArtifactCategory,
  CATEGORY_COLORS,
  ArtifactSubtype,
} from '../types';

interface ArtifactTypeManagerProps {
  onClose: () => void;
}

const DEFAULT_SUBTYPES: Record<ArtifactCategory, string[]> = {
  陶器: ['罐', '盆', '碗', '豆', '鬲', '鼎', '壶', '瓮', '杯', '尊', '纺轮', '陶片'],
  石器: ['斧', '锛', '凿', '刀', '铲', '镞', '矛', '磨盘', '磨棒', '石片', '石核'],
  骨器: ['锥', '针', '笄', '镞', '铲', '匕', '鱼钩', '骨片'],
  铜器: ['鼎', '鬲', '爵', '斝', '觚', '戈', '矛', '镞', '刀', '斧', '镜', '铃'],
  铁器: ['锄', '铲', '斧', '刀', '剑', '镞', '钉', '环'],
  玉器: ['璧', '琮', '圭', '璋', '璜', '玦', '珠', '管', '佩', '坠'],
  其他: ['蚌器', '贝饰', '角器', '牙器', '动物骨骼', '植物遗存', '不明'],
};

export default function ArtifactTypeManager({ onClose }: ArtifactTypeManagerProps) {
  const { can, isAdmin } = usePermission();
  const canManage = isAdmin;

  const subtypes = useAppStore((state) => state.artifactSubtypes);
  const addArtifactSubtype = useAppStore((state) => state.addArtifactSubtype);
  const updateArtifactSubtype = useAppStore((state) => state.updateArtifactSubtype);
  const deleteArtifactSubtype = useAppStore((state) => state.deleteArtifactSubtype);
  const autoAssignSubtypes = useAppStore((state) => state.autoAssignSubtypes);
  const artifacts = useAppStore((state) => state.artifacts);

  const [selectedCategory, setSelectedCategory] = useState<ArtifactCategory>('陶器');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSubtype, setEditingSubtype] = useState<ArtifactSubtype | null>(null);
  const [newCategory, setNewCategory] = useState<ArtifactCategory>('陶器');
  const [newName, setNewName] = useState('');
  const [newAliases, setNewAliases] = useState('');
  const [autoAssignResult, setAutoAssignResult] = useState<string | null>(null);

  const subtypesByCategory = useMemo(() => {
    const map = new Map<ArtifactCategory, ArtifactSubtype[]>();
    ARTIFACT_CATEGORIES.forEach((c) => map.set(c, []));
    subtypes.forEach((s) => {
      map.get(s.category)?.push(s);
    });
    map.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')));
    return map;
  }, [subtypes]);

  const categoryStats = useMemo(() => {
    const stats = new Map<ArtifactCategory, number>();
    ARTIFACT_CATEGORIES.forEach((c) => stats.set(c, 0));
    subtypes.forEach((s) => {
      const count = artifacts.filter((a) => a.subtypeId === s.id).length;
      const cur = stats.get(s.category) || 0;
      stats.set(s.category, cur + count);
    });
    const unassigned = artifacts.filter((a) => !a.subtypeId).length;
    return { stats, unassigned };
  }, [subtypes, artifacts]);

  const handleInitDefaults = () => {
    if (!canManage) return;
    ARTIFACT_CATEGORIES.forEach((category) => {
      const existing = subtypesByCategory.get(category) || [];
      const existingNames = new Set(existing.map((s) => s.name));
      DEFAULT_SUBTYPES[category].forEach((name) => {
        if (!existingNames.has(name)) {
          addArtifactSubtype({ category, name, aliases: [] });
        }
      });
    });
  };

  const handleAutoAssign = () => {
    const result = autoAssignSubtypes();
    setAutoAssignResult(`自动归类完成：已匹配 ${result.matched} 件，待归类 ${result.unmatched} 件`);
    setTimeout(() => setAutoAssignResult(null), 5000);
  };

  const handleAddSubtype = () => {
    if (!newName.trim()) return;
    if (!can('artifactSubtype:create')) return;
    const aliases = newAliases
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    addArtifactSubtype({
      category: newCategory,
      name: newName.trim(),
      aliases: aliases.length > 0 ? aliases : undefined,
    });
    setNewName('');
    setNewAliases('');
    setShowAddDialog(false);
  };

  const handleSaveEdit = () => {
    if (!editingSubtype || !can('artifactSubtype:edit')) return;
    const aliases = newAliases
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    updateArtifactSubtype(editingSubtype.id, {
      name: newName.trim(),
      aliases: aliases.length > 0 ? aliases : undefined,
    });
    setEditingSubtype(null);
    setNewName('');
    setNewAliases('');
  };

  const startEdit = (subtype: ArtifactSubtype) => {
    setEditingSubtype(subtype);
    setNewCategory(subtype.category);
    setNewName(subtype.name);
    setNewAliases(subtype.aliases?.join('、') || '');
  };

  const handleDelete = (subtype: ArtifactSubtype) => {
    if (!can('artifactSubtype:delete')) return;
    const count = artifacts.filter((a) => a.subtypeId === subtype.id).length;
    const msg =
      count > 0
        ? `确定删除器型「${subtype.name}」吗？\n当前有 ${count} 件遗物使用此器型，删除后这些遗物将被标记为"待归类"。`
        : `确定删除器型「${subtype.name}」吗？`;
    if (confirm(msg)) {
      deleteArtifactSubtype(subtype.id);
    }
  };

  const openAddDialog = () => {
    setShowAddDialog(true);
    setEditingSubtype(null);
    setNewCategory(selectedCategory);
    setNewName('');
    setNewAliases('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">类型学分类管理</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              共 {subtypes.length} 个器型 · {categoryStats.unassigned} 件遗物待归类
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {autoAssignResult && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {autoAssignResult}
          </div>
        )}

        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleInitDefaults}
            disabled={!canManage}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            加载常用器型
          </button>
          <button
            onClick={handleAutoAssign}
            disabled={!canManage || artifacts.length === 0}
            className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            自动归类已有遗物
          </button>
          <div className="flex-1" />
          <button
            onClick={openAddDialog}
            disabled={!can('artifactSubtype:create')}
            className="px-4 py-1.5 bg-earth-600 text-white rounded-lg text-sm hover:bg-earth-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加器型
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 border-r border-gray-200 bg-gray-50 overflow-y-auto">
            {ARTIFACT_CATEGORIES.map((cat) => {
              const count = subtypesByCategory.get(cat)?.length || 0;
              const artifactCount = categoryStats.stats.get(cat) || 0;
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full px-4 py-3 text-left border-b border-gray-100 transition-colors ${
                    active
                      ? 'bg-white border-l-4 border-l-earth-500'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                    <span className={`font-medium ${active ? 'text-earth-700' : 'text-gray-700'}`}>
                      {cat}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 pl-5">
                    {count} 个器型 · {artifactCount} 件
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: CATEGORY_COLORS[selectedCategory] }}
                  />
                  {selectedCategory} · 器型列表
                </h4>
                <span className="text-sm text-gray-500">
                  共 {subtypesByCategory.get(selectedCategory)?.length || 0} 个
                </span>
              </div>

              {(subtypesByCategory.get(selectedCategory)?.length || 0) === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">
                    此大类下尚无器型，点击「添加器型」或「加载常用器型」开始配置
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {subtypesByCategory.get(selectedCategory)?.map((subtype) => {
                    const count = artifacts.filter((a) => a.subtypeId === subtype.id).length;
                    return (
                      <div
                        key={subtype.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-earth-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800">{subtype.name}</div>
                          {subtype.aliases && subtype.aliases.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
                              <span className="text-gray-400">别名:</span>
                              {subtype.aliases.map((a, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600"
                                >
                                  {a}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <span className="text-sm text-earth-600 font-medium whitespace-nowrap">
                            {count} 件
                          </span>
                          <button
                            onClick={() => startEdit(subtype)}
                            disabled={!can('artifactSubtype:edit')}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            title="编辑"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(subtype)}
                            disabled={!can('artifactSubtype:delete')}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            title="删除"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {(showAddDialog || editingSubtype) && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-60">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
              <div className="px-5 py-4 border-b border-gray-200">
                <h4 className="font-semibold text-gray-800">
                  {editingSubtype ? '编辑器型' : '添加器型'}
                </h4>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    所属大类
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ArtifactCategory)}
                    disabled={!!editingSubtype}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    {ARTIFACT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    器型名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="如: 罐、盆、鬲..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    别名（选填）
                  </label>
                  <input
                    type="text"
                    value={newAliases}
                    onChange={(e) => setNewAliases(e.target.value)}
                    placeholder="多个别名用顿号或逗号分隔，用于自动匹配"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    例如: 陶罐、彩陶罐、夹砂罐 等都可匹配到「罐」
                  </p>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setEditingSubtype(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={editingSubtype ? handleSaveEdit : handleAddSubtype}
                  disabled={!newName.trim()}
                  className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingSubtype ? '保存' : '添加'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
