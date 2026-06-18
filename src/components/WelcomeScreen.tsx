import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function WelcomeScreen() {
  const [showForm, setShowForm] = useState(false);
  const createTrench = useAppStore((state) => state.createTrench);

  const [formData, setFormData] = useState({
    name: '第一发掘区',
    code: 'T1',
    description: '',
    rows: 10,
    cols: 10,
    cellSize: 1,
    originX: 0,
    originY: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTrench(formData);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-earth-50 to-earth-100 flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-6">
        <div className="mb-8">
          <div className="w-20 h-20 bg-earth-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-3">
            考古发掘方格网记录系统
          </h1>
          <p className="text-lg text-gray-600">
            专业的田野考古发掘记录与地层叠压关系推断工具
          </p>
        </div>

        {!showForm ? (
          <div className="space-y-4">
            <button
              onClick={() => setShowForm(true)}
              className="px-8 py-4 bg-earth-600 text-white text-lg font-medium rounded-xl hover:bg-earth-700 transition-colors shadow-lg hover:shadow-xl"
            >
              创建第一个发掘区
            </button>
            <div className="grid grid-cols-3 gap-4 mt-12">
              <div className="bg-white/60 backdrop-blur rounded-xl p-4">
                <div className="text-3xl mb-2">📐</div>
                <h3 className="font-medium text-gray-800">方格网管理</h3>
                <p className="text-sm text-gray-500 mt-1">自动生成方格网，平面布局可视化</p>
              </div>
              <div className="bg-white/60 backdrop-blur rounded-xl p-4">
                <div className="text-3xl mb-2">🏔️</div>
                <h3 className="font-medium text-gray-800">地层记录</h3>
                <p className="text-sm text-gray-500 mt-1">详细记录每层土质土色与包含物</p>
              </div>
              <div className="bg-white/60 backdrop-blur rounded-xl p-4">
                <div className="text-3xl mb-2">📊</div>
                <h3 className="font-medium text-gray-800">Harris矩阵</h3>
                <p className="text-sm text-gray-500 mt-1">自动生成地层叠压关系图</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-left">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">创建发掘区</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    发掘区名称
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    探方编号
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    行数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.rows}
                    onChange={(e) => setFormData({ ...formData, rows: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    列数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.cols}
                    onChange={(e) => setFormData({ ...formData, cols: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    方格大小(m)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formData.cellSize}
                    onChange={(e) => setFormData({ ...formData, cellSize: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    原点X坐标
                  </label>
                  <input
                    type="number"
                    value={formData.originX}
                    onChange={(e) => setFormData({ ...formData, originX: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    原点Y坐标
                  </label>
                  <input
                    type="number"
                    value={formData.originY}
                    onChange={(e) => setFormData({ ...formData, originY: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
        )}
      </div>
    </div>
  );
}
