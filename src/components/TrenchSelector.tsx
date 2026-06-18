import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function TrenchSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const trenches = useAppStore((state) => state.trenches);
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const setSelectedTrench = useAppStore((state) => state.setSelectedTrench);
  const createTrench = useAppStore((state) => state.createTrench);
  const deleteTrench = useAppStore((state) => state.deleteTrench);

  const selectedTrench = trenches.find((t) => t.id === selectedTrenchId);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    rows: 10,
    cols: 10,
    cellSize: 1,
    originX: 0,
    originY: 0,
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createTrench(formData);
    setShowCreateForm(false);
    setFormData({
      name: '',
      code: '',
      description: '',
      rows: 10,
      cols: 10,
      cellSize: 1,
      originX: 0,
      originY: 0,
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-sm font-medium text-gray-700">
          {selectedTrench?.name || '选择发掘区'}
        </span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
            <div className="p-2 max-h-64 overflow-y-auto scrollbar-thin">
              {trenches.map((trench) => (
                <div
                  key={trench.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                    trench.id === selectedTrenchId ? 'bg-earth-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <div
                    className="flex-1"
                    onClick={() => {
                      setSelectedTrench(trench.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="text-sm font-medium text-gray-800">{trench.name}</div>
                    <div className="text-xs text-gray-500">
                      {trench.code} · {trench.rows}×{trench.cols} 方格
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('确定要删除这个发掘区吗？所有相关数据都将被删除。')) {
                        deleteTrench(trench.id);
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 p-2">
              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full py-2 text-sm text-earth-600 hover:bg-earth-50 rounded-lg flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新建发掘区
                </button>
              ) : (
                <form onSubmit={handleCreate} className="space-y-2">
                  <input
                    type="text"
                    placeholder="发掘区名称"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-earth-500 outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="探方编号"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-earth-500 outline-none"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="行数"
                      value={formData.rows}
                      onChange={(e) => setFormData({ ...formData, rows: parseInt(e.target.value) || 10 })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-earth-500 outline-none"
                      min="1"
                    />
                    <input
                      type="number"
                      placeholder="列数"
                      value={formData.cols}
                      onChange={(e) => setFormData({ ...formData, cols: parseInt(e.target.value) || 10 })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-earth-500 outline-none"
                      min="1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-1 text-sm text-white bg-earth-600 hover:bg-earth-700 rounded"
                    >
                      创建
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
