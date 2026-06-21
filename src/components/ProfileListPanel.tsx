import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  calculateProfileCells,
  calculateProfileDirection,
  calculateTotalLength,
  calculateElevationRange,
} from '../utils/profile';

interface ProfileListPanelProps {
  onCreateProfile?: () => void;
}

export default function ProfileListPanel({ onCreateProfile }: ProfileListPanelProps) {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const trench = useAppStore((state) =>
    state.trenches.find((t) => t.id === selectedTrenchId)
  );
  const cells = useAppStore((state) =>
    state.cells.filter((c) => c.trenchId === selectedTrenchId)
  );
  const stratigraphies = useAppStore((state) =>
    state.stratigraphies.filter((s) => s.trenchId === selectedTrenchId)
  );
  const profiles = useAppStore((state) =>
    state.profiles.filter((p) => p.trenchId === selectedTrenchId)
  );
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const createProfile = useAppStore((state) => state.createProfile);
  const deleteProfile = useAppStore((state) => state.deleteProfile);
  const setSelectedProfile = useAppStore((state) => state.setSelectedProfile);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileDesc, setProfileDesc] = useState('');
  const [startCellId, setStartCellId] = useState('');
  const [endCellId, setEndCellId] = useState('');
  const [profileWidth, setProfileWidth] = useState(1000);
  const [profileHeight, setProfileHeight] = useState(600);

  const handleCreateProfile = () => {
    if (!selectedTrenchId || !startCellId || !endCellId || !profileName.trim()) return;
    if (!trench) return;

    const startCell = cells.find((c) => c.id === startCellId);
    const endCell = cells.find((c) => c.id === endCellId);
    if (!startCell || !endCell) return;

    const profileCells = calculateProfileCells(startCell, endCell, cells);
    if (profileCells.length < 2) {
      alert('剖面至少需要穿过2个方格');
      return;
    }

    const direction = calculateProfileDirection(startCell, endCell);
    const totalLength = calculateTotalLength(profileCells, trench.cellSize);
    const elevRange = calculateElevationRange(profileCells, stratigraphies);

    createProfile({
      trenchId: selectedTrenchId,
      name: profileName.trim(),
      description: profileDesc.trim(),
      startCellId,
      endCellId,
      direction,
      cellIds: profileCells.map((c) => c.id),
      minElevation: elevRange.minElevation,
      maxElevation: elevRange.maxElevation,
      totalLength,
      width: profileWidth,
      height: profileHeight,
    });

    setShowCreateModal(false);
    setProfileName('');
    setProfileDesc('');
    setStartCellId('');
    setEndCellId('');
    onCreateProfile?.();
  };

  const handleDeleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除此剖面吗？所有相关的界面线、打破线和注记都将被删除。')) {
      deleteProfile(id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="font-medium text-gray-700">剖面列表</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 bg-earth-600 text-white text-sm rounded-lg hover:bg-earth-700 transition-colors"
        >
          + 新建
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {profiles.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            暂无剖面，点击上方按钮创建
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                onClick={() => setSelectedProfile(profile.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedProfileId === profile.id
                    ? 'border-earth-500 bg-earth-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">
                      {profile.name}
                    </div>
                    {profile.description && (
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {profile.description}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>{profile.cellIds.length} 格</span>
                      <span>·</span>
                      <span>{profile.totalLength.toFixed(1)}m</span>
                      <span>·</span>
                      <span>{profile.boundaryLines.length} 条线</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProfile(profile.id, e)}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="删除剖面"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">创建新剖面</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  剖面名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="如：东壁剖面、T1南壁"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={profileDesc}
                  onChange={(e) => setProfileDesc(e.target.value)}
                  placeholder="可选的剖面描述"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    起点方格 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={startCellId}
                    onChange={(e) => setStartCellId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    <option value="">请选择</option>
                    {cells
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    终点方格 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={endCellId}
                    onChange={(e) => setEndCellId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    <option value="">请选择</option>
                    {cells
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    画布宽度 (px)
                  </label>
                  <input
                    type="number"
                    value={profileWidth}
                    onChange={(e) => setProfileWidth(parseInt(e.target.value) || 1000)}
                    min={500}
                    max={3000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    画布高度 (px)
                  </label>
                  <input
                    type="number"
                    value={profileHeight}
                    onChange={(e) => setProfileHeight(parseInt(e.target.value) || 600)}
                    min={300}
                    max={2000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
              </div>
              {startCellId && endCellId && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                  {(() => {
                    const sc = cells.find((c) => c.id === startCellId);
                    const ec = cells.find((c) => c.id === endCellId);
                    if (!sc || !ec) return null;
                    const pc = calculateProfileCells(sc, ec, cells);
                    const dir = calculateProfileDirection(sc, ec);
                    const len = calculateTotalLength(pc, trench?.cellSize || 1);
                    return (
                      <div>
                        <div>方向：{dir === 'horizontal' ? '横向' : dir === 'vertical' ? '纵向' : '斜向'}</div>
                        <div>穿过方格：{pc.length} 个</div>
                        <div>总长度：{len.toFixed(2)} m</div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateProfile}
                disabled={!profileName.trim() || !startCellId || !endCellId}
                className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
