import { useState, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { usePermission } from '../hooks/usePermission';
import { OperationType, TargetType } from '../types';

const OPERATION_OPTIONS: { value: OperationType | ''; label: string }[] = [
  { value: '', label: '全部操作' },
  { value: 'create', label: '创建' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
];

const TARGET_TYPE_OPTIONS: { value: TargetType | ''; label: string }[] = [
  { value: '', label: '全部类型' },
  { value: 'trench', label: '发掘区' },
  { value: 'stratigraphy', label: '地层' },
  { value: 'unit', label: '地层单位' },
  { value: 'artifact', label: '遗物' },
  { value: 'person', label: '人员' },
  { value: 'excavationLog', label: '发掘日志' },
  { value: 'relation', label: '地层关系' },
  { value: 'sample', label: '样品' },
  { value: 'user', label: '用户' },
];

const OPERATION_COLORS: Record<OperationType, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
};

const OPERATION_LABELS: Record<OperationType, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
};

const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  trench: '发掘区',
  stratigraphy: '地层',
  unit: '地层单位',
  artifact: '遗物',
  person: '人员',
  excavationLog: '发掘日志',
  relation: '地层关系',
  sample: '样品',
  user: '用户',
};

export default function OperationLogsPanel() {
  const users = useAuthStore((state) => state.users);
  const queryLogs = useAuthStore((state) => state.queryLogs);
  const { can } = usePermission();

  const [filterUserId, setFilterUserId] = useState<string>('');
  const [filterOperation, setFilterOperation] = useState<OperationType | ''>('');
  const [filterTargetType, setFilterTargetType] = useState<TargetType | ''>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredLogs = useMemo(() => {
    const params: Parameters<typeof queryLogs>[0] = {};
    if (filterUserId) params.userId = filterUserId;
    if (filterOperation) params.operation = filterOperation;
    if (filterTargetType) params.targetType = filterTargetType;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      params.startDate = start.getTime();
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      params.endDate = end.getTime();
    }
    return queryLogs(params);
  }, [queryLogs, filterUserId, filterOperation, filterTargetType, startDate, endDate]);

  const getUsername = (userId: string) => {
    return users.find((u) => u.id === userId)?.username || '未知用户';
  };

  const resetFilters = () => {
    setFilterUserId('');
    setFilterOperation('');
    setFilterTargetType('');
    setStartDate('');
    setEndDate('');
  };

  if (!can('logs:view')) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg">您没有权限查看操作日志</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">操作日志</h2>
        <p className="text-sm text-gray-500 mt-1">
          共 {filteredLogs.length} 条记录
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">操作人</label>
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            >
              <option value="">全部用户</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">操作类型</label>
            <select
              value={filterOperation}
              onChange={(e) => setFilterOperation(e.target.value as OperationType | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            >
              {OPERATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">对象类型</label>
            <select
              value={filterTargetType}
              onChange={(e) => setFilterTargetType(e.target.value as TargetType | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            >
              {TARGET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={resetFilters}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            重置筛选
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="font-medium text-gray-700">日志列表</h3>
        </div>
        <div className="flex-1 overflow-auto">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>{filterUserId || filterOperation || filterTargetType || startDate || endDate ? '没有符合筛选条件的日志' : '暂无操作记录'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">操作时间</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">操作人</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">操作</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">对象类型</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">对象名称</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">详情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {log.username}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${OPERATION_COLORS[log.operation]}`}>
                        {OPERATION_LABELS[log.operation]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {TARGET_TYPE_LABELS[log.targetType]}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      {log.targetName || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
