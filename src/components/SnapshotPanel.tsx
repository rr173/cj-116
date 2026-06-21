import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSnapshotStore } from '../store/useSnapshotStore';
import { useSampleStore } from '../store/useSampleStore';
import { usePermission } from '../hooks/usePermission';
import { SnapshotCellState, SnapshotViewMode } from '../types';
import { formatDate } from '../utils';
import SnapshotReviewView from './SnapshotReviewView';
import SnapshotCompareView from './SnapshotCompareView';
import SnapshotProgressChart from './SnapshotProgressChart';

export default function SnapshotPanel() {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const selectedTrench = useAppStore((state) =>
    state.trenches.find((t) => t.id === selectedTrenchId)
  );
  const getCellsByTrench = useAppStore((state) => state.getCellsByTrench);
  const getStratigraphiesByCell = useAppStore((state) => state.getStratigraphiesByCell);
  const getFeaturesByTrench = useAppStore((state) => state.getFeaturesByTrench);
  const getArtifactsByTrench = useAppStore((state) => state.artifacts);
  const getRelationsByTrench = useAppStore((state) => state.getRelationsByTrench);
  const samples = useSampleStore((state) => state.samples);

  const { can } = usePermission();

  const snapshots = useSnapshotStore((state) => state.getSnapshotsByTrench(selectedTrenchId || ''));
  const createSnapshot = useSnapshotStore((state) => state.createSnapshot);
  const deleteSnapshot = useSnapshotStore((state) => state.deleteSnapshot);
  const updateSnapshot = useSnapshotStore((state) => state.updateSnapshot);
  const selectedSnapshotId = useSnapshotStore((state) => state.selectedSnapshotId);
  const setSelectedSnapshot = useSnapshotStore((state) => state.setSelectedSnapshot);
  const compareSnapshotAId = useSnapshotStore((state) => state.compareSnapshotAId);
  const compareSnapshotBId = useSnapshotStore((state) => state.compareSnapshotBId);
  const setCompareSnapshotA = useSnapshotStore((state) => state.setCompareSnapshotA);
  const setCompareSnapshotB = useSnapshotStore((state) => state.setCompareSnapshotB);

  const [viewMode, setViewMode] = useState<SnapshotViewMode>('timeline');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);

  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotRemark, setSnapshotRemark] = useState('');
  const [editName, setEditName] = useState('');
  const [editRemark, setEditRemark] = useState('');

  const trenchCells = useMemo(
    () => (selectedTrenchId ? getCellsByTrench(selectedTrenchId) : []),
    [selectedTrenchId, getCellsByTrench]
  );

  const currentStats = useMemo(() => {
    if (!selectedTrenchId) return null;
    const cellStates: SnapshotCellState[] = trenchCells.map((cell) => {
      const strats = getStratigraphiesByCell(cell.id);
      const deepestLayer = strats.length > 0
        ? Math.max(...strats.map((s) => s.layerNumber))
        : 0;
      const features = getAppFeaturesByCell(cell.id);
      return {
        cellId: cell.id,
        deepestLayerNumber: deepestLayer,
        stratigraphyCount: strats.length,
        featureIds: features.map((f) => f.id),
      };
    });

    const exposedCount = cellStates.filter((c) => c.deepestLayerNumber > 0).length;
    const trenchArtifacts = getArtifactsByTrench.filter((a) => a.trenchId === selectedTrenchId);
    const trenchSamples = samples.filter((s) => s.trenchId === selectedTrenchId);
    const trenchRelations = getRelationsByTrench(selectedTrenchId);
    const trenchFeatures = getFeaturesByTrench(selectedTrenchId);
    const totalStrats = cellStates.reduce((sum, c) => sum + c.stratigraphyCount, 0);
    const featureSnapshots = trenchFeatures.map((f) => ({
      id: f.id,
      featureNumber: f.featureNumber,
      featureType: f.featureType,
      coveredCellIds: f.coveredCellIds,
      topElevation: f.topElevation,
      bottomElevation: f.bottomElevation,
    }));

    return {
      cellStates,
      exposedCount,
      totalArtifacts: trenchArtifacts.length,
      totalSamples: trenchSamples.length,
      totalStratigraphies: totalStrats,
      totalRelations: trenchRelations.length,
      totalFeatures: trenchFeatures.length,
      totalCells: trenchCells.length,
      featureSnapshots,
    };
  }, [selectedTrenchId, trenchCells, getStratigraphiesByCell, getArtifactsByTrench, samples, getRelationsByTrench, getFeaturesByTrench]);

  function getAppFeaturesByCell(cellId: string) {
    const state = useAppStore.getState();
    return state.features.filter((f) => f.coveredCellIds.includes(cellId));
  }

  const handleCreateSnapshot = () => {
    if (!selectedTrenchId || !currentStats) return;
    if (!snapshotName.trim()) {
      alert('请输入快照名称');
      return;
    }
    createSnapshot({
      trenchId: selectedTrenchId,
      name: snapshotName.trim(),
      remark: snapshotRemark.trim(),
      cellStates: currentStats.cellStates,
      totalArtifacts: currentStats.totalArtifacts,
      totalSamples: currentStats.totalSamples,
      totalStratigraphies: currentStats.totalStratigraphies,
      totalRelations: currentStats.totalRelations,
      totalFeatures: currentStats.totalFeatures,
      exposedCellCount: currentStats.exposedCount,
      totalCellCount: currentStats.totalCells,
      featureSnapshots: currentStats.featureSnapshots,
    });
    setSnapshotName('');
    setSnapshotRemark('');
    setShowCreateModal(false);
  };

  const handleStartEdit = (snap: typeof snapshots[0]) => {
    setEditingSnapshotId(snap.id);
    setEditName(snap.name);
    setEditRemark(snap.remark);
  };

  const handleSaveEdit = () => {
    if (!editingSnapshotId || !editName.trim()) {
      alert('请输入快照名称');
      return;
    }
    updateSnapshot(editingSnapshotId, {
      name: editName.trim(),
      remark: editRemark.trim(),
    });
    setEditingSnapshotId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除此快照吗？此操作不可恢复。')) {
      deleteSnapshot(id);
    }
  };

  const handleEnterReview = (snapId: string) => {
    setSelectedSnapshot(snapId);
    setViewMode('review');
  };

  const handleSelectForCompare = (snapId: string, role: 'A' | 'B') => {
    if (role === 'A') {
      if (compareSnapshotBId === snapId) {
        setCompareSnapshotB(null);
      }
      setCompareSnapshotA(snapId);
    } else {
      if (compareSnapshotAId === snapId) {
        setCompareSnapshotA(null);
      }
      setCompareSnapshotB(snapId);
    }
  };

  const handleStartCompare = () => {
    if (!compareSnapshotAId || !compareSnapshotBId) {
      alert('请选择两个快照进行对比');
      return;
    }
    if (compareSnapshotAId === compareSnapshotBId) {
      alert('请选择两个不同的快照');
      return;
    }
    setViewMode('compare');
  };

  if (!selectedTrenchId || !selectedTrench) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        请先选择一个发掘区
      </div>
    );
  }

  if (viewMode === 'review' && selectedSnapshotId) {
    return (
      <SnapshotReviewView
        snapshotId={selectedSnapshotId}
        onBack={() => {
          setSelectedSnapshot(null);
          setViewMode('timeline');
        }}
      />
    );
  }

  if (viewMode === 'compare' && compareSnapshotAId && compareSnapshotBId) {
    return (
      <SnapshotCompareView
        snapshotAId={compareSnapshotAId}
        snapshotBId={compareSnapshotBId}
        onBack={() => setViewMode('timeline')}
      />
    );
  }

  if (viewMode === 'stats') {
    return (
      <SnapshotProgressChart
        trenchId={selectedTrenchId}
        onBack={() => setViewMode('timeline')}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {selectedTrench.name} - 发掘进度快照
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            定期创建快照记录发掘状态，支持多期对比和进度统计
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('stats')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            进度统计
          </button>
          {compareSnapshotAId && compareSnapshotBId && (
            <button
              onClick={handleStartCompare}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              开始对比
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!can('stratigraphy:create')}
            className="px-4 py-2 text-sm font-medium text-white bg-earth-600 rounded-lg hover:bg-earth-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建快照
          </button>
        </div>
      </div>

      {currentStats && (
        <div className="mb-4 grid grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">已揭露方格</div>
            <div className="text-2xl font-bold text-gray-800">
              {currentStats.exposedCount}
              <span className="text-sm font-normal text-gray-500">/{currentStats.totalCells}</span>
            </div>
            <div className="text-xs text-earth-600 mt-1">
              {currentStats.totalCells > 0
                ? ((currentStats.exposedCount / currentStats.totalCells) * 100).toFixed(1) + '%'
                : '0%'}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">地层记录</div>
            <div className="text-2xl font-bold text-gray-800">{currentStats.totalStratigraphies}</div>
            <div className="text-xs text-gray-500 mt-1">条</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">遗物总数</div>
            <div className="text-2xl font-bold text-gray-800">{currentStats.totalArtifacts}</div>
            <div className="text-xs text-gray-500 mt-1">件</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">遗迹要素</div>
            <div className="text-2xl font-bold text-gray-800">{currentStats.totalFeatures}</div>
            <div className="text-xs text-gray-500 mt-1">个</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">地层关系 / 样品</div>
            <div className="text-2xl font-bold text-gray-800">
              {currentStats.totalRelations}
              <span className="text-sm font-normal text-gray-400 mx-1">/</span>
              {currentStats.totalSamples}
            </div>
            <div className="text-xs text-gray-500 mt-1">条 / 件</div>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center gap-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'timeline'
                ? 'bg-white text-earth-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            时间轴视图
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-earth-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            列表视图
          </button>
        </div>

        {(compareSnapshotAId || compareSnapshotBId) && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">对比选择:</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              compareSnapshotAId ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              A: {compareSnapshotAId
                ? snapshots.find((s) => s.id === compareSnapshotAId)?.name || '已选'
                : '未选择'}
            </span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              compareSnapshotBId ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
            }`}>
              B: {compareSnapshotBId
                ? snapshots.find((s) => s.id === compareSnapshotBId)?.name || '已选'
                : '未选择'}
            </span>
            {(compareSnapshotAId || compareSnapshotBId) && (
              <button
                onClick={() => {
                  setCompareSnapshotA(null);
                  setCompareSnapshotB(null);
                }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                清除选择
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
        {snapshots.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium text-gray-700 mb-1">还没有任何快照</p>
            <p className="text-sm mb-4">点击右上方"创建快照"按钮记录当前发掘状态</p>
          </div>
        ) : viewMode === 'timeline' ? (
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-6">
              {snapshots.map((snap, idx) => {
                const isCompareA = snap.id === compareSnapshotAId;
                const isCompareB = snap.id === compareSnapshotBId;
                return (
                  <div key={snap.id} className="relative pl-20">
                    <div className={`absolute left-5 top-4 w-6 h-6 rounded-full border-4 ${
                      isCompareA
                        ? 'bg-green-500 border-green-200'
                        : isCompareB
                        ? 'bg-orange-500 border-orange-200'
                        : 'bg-white border-gray-300'
                    }`}>
                      <div className={`absolute inset-0 rounded-full ${
                        isCompareA || isCompareB ? '' : 'bg-earth-500 scale-50'
                      }`} />
                    </div>

                    <div className={`rounded-xl border-2 p-5 transition-all ${
                      isCompareA
                        ? 'border-green-300 bg-green-50'
                        : isCompareB
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-earth-200 hover:shadow-sm'
                    }`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          {editingSnapshotId === snap.id ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 w-64"
                                placeholder="快照名称"
                              />
                              <textarea
                                value={editRemark}
                                onChange={(e) => setEditRemark(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 w-full"
                                rows={2}
                                placeholder="备注（可选）"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={handleSaveEdit}
                                  className="px-3 py-1 text-xs font-medium text-white bg-earth-600 rounded hover:bg-earth-700"
                                >
                                  保存
                                </button>
                                <button
                                  onClick={() => setEditingSnapshotId(null)}
                                  className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                {snap.name}
                                {idx === 0 && (
                                  <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
                                    初始
                                  </span>
                                )}
                                {idx === snapshots.length - 1 && snapshots.length > 1 && (
                                  <span className="px-2 py-0.5 text-[10px] font-medium bg-earth-100 text-earth-700 rounded">
                                    最新
                                  </span>
                                )}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {formatDate(new Date(snap.createdAt))}
                                {snap.remark && <span className="ml-2">· {snap.remark}</span>}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSelectForCompare(snap.id, 'A')}
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                              isCompareA
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'
                            }`}
                            title="设为对比A（较早）"
                          >
                            选A
                          </button>
                          <button
                            onClick={() => handleSelectForCompare(snap.id, 'B')}
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                              isCompareB
                                ? 'bg-orange-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700'
                            }`}
                            title="设为对比B（较晚）"
                          >
                            选B
                          </button>
                          <div className="w-px h-5 bg-gray-200 mx-1" />
                          <button
                            onClick={() => handleEnterReview(snap.id)}
                            className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                          >
                            回看
                          </button>
                          <button
                            onClick={() => handleStartEdit(snap)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="编辑"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(snap.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="删除"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-3 text-sm">
                        <div className="bg-white/60 rounded-lg p-3 border border-gray-100">
                          <div className="text-xs text-gray-500 mb-0.5">揭露进度</div>
                          <div className="font-semibold text-gray-800">
                            {snap.exposedCellCount}/{snap.totalCellCount}
                            <span className="text-xs text-gray-500 ml-1">
                              ({snap.totalCellCount > 0
                                ? ((snap.exposedCellCount / snap.totalCellCount) * 100).toFixed(1)
                                : 0}%)
                            </span>
                          </div>
                        </div>
                        <div className="bg-white/60 rounded-lg p-3 border border-gray-100">
                          <div className="text-xs text-gray-500 mb-0.5">地层</div>
                          <div className="font-semibold text-gray-800">{snap.totalStratigraphies} 条</div>
                        </div>
                        <div className="bg-white/60 rounded-lg p-3 border border-gray-100">
                          <div className="text-xs text-gray-500 mb-0.5">遗物</div>
                          <div className="font-semibold text-gray-800">{snap.totalArtifacts} 件</div>
                        </div>
                        <div className="bg-white/60 rounded-lg p-3 border border-gray-100">
                          <div className="text-xs text-gray-500 mb-0.5">遗迹</div>
                          <div className="font-semibold text-gray-800">{snap.totalFeatures} 个</div>
                        </div>
                        <div className="bg-white/60 rounded-lg p-3 border border-gray-100">
                          <div className="text-xs text-gray-500 mb-0.5">关系/样品</div>
                          <div className="font-semibold text-gray-800">
                            {snap.totalRelations}/{snap.totalSamples}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">名称</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">创建时间</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">揭露进度</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">地层</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">遗物</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">遗迹</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">备注</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snap) => (
                  <tr key={snap.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-800">{snap.name}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(new Date(snap.createdAt))}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {snap.exposedCellCount}/{snap.totalCellCount}
                      <span className="text-xs text-gray-400 ml-1">
                        ({snap.totalCellCount > 0
                          ? ((snap.exposedCellCount / snap.totalCellCount) * 100).toFixed(1)
                          : 0}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{snap.totalStratigraphies}</td>
                    <td className="py-3 px-4 text-gray-600">{snap.totalArtifacts}</td>
                    <td className="py-3 px-4 text-gray-600">{snap.totalFeatures}</td>
                    <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{snap.remark || '-'}</td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleSelectForCompare(snap.id, 'A')}
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          snap.id === compareSnapshotAId
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                        }`}
                      >
                        选A
                      </button>
                      <button
                        onClick={() => handleSelectForCompare(snap.id, 'B')}
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          snap.id === compareSnapshotBId
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-orange-100'
                        }`}
                      >
                        选B
                      </button>
                      <button
                        onClick={() => handleEnterReview(snap.id)}
                        className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                      >
                        回看
                      </button>
                      <button
                        onClick={() => handleDelete(snap.id)}
                        className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">创建发掘进度快照</h3>
            <p className="text-sm text-gray-500 mb-4">
              将冻结当前发掘区的所有状态作为历史记录，后续修改不影响已保存的快照。
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  快照名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="例如：第3周末状态、试掘完成、第2阶段结束"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  备注说明
                </label>
                <textarea
                  value={snapshotRemark}
                  onChange={(e) => setSnapshotRemark(e.target.value)}
                  placeholder="可选，记录此快照的特殊说明"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 text-sm resize-none"
                />
              </div>

              {currentStats && (
                <div className="bg-gray-50 rounded-lg p-4 text-xs space-y-1">
                  <div className="font-medium text-gray-700 mb-2">将记录以下数据：</div>
                  <div className="grid grid-cols-2 gap-2 text-gray-600">
                    <div>方格揭露: {currentStats.exposedCount}/{currentStats.totalCells}</div>
                    <div>地层记录: {currentStats.totalStratigraphies}条</div>
                    <div>遗物: {currentStats.totalArtifacts}件</div>
                    <div>遗迹要素: {currentStats.totalFeatures}个</div>
                    <div>地层关系: {currentStats.totalRelations}条</div>
                    <div>样品: {currentStats.totalSamples}件</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateSnapshot}
                className="px-4 py-2 text-sm font-medium text-white bg-earth-600 rounded-lg hover:bg-earth-700 transition-colors"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
