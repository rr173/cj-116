import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PersonRole } from '../types';
import {
  calculatePersonWorkHours,
  formatDuration,
  minutesToHours,
  getDateRange,
} from '../utils';

const ROLE_OPTIONS: (PersonRole | '全部')[] = ['全部', '领队', '技工', '学生', '志愿者'];

export default function WorkHoursPanel() {
  const persons = useAppStore((state) => state.persons);
  const logs = useAppStore((state) => state.excavationLogs);

  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterRole, setFilterRole] = useState<PersonRole | '全部'>('全部');

  const allDates = useMemo(() => {
    const dates = new Set(logs.map((l) => l.date));
    const arr = Array.from(dates).sort();
    return arr;
  }, [logs]);

  const sortedPersons = useMemo(() => {
    let result = [...persons];
    if (filterRole !== '全部') {
      result = result.filter((p) => p.role === filterRole);
    }
    return result.sort((a, b) => {
      const ha = calculatePersonWorkHours(a.id, logs, startDate || undefined, endDate || undefined);
      const hb = calculatePersonWorkHours(b.id, logs, startDate || undefined, endDate || undefined);
      return hb.totalMinutes - ha.totalMinutes;
    });
  }, [persons, logs, filterRole, startDate, endDate]);

  const selectedPerson = useMemo(
    () => persons.find((p) => p.id === selectedPersonId),
    [persons, selectedPersonId]
  );

  const selectedHours = useMemo(() => {
    if (!selectedPersonId) return null;
    return calculatePersonWorkHours(selectedPersonId, logs, startDate || undefined, endDate || undefined);
  }, [selectedPersonId, logs, startDate, endDate]);

  const distributionDates = useMemo(() => {
    if (!selectedHours) return [];
    let dates: string[];
    if (startDate && endDate) {
      dates = getDateRange(startDate, endDate);
    } else {
      dates = Object.keys(selectedHours.dailyMinutes).sort();
    }
    return dates;
  }, [selectedHours, startDate, endDate]);

  const maxDailyMinutes = useMemo(() => {
    if (!selectedHours) return 0;
    return Math.max(...distributionDates.map((d) => selectedHours.dailyMinutes[d] || 0), 1);
  }, [selectedHours, distributionDates]);

  const totalAllMinutes = useMemo(() => {
    return sortedPersons.reduce((total, p) => {
      const h = calculatePersonWorkHours(p.id, logs, startDate || undefined, endDate || undefined);
      return total + h.totalMinutes;
    }, 0);
  }, [sortedPersons, logs, startDate, endDate]);

  const handleQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    const format = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    setStartDate(format(start));
    setEndDate(format(end));
  };

  const clearRange = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">工时统计</h2>
        <p className="text-sm text-gray-500 mt-1">
          自动从发掘日志累计，同一人同日时段交叉不重复计算
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">日期范围:</span>
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
          <button
            onClick={() => handleQuickRange(7)}
            className="text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            近7天
          </button>
          <button
            onClick={() => handleQuickRange(30)}
            className="text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            近30天
          </button>
          {(startDate || endDate) && (
            <button
              onClick={clearRange}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              清除
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
          <span className="text-sm text-gray-600">角色:</span>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as PersonRole | '全部')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-5 gap-4 overflow-hidden">
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-700">人员工时排行</h3>
              <span className="text-xs text-gray-500">
                合计 {formatDuration(totalAllMinutes)}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {sortedPersons.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>暂无工时数据</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedPersons.map((p, idx) => {
                  const h = calculatePersonWorkHours(p.id, logs, startDate || undefined, endDate || undefined);
                  const isSelected = selectedPersonId === p.id;
                  const maxMin = sortedPersons.length > 0
                    ? calculatePersonWorkHours(sortedPersons[0].id, logs, startDate || undefined, endDate || undefined).totalMinutes
                    : 1;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPersonId(isSelected ? '' : p.id)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-earth-50 border-l-4 border-l-earth-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-medium text-gray-800 truncate">{p.name}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">({p.role})</span>
                        </div>
                        <span className="text-sm font-semibold text-earth-700 flex-shrink-0 ml-2">
                          {formatDuration(h.totalMinutes)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-earth-400 to-earth-600 transition-all"
                          style={{ width: `${maxMin > 0 ? (h.totalMinutes / maxMin) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            {selectedPerson && selectedHours ? (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-700">
                    {selectedPerson.name} 的工时分布
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ({selectedPerson.role} · {selectedPerson.organization || '—'})
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    共 {Object.keys(selectedHours.dailyMinutes).length} 天有工时记录
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-earth-700">
                    {minutesToHours(selectedHours.totalMinutes)}
                    <span className="text-sm font-normal text-gray-500 ml-1">小时</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDuration(selectedHours.totalMinutes)}
                  </div>
                </div>
              </div>
            ) : (
              <h3 className="font-medium text-gray-700">每日工时分布</h3>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {!selectedPerson || !selectedHours ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <svg className="w-16 h-16 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-center">
                  {sortedPersons.length === 0
                    ? '暂无工时数据，请先记录发掘日志'
                    : '点击左侧列表中的人员查看每日工时分布'}
                </p>
              </div>
            ) : distributionDates.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>所选范围内没有工时记录</p>
              </div>
            ) : (
              <div>
                <div className="space-y-2">
                  {distributionDates.map((date) => {
                    const mins = selectedHours.dailyMinutes[date] || 0;
                    const pct = (mins / maxDailyMinutes) * 100;
                    const dayOfWeek = new Date(date).getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    return (
                      <div key={date} className="flex items-center gap-3">
                        <span className={`text-xs w-24 flex-shrink-0 ${isWeekend ? 'text-red-500' : 'text-gray-500'}`}>
                          {date}
                          <span className="text-gray-400 ml-1">
                            {['日', '一', '二', '三', '四', '五', '六'][dayOfWeek]}
                          </span>
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                          <div
                            className={`h-full rounded-full transition-all ${
                              mins > 0
                                ? mins >= 480
                                  ? 'bg-gradient-to-r from-green-400 to-green-600'
                                  : 'bg-gradient-to-r from-earth-400 to-earth-600'
                                : ''
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                          {mins > 0 && (
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-800">
                              {formatDuration(mins)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">统计摘要</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-earth-50 rounded-lg p-3 border border-earth-100">
                      <div className="text-xs text-earth-600">总工时</div>
                      <div className="text-lg font-bold text-earth-800 mt-0.5">
                        {formatDuration(selectedHours.totalMinutes)}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <div className="text-xs text-blue-600">出工天数</div>
                      <div className="text-lg font-bold text-blue-800 mt-0.5">
                        {Object.keys(selectedHours.dailyMinutes).filter((d) => selectedHours.dailyMinutes[d] > 0).length} 天
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <div className="text-xs text-green-600">日均工时</div>
                      <div className="text-lg font-bold text-green-800 mt-0.5">
                        {(() => {
                          const days = Object.keys(selectedHours.dailyMinutes).filter(
                            (d) => selectedHours.dailyMinutes[d] > 0
                          ).length;
                          return days > 0
                            ? formatDuration(Math.round(selectedHours.totalMinutes / days))
                            : '—';
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
