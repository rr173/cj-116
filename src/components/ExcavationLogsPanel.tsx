import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { TimeSlot, WeatherType } from '../types';
import {
  getTodayDate,
  WEATHER_ICONS,
  WEATHER_OPTIONS,
  generateId,
  calculateTotalDuration,
  formatDuration,
} from '../utils';

interface FormData {
  date: string;
  weather: WeatherType;
  participantIds: string[];
  timeSlots: TimeSlot[];
  summary: string;
}

const createEmptySlot = (): TimeSlot => ({
  id: generateId(),
  startTime: '08:00',
  endTime: '12:00',
});

const defaultFormData = (): FormData => ({
  date: getTodayDate(),
  weather: '晴',
  participantIds: [],
  timeSlots: [createEmptySlot()],
  summary: '',
});

export default function ExcavationLogsPanel() {
  const persons = useAppStore((state) => state.persons);
  const logs = useAppStore((state) => state.excavationLogs);
  const cells = useAppStore((state) => state.cells);
  const artifacts = useAppStore((state) => state.artifacts);
  const getCellsNewlyExposedOnDate = useAppStore((state) => state.getCellsNewlyExposedOnDate);
  const getArtifactsNewlyCreatedOnDate = useAppStore((state) => state.getArtifactsNewlyCreatedOnDate);
  const addExcavationLog = useAppStore((state) => state.addExcavationLog);
  const updateExcavationLog = useAppStore((state) => state.updateExcavationLog);
  const deleteExcavationLog = useAppStore((state) => state.deleteExcavationLog);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData());
  const [filterDate, setFilterDate] = useState<string>('');

  const filteredLogs = useMemo(() => {
    let result = [...logs];
    if (filterDate) {
      result = result.filter((l) => l.date === filterDate);
    }
    return result.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [logs, filterDate]);

  const activePersons = useMemo(() => {
    return persons.filter((p) => p.status === '在岗').sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [persons]);

  const getPersonName = (id: string) => persons.find((p) => p.id === id)?.name || '未知';

  const resetForm = () => {
    setFormData(defaultFormData());
  };

  const handleAdd = () => {
    resetForm();
    setShowAddForm(true);
    setEditingId(null);
  };

  const handleEdit = (log: typeof logs[0]) => {
    setFormData({
      date: log.date,
      weather: log.weather,
      participantIds: [...log.participantIds],
      timeSlots: log.timeSlots.map((s) => ({ ...s })),
      summary: log.summary,
    });
    setEditingId(log.id);
    setShowAddForm(true);
  };

  const handleParticipantToggle = (personId: string) => {
    setFormData((prev) => {
      const has = prev.participantIds.includes(personId);
      return {
        ...prev,
        participantIds: has
          ? prev.participantIds.filter((id) => id !== personId)
          : [...prev.participantIds, personId],
      };
    });
  };

  const handleSlotChange = (slotId: string, field: 'startTime' | 'endTime', value: string) => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.map((s) =>
        s.id === slotId ? { ...s, [field]: value } : s
      ),
    }));
  };

  const handleAddSlot = () => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: [...prev.timeSlots, createEmptySlot()],
    }));
  };

  const handleRemoveSlot = (slotId: string) => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((s) => s.id !== slotId),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.participantIds.length === 0) {
      alert('请至少选择一名参与人员');
      return;
    }
    if (formData.timeSlots.length === 0) {
      alert('请至少添加一个工作时段');
      return;
    }

    if (editingId) {
      updateExcavationLog(editingId, formData);
    } else {
      addExcavationLog(formData);
    }
    setShowAddForm(false);
    setEditingId(null);
  };

  const previewNewCells = useMemo(() => {
    if (!showAddForm) return [];
    return getCellsNewlyExposedOnDate(formData.date);
  }, [showAddForm, formData.date, getCellsNewlyExposedOnDate]);

  const previewNewArtifacts = useMemo(() => {
    if (!showAddForm) return [];
    return getArtifactsNewlyCreatedOnDate(formData.date);
  }, [showAddForm, formData.date, getArtifactsNewlyCreatedOnDate]);

  const logFormDuration = calculateTotalDuration(formData.timeSlots);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">发掘日志</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {logs.length} 条日志
            {filteredLogs.length !== logs.length && (
              <span className="ml-2 text-earth-600">
                (筛选显示 {filteredLogs.length} 条)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              清除筛选
            </button>
          )}
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            记录今日日志
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="font-medium text-gray-700">日志列表</h3>
        </div>
        <div className="flex-1 overflow-auto">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
              <svg className="w-16 h-16 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-center">
                {filterDate ? '所选日期暂无发掘日志' : '暂无发掘日志，点击"记录今日日志"开始记录'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLogs.map((log) => {
                const logDuration = calculateTotalDuration(log.timeSlots);
                return (
                  <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                          <span className="text-lg font-semibold text-gray-800">{log.date}</span>
                          <span className="text-2xl" title={WEATHER_ICONS[log.weather].label}>
                            {WEATHER_ICONS[log.weather].emoji}
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {formatDuration(logDuration)}
                          </span>
                          <span className="text-xs text-earth-700 bg-earth-50 px-2 py-0.5 rounded border border-earth-100">
                            {log.participantIds.length} 人参加
                          </span>
                          {log.newlyExposedCellIds.length > 0 && (
                            <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                              新揭 {log.newlyExposedCellIds.length} 方格
                            </span>
                          )}
                          {log.newlyArtifactIds.length > 0 && (
                            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                              新出 {log.newlyArtifactIds.length} 遗物
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {log.summary || <span className="text-gray-400 italic">（无操作摘要）</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>
                            时段:{' '}
                            {log.timeSlots
                              .map((s) => `${s.startTime}-${s.endTime}`)
                              .join('、')}
                          </span>
                          <span>
                            人员:{' '}
                            {log.participantIds.map(getPersonName).join('、')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(log)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`确定删除 ${log.date} 的日志吗？`)) {
                              deleteExcavationLog(log.id);
                            }
                          }}
                          className="text-red-500 hover:text-red-600 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? '编辑发掘日志' : '记录发掘日志'}
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
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    天气 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {WEATHER_OPTIONS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setFormData({ ...formData, weather: w })}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                          formData.weather === w
                            ? 'border-earth-500 bg-earth-50 ring-2 ring-earth-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="mr-1">{WEATHER_ICONS[w].emoji}</span>
                        {WEATHER_ICONS[w].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  工作时段 <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    合计 {formatDuration(logFormDuration)}
                  </span>
                </label>
                <div className="space-y-2">
                  {formData.timeSlots.map((slot, idx) => (
                    <div key={slot.id} className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 w-16 flex-shrink-0">时段 {idx + 1}</span>
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => handleSlotChange(slot.id, 'startTime', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                      />
                      <span className="text-gray-400">至</span>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => handleSlotChange(slot.id, 'endTime', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                      />
                      {formData.timeSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSlot(slot.id)}
                          className="text-red-500 hover:text-red-600 px-2 text-sm"
                        >
                          移除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddSlot}
                  className="mt-2 text-sm text-earth-700 hover:text-earth-800 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  添加时段
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  上工人员 <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    已选 {formData.participantIds.length} 人
                  </span>
                </label>
                {activePersons.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    当前没有在岗人员，请先在"人员库"中添加人员并设置为在岗状态。
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-auto">
                    <div className="flex flex-wrap gap-2">
                      {activePersons.map((p) => {
                        const selected = formData.participantIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleParticipantToggle(p.id)}
                            className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                              selected
                                ? 'border-earth-500 bg-earth-50 text-earth-800 ring-2 ring-earth-200'
                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                            }`}
                          >
                            {selected && (
                              <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {p.name}
                            <span className="text-xs text-gray-400 ml-1">({p.role})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">操作摘要</label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  rows={4}
                  placeholder="请描述今天的主要工作内容，例如：清理T0101N02E03第3层，出土陶片若干..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="border border-blue-100 rounded-lg p-3 bg-blue-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-blue-800">当日新揭方格</span>
                    <span className="text-sm font-bold text-blue-700">{previewNewCells.length} 个</span>
                  </div>
                  {previewNewCells.length > 0 ? (
                    <div className="text-xs text-blue-600 flex flex-wrap gap-1 mt-2">
                      {previewNewCells.slice(0, 10).map((cid) => {
                        const c = cells.find((cc) => cc.id === cid);
                        return (
                          <span key={cid} className="px-2 py-0.5 bg-white rounded border border-blue-100">
                            {c?.code || cid}
                          </span>
                        );
                      })}
                      {previewNewCells.length > 10 && (
                        <span className="text-blue-500">等{previewNewCells.length}个</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-blue-500/70 mt-2">该日期暂未有新地层录入</p>
                  )}
                </div>
                <div className="border border-amber-100 rounded-lg p-3 bg-amber-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-amber-800">当日新出遗物</span>
                    <span className="text-sm font-bold text-amber-700">{previewNewArtifacts.length} 件</span>
                  </div>
                  {previewNewArtifacts.length > 0 ? (
                    <div className="text-xs text-amber-600 flex flex-wrap gap-1 mt-2">
                      {previewNewArtifacts.slice(0, 10).map((aid) => {
                        const a = artifacts.find((aa) => aa.id === aid);
                        return (
                          <span key={aid} className="px-2 py-0.5 bg-white rounded border border-amber-100">
                            {a?.catalogNumber || aid}
                          </span>
                        );
                      })}
                      {previewNewArtifacts.length > 10 && (
                        <span className="text-amber-500">等{previewNewArtifacts.length}件</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-500/70 mt-2">该日期暂未有新遗物登记</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-3">
                * 上述两项数据会根据当日地层录入和遗物登记自动计算，无需手动填写
              </p>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
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
                  {editingId ? '保存修改' : '提交日志'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
