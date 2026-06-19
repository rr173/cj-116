import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { WEATHER_ICONS, calculateTotalDuration, formatDuration } from '../utils';

export default function TimelinePanel() {
  const logs = useAppStore((state) => state.excavationLogs);
  const persons = useAppStore((state) => state.persons);
  const getLogById = useAppStore((state) => state.getExcavationLogById);
  const updateLog = useAppStore((state) => state.updateExcavationLog);
  const deleteLog = useAppStore((state) => state.deleteExcavationLog);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterPersonId, setFilterPersonId] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<{ id: string; summary: string } | null>(null);

  const sortedPersons = useMemo(
    () => [...persons].sort((a, b) => a.name.localeCompare(b.name, 'zh')),
    [persons]
  );

  const filteredLogs = useMemo(() => {
    let result = [...logs];
    if (startDate) {
      result = result.filter((l) => l.date >= startDate);
    }
    if (endDate) {
      result = result.filter((l) => l.date <= endDate);
    }
    if (filterPersonId) {
      result = result.filter((l) => l.participantIds.includes(filterPersonId));
    }
    return result.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return b.createdAt - a.createdAt;
    });
  }, [logs, startDate, endDate, filterPersonId]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, typeof logs>();
    for (const log of filteredLogs) {
      if (!map.has(log.date)) {
        map.set(log.date, []);
      }
      map.get(log.date)!.push(log);
    }
    return map;
  }, [filteredLogs]);

  const sortedDates = useMemo(() => {
    return Array.from(logsByDate.keys()).sort((a, b) => b.localeCompare(a));
  }, [logsByDate]);

  const getPersonName = (id: string) => persons.find((p) => p.id === id)?.name || '未知';
  const filterPerson = filterPersonId ? persons.find((p) => p.id === filterPersonId) : null;

  const totalStats = useMemo(() => {
    let totalDuration = 0;
    let totalCells = 0;
    let totalArtifacts = 0;
    const personDays = new Set<string>();
    for (const log of filteredLogs) {
      totalDuration += calculateTotalDuration(log.timeSlots);
      totalCells += log.newlyExposedCellIds.length;
      totalArtifacts += log.newlyArtifactIds.length;
      log.participantIds.forEach((pid) => personDays.add(`${log.date}-${pid}`));
    }
    return {
      logCount: filteredLogs.length,
      dayCount: sortedDates.length,
      totalDuration,
      totalCells,
      totalArtifacts,
      personDayCount: personDays.size,
    };
  }, [filteredLogs, sortedDates]);

  const handleSaveEdit = () => {
    if (!editingLog) return;
    updateLog(editingLog.id, { summary: editingLog.summary });
    setEditingLog(null);
  };

  const truncateSummary = (text: string, maxLen = 50) => {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '…';
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setFilterPersonId('');
  };

  const hasFilters = startDate || endDate || filterPersonId;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">发掘时间线</h2>
        <p className="text-sm text-gray-500 mt-1">按日期倒序查看所有发掘日志</p>
      </div>

      <div className="mb-4 bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">日期:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            />
            <span className="text-gray-400">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
            <span className="text-sm text-gray-600">参与人:</span>
            <select
              value={filterPersonId}
              onChange={(e) => setFilterPersonId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none min-w-[140px]"
            >
              <option value="">全部人员</option>
              {sortedPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
            >
              清除筛选
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-6 gap-3 pt-4 border-t border-gray-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-earth-700">{totalStats.logCount}</div>
            <div className="text-xs text-gray-500">日志数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-earth-700">{totalStats.dayCount}</div>
            <div className="text-xs text-gray-500">工作天数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-700">{totalStats.personDayCount}</div>
            <div className="text-xs text-gray-500">人·天</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-700">
              {formatDuration(totalStats.totalDuration)}
            </div>
            <div className="text-xs text-gray-500">总工时</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-700">{totalStats.totalCells}</div>
            <div className="text-xs text-gray-500">新揭方格</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-700">{totalStats.totalArtifacts}</div>
            <div className="text-xs text-gray-500">新出遗物</div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="font-medium text-gray-700">时间线</h3>
          {filterPerson && (
            <span className="text-xs text-earth-700 bg-earth-50 px-2 py-1 rounded border border-earth-200">
              筛选: {filterPerson.name}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-auto p-4">
          {sortedDates.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
              <svg className="w-16 h-16 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-center">
                {hasFilters
                  ? '当前筛选条件下没有发掘日志'
                  : logs.length === 0
                  ? '暂无发掘日志，请先在"发掘日志"页面记录'
                  : '没有符合条件的日志'}
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-8">
                {sortedDates.map((date) => {
                  const dayLogs = logsByDate.get(date)!;
                  const dayOfWeek = new Date(date).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const dayTotalDuration = dayLogs.reduce(
                    (acc, l) => acc + calculateTotalDuration(l.timeSlots),
                    0
                  );
                  const dayTotalPersons = new Set(
                    dayLogs.flatMap((l) => l.participantIds)
                  ).size;
                  const dayTotalCells = dayLogs.reduce(
                    (acc, l) => acc + l.newlyExposedCellIds.length,
                    0
                  );
                  const dayTotalArtifacts = dayLogs.reduce(
                    (acc, l) => acc + l.newlyArtifactIds.length,
                    0
                  );

                  return (
                    <div key={date} className="relative pl-12">
                      <div className="absolute left-0 w-8 h-8 rounded-full bg-earth-500 text-white flex items-center justify-center text-xs font-bold shadow-md z-10 border-4 border-white">
                        {date.slice(-2)}
                      </div>

                      <div className="mb-3 flex items-center gap-3 flex-wrap">
                        <span
                          className={`text-base font-bold ${
                            isWeekend ? 'text-red-600' : 'text-gray-800'
                          }`}
                        >
                          {date}
                          <span className="text-sm font-normal text-gray-400 ml-1.5">
                            {['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek]}
                          </span>
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {dayLogs.length} 条记录
                        </span>
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                          {formatDuration(dayTotalDuration)}
                        </span>
                        <span className="text-xs text-earth-700 bg-earth-50 px-2 py-0.5 rounded border border-earth-100">
                          {dayTotalPersons} 人次
                        </span>
                        {dayTotalCells > 0 && (
                          <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {dayTotalCells} 方格
                          </span>
                        )}
                        {dayTotalArtifacts > 0 && (
                          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                            {dayTotalArtifacts} 遗物
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        {dayLogs.map((log) => {
                          const isExpanded = expandedLogId === log.id;
                          const logDuration = calculateTotalDuration(log.timeSlots);
                          const isEditing = editingLog?.id === log.id;

                          return (
                            <div
                              key={log.id}
                              className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden transition-shadow hover:shadow-sm"
                            >
                              <div
                                className="p-4 cursor-pointer"
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                      <span className="text-2xl leading-none">
                                        {WEATHER_ICONS[log.weather].emoji}
                                      </span>
                                      <span className="text-sm font-medium text-earth-700 bg-earth-50 px-2 py-0.5 rounded border border-earth-100">
                                        {log.participantIds.length} 人
                                      </span>
                                      <span className="text-sm font-medium text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                                        {formatDuration(logDuration)}
                                      </span>
                                      {log.newlyExposedCellIds.length > 0 && (
                                        <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                          +{log.newlyExposedCellIds.length} 方格
                                        </span>
                                      )}
                                      {log.newlyArtifactIds.length > 0 && (
                                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                          +{log.newlyArtifactIds.length} 遗物
                                        </span>
                                      )}
                                    </div>
                                    {isEditing ? (
                                      <textarea
                                        value={editingLog.summary}
                                        onChange={(e) =>
                                          setEditingLog({ ...editingLog, summary: e.target.value })
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full px-3 py-2 border border-earth-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none bg-white"
                                        rows={3}
                                        autoFocus
                                      />
                                    ) : (
                                      <p className="text-sm text-gray-700 leading-relaxed">
                                        {log.summary ? (
                                          <span>
                                            {isExpanded ? log.summary : truncateSummary(log.summary)}
                                            {!isExpanded && log.summary.length > 50 && (
                                              <span className="text-xs text-gray-400 ml-1">
                                                展开查看
                                              </span>
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 italic">（无操作摘要）</span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex-shrink-0 flex items-center gap-1">
                                    {isEditing ? (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSaveEdit();
                                          }}
                                          className="px-2.5 py-1 text-xs bg-earth-600 text-white rounded hover:bg-earth-700"
                                        >
                                          保存
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLog(null);
                                          }}
                                          className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-100"
                                        >
                                          取消
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLog({ id: log.id, summary: log.summary });
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                          title="编辑摘要"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`确定删除 ${log.date} 的日志吗？`)) {
                                              deleteLog(log.id);
                                            }
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                          title="删除日志"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                        <svg
                                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3 text-sm bg-white">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="text-xs text-gray-500 mb-1">工作时段</div>
                                      <div className="space-y-1">
                                        {log.timeSlots.map((s, idx) => (
                                          <div
                                            key={s.id}
                                            className="text-gray-700 bg-gray-50 px-2.5 py-1 rounded inline-flex items-center mr-2 mb-1"
                                          >
                                            <span className="w-4 h-4 bg-earth-200 rounded-full text-earth-800 text-xs inline-flex items-center justify-center mr-2">
                                              {idx + 1}
                                            </span>
                                            {s.startTime} – {s.endTime}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-gray-500 mb-1">天气</div>
                                      <div className="text-gray-700">
                                        {WEATHER_ICONS[log.weather].emoji} {WEATHER_ICONS[log.weather].label}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1.5">
                                      参与人员 ({log.participantIds.length})
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {log.participantIds.map((pid) => {
                                        const p = persons.find((pp) => pp.id === pid);
                                        const isFiltered = pid === filterPersonId;
                                        return (
                                          <span
                                            key={pid}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setFilterPersonId(isFiltered ? '' : pid);
                                            }}
                                            className={`px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                                              isFiltered
                                                ? 'bg-earth-600 text-white'
                                                : 'bg-earth-50 text-earth-700 border border-earth-100 hover:bg-earth-100'
                                            }`}
                                          >
                                            {p?.name || '未知'}
                                            {p && (
                                              <span className="opacity-70 ml-1">({p.role})</span>
                                            )}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  {(log.newlyExposedCellIds.length > 0 ||
                                    log.newlyArtifactIds.length > 0) && (
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                                      {log.newlyExposedCellIds.length > 0 && (
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1.5">
                                            当日新揭方格 ({log.newlyExposedCellIds.length})
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {log.newlyExposedCellIds.map((cid) => (
                                              <span
                                                key={cid}
                                                className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100"
                                              >
                                                {cid}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {log.newlyArtifactIds.length > 0 && (
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1.5">
                                            当日新出遗物 ({log.newlyArtifactIds.length})
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {log.newlyArtifactIds.slice(0, 20).map((aid) => (
                                              <span
                                                key={aid}
                                                className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100"
                                              >
                                                {aid}
                                              </span>
                                            ))}
                                            {log.newlyArtifactIds.length > 20 && (
                                              <span className="text-xs text-amber-600 px-2 py-0.5">
                                                +{log.newlyArtifactIds.length - 20}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
