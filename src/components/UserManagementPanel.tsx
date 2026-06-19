import { useState, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { usePermission } from '../hooks/usePermission';
import { SystemRole } from '../types';

const ROLE_OPTIONS: SystemRole[] = ['管理员', '领队', '记录员', '访客'];

const ROLE_COLORS: Record<SystemRole, string> = {
  '管理员': 'bg-purple-100 text-purple-700 border-purple-200',
  '领队': 'bg-red-100 text-red-700 border-red-200',
  '记录员': 'bg-blue-100 text-blue-700 border-blue-200',
  '访客': 'bg-gray-100 text-gray-600 border-gray-200',
};

interface FormData {
  username: string;
  password: string;
  role: SystemRole;
  personId?: string;
}

const defaultFormData: FormData = {
  username: '',
  password: '',
  role: '记录员',
  personId: undefined,
};

export default function UserManagementPanel() {
  const users = useAuthStore((state) => state.users);
  const createUser = useAuthStore((state) => state.createUser);
  const updateUser = useAuthStore((state) => state.updateUser);
  const deleteUser = useAuthStore((state) => state.deleteUser);
  const changePassword = useAuthStore((state) => state.changePassword);
  const currentUser = useAuthStore((state) => state.currentUser);
  const logOperation = useAuthStore((state) => state.logOperation);

  const persons = useAppStore((state) => state.persons);

  const { can, isAdmin } = usePermission();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [newPassword, setNewPassword] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [error, setError] = useState('');

  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        if (filterRole && u.role !== filterRole) return false;
        return true;
      })
      .sort((a, b) => a.username.localeCompare(b.username, 'zh'));
  }, [users, filterRole]);

  const getPersonName = (personId?: string) => {
    if (!personId) return '-';
    return persons.find((p) => p.id === personId)?.name || '-';
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    setError('');
    setNewPassword('');
  };

  const handleAdd = () => {
    resetForm();
    setShowAddForm(true);
    setEditingId(null);
  };

  const handleEdit = (user: typeof users[0]) => {
    setFormData({
      username: user.username,
      password: '',
      role: user.role,
      personId: user.personId,
    });
    setEditingId(user.id);
    setShowAddForm(true);
    setError('');
  };

  const handleResetPassword = (userId: string) => {
    setResetPasswordId(userId);
    setNewPassword('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.username.trim()) {
      setError('用户名不能为空');
      return;
    }

    if (!editingId && !formData.password.trim()) {
      setError('密码不能为空');
      return;
    }

    if (!editingId && formData.password.length < 6) {
      setError('密码长度不能少于6位');
      return;
    }

    try {
      if (editingId) {
        updateUser(editingId, {
          username: formData.username,
          role: formData.role,
          personId: formData.personId,
        });
        logOperation({
          operation: 'update',
          targetType: 'user',
          targetId: editingId,
          targetName: formData.username,
          details: `更新用户信息: 角色=${formData.role}, 关联人员=${getPersonName(formData.personId)}`,
        });
      } else {
        const user = await createUser({
          username: formData.username,
          password: formData.password,
          role: formData.role,
          personId: formData.personId,
        });
        if (!user) {
          setError('用户名已存在');
          return;
        }
        logOperation({
          operation: 'create',
          targetType: 'user',
          targetId: user.id,
          targetName: user.username,
          details: `创建用户: 角色=${user.role}, 关联人员=${getPersonName(user.personId)}`,
        });
      }
      setShowAddForm(false);
      setEditingId(null);
      resetForm();
    } catch (err) {
      setError('操作失败，请重试');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword.trim() || newPassword.length < 6) {
      setError('密码长度不能少于6位');
      return;
    }

    if (!resetPasswordId) return;

    try {
      await changePassword(resetPasswordId, newPassword);
      const user = users.find((u) => u.id === resetPasswordId);
      logOperation({
        operation: 'update',
        targetType: 'user',
        targetId: resetPasswordId,
        targetName: user?.username,
        details: '重置用户密码',
      });
      setResetPasswordId(null);
      setNewPassword('');
      setError('');
    } catch (err) {
      setError('操作失败，请重试');
    }
  };

  const handleDelete = (user: typeof users[0]) => {
    if (user.id === currentUser?.id) {
      alert('不能删除当前登录用户');
      return;
    }
    if (confirm(`确定删除用户 ${user.username} 吗？`)) {
      logOperation({
        operation: 'delete',
        targetType: 'user',
        targetId: user.id,
        targetName: user.username,
        details: `删除用户: ${user.username}`,
      });
      deleteUser(user.id);
    }
  };

  if (!can('user:create')) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-lg">您没有权限访问此页面</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">用户管理</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {users.length} 个用户
            {filteredUsers.length !== users.length && (
              <span className="ml-2 text-earth-600">
                (筛选显示 {filteredUsers.length} 个)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加用户
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="font-medium text-gray-700">用户列表</h3>
        </div>
        <div className="flex-1 overflow-auto">
          {filteredUsers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p>{filterRole ? '没有符合筛选条件的用户' : '暂无用户记录'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">用户名</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">角色</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">关联人员</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">创建时间</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">最后活跃</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {user.username}
                      {user.id === currentUser?.id && (
                        <span className="ml-2 text-xs text-earth-600">(当前用户)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${ROLE_COLORS[user.role]}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{getPersonName(user.personId)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(user.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(user.lastActiveAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-700 mr-3"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        className="text-green-600 hover:text-green-700 mr-3"
                      >
                        重置密码
                      </button>
                      {can('user:delete') && user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-red-500 hover:text-red-600"
                        >
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? '编辑用户' : '添加用户'}
              </h3>
              <button
                onClick={() => { setShowAddForm(false); setEditingId(null); resetForm(); }}
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
                  用户名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  placeholder="请输入用户名"
                  required
                />
              </div>
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    密码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    placeholder="请输入密码（至少6位）"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as SystemRole })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联人员</label>
                <select
                  value={formData.personId || ''}
                  onChange={(e) => setFormData({ ...formData, personId: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                >
                  <option value="">不关联</option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingId(null); resetForm(); }}
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

      {resetPasswordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">重置密码</h3>
              <button
                onClick={() => { setResetPasswordId(null); setNewPassword(''); setError(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  新密码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  placeholder="请输入新密码（至少6位）"
                  required
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setResetPasswordId(null); setNewPassword(''); setError(''); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors"
                >
                  确认重置
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
