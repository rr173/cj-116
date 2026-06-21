import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePermission } from '../hooks/usePermission';
import TrenchSelector from './TrenchSelector';
import { ViewType } from '../types';

interface HeaderProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const viewNames: Record<ViewType, string> = {
  grid: '方格网视图',
  stratigraphy: '地层记录',
  units: '地层单位',
  matrix: 'Harris矩阵',
  artifacts: '遗物登记',
  samples: '样品采集与送检',
  profile: '剖面图',
  features: '遗迹要素绘图与分期',
  controlPoints: '测量控制点',
  personnel: '人员库',
  logs: '发掘日志',
  workhours: '工时统计',
  timeline: '发掘时间线',
  users: '用户管理',
  operationLogs: '操作日志',
};

const ROLE_COLORS: Record<string, string> = {
  '管理员': 'bg-purple-100 text-purple-700',
  '领队': 'bg-red-100 text-red-700',
  '记录员': 'bg-blue-100 text-blue-700',
  '访客': 'bg-gray-100 text-gray-600',
};

export default function Header({ currentView, onViewChange }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const trenches = useAppStore((state) => state.trenches);
  const selectedTrench = trenches.find((t) => t.id === selectedTrenchId);

  const currentUser = useAuthStore((state) => state.currentUser);
  const logout = useAuthStore((state) => state.logout);
  const { can } = usePermission();

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
      window.location.reload();
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-earth-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800">考古发掘方格网记录系统</h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">当前视图:</span>
        <span className="text-sm font-medium text-earth-700">{viewNames[currentView]}</span>
        {selectedTrench && (
          <div className="border-l border-gray-200 pl-4 ml-2">
            <TrenchSelector />
          </div>
        )}
        {currentUser && (
          <div className="border-l border-gray-200 pl-4 ml-2 relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-earth-100 rounded-full flex items-center justify-center">
                <span className="text-earth-700 font-medium text-sm">
                  {currentUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-medium text-gray-800">{currentUser.username}</div>
                <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_COLORS[currentUser.role] || 'bg-gray-100 text-gray-600'}`}>
                  {currentUser.role}
                </span>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-800">{currentUser.username}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      上次活跃: {new Date(currentUser.lastActiveAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  {can('user:create') && (
                    <button
                      onClick={() => {
                        onViewChange('users');
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      用户管理
                    </button>
                  )}
                  {can('logs:view') && (
                    <button
                      onClick={() => {
                        onViewChange('operationLogs');
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      操作日志
                    </button>
                  )}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      退出登录
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
