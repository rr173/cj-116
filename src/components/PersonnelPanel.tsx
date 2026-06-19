import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PersonRole, PersonStatus } from '../types';
import { calculatePersonWorkHours, formatDuration } from '../utils';

const ROLE_OPTIONS: PersonRole[] = ['领队', '技工', '学生', '志愿者'];
const STATUS_OPTIONS: PersonStatus[] = ['在岗', '离场'];

const ROLE_COLORS: Record<PersonRole, string> = {
  '领队': 'bg-red-100 text-red-700 border-red-200',
  '技工': 'bg-blue-100 text-blue-700 border-blue-200',
  '学生': 'bg-green-100 text-green-700 border-green-200',
  '志愿者': 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

interface FormData {
  name: string;
  role: PersonRole;
  organization: string;
  phone: string;
  status: PersonStatus;
}

const defaultFormData: FormData = {
  name: '',
  role: '学生',
  organization: '',
  phone: '',
  status: '在岗',
};

export default function PersonnelPanel() {
  const persons = useAppStore((state) => state.persons);
  const logs = useAppStore((state) => state.excavationLogs);
  const addPerson = useAppStore((state) => state.addPerson);
  const updatePerson = useAppStore((state) => state.updatePerson);
  const deletePerson = useAppStore((state) => state.deletePerson);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const filteredPersons = useMemo(() => {
    return persons.filter((p) => {
      if (filterRole && p.role !== filterRole) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [persons, filterRole, filterStatus]);

  const statsByRole = useMemo(() => {
    const stats = new Map<PersonRole, { total: number; active: number }>();
    ROLE_OPTIONS.forEach((r) => stats.set(r, { total: 0, active: 0 }));
    persons.forEach((p) => {
      const s = stats.get(p.role)!;
      s.total++;
      if (p.status === '在岗') s.active++;
    });
    return stats;
  }, [persons]);

  const resetForm = () => {
    setFormData(defaultFormData);
  };

  const handleAdd = () => {
    resetForm();
    setShowAddForm(true);
    setEditingId(null);
  };

  const handleEdit = (person: typeof persons[0]) => {
    setFormData({
      name: person.name,
      role: person.role,
      organization: person.organization,
      phone: person.phone,
      status: person.status,
    });
    setEditingId(person.id);
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingId) {
      updatePerson(editingId, formData);
    } else {
      addPerson(formData);
    }
    setShowAddForm(false);
    setEditingId(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">人员库</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {persons.length} 人
            {filteredPersons.length !== persons.length && (
              <span className="ml-2 text-earth-600">
                (筛选显示 {filteredPersons.length} 人)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
          >
            <option value="">全部角色</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
          >
            <option value="">全部状态</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加人员
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 overflow-hidden flex-1">
        <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="font-medium text-gray-700">人员列表</h3>
            {filteredPersons.length > 0 && (
              <span className="text-sm text-gray-500">{filteredPersons.length} 条记录</span>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {filteredPersons.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p>{filterRole || filterStatus ? '没有符合筛选条件的人员' : '暂无人员记录'}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">姓名</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">角色</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">单位</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">电话</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">状态</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">累计工时</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPersons.map((person) => {
                    const hours = calculatePersonWorkHours(person.id, logs);
                    return (
                      <tr key={person.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{person.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${ROLE_COLORS[person.role]}`}>
                            {person.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{person.organization || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{person.phone || '-'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full border ${
                              person.status === '在岗'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {person.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-earth-700 font-medium">
                          {formatDuration(hours.totalMinutes)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleEdit(person)}
                            className="text-blue-600 hover:text-blue-700 mr-3"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`确定删除 ${person.name} 吗？`)) {
                                deletePerson(person.id);
                              }
                            }}
                            className="text-red-500 hover:text-red-600"
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

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-700">按角色统计</h3>
            </div>
            <div className="p-4 space-y-3">
              {ROLE_OPTIONS.map((role) => {
                const data = statsByRole.get(role)!;
                return (
                  <div key={role} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${ROLE_COLORS[role]}`}>
                          {role}
                        </span>
                      </div>
                      <span className="text-gray-500">
                        {data.active}在岗 / {data.total}总
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-earth-500 transition-all"
                        style={{ width: `${persons.length > 0 ? (data.total / persons.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-700">在岗情况</h3>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">在岗人数</span>
                <span className="font-medium text-green-700">
                  {persons.filter((p) => p.status === '在岗').length} 人
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">离场人数</span>
                <span className="font-medium text-gray-500">
                  {persons.filter((p) => p.status === '离场').length} 人
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? '编辑人员' : '添加人员'}
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
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  placeholder="请输入姓名"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as PersonRole })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as PersonStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">单位 / 学校</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  placeholder="请输入单位或学校名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  placeholder="请输入联系电话"
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
                  {editingId ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
