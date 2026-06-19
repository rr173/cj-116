import { OperationType, TargetType, PermissionAction, SystemRole } from '../types';
import { hasPermission } from './index';

const AUTH_STORAGE_KEY = 'archaeology-auth-storage';

export interface AuthUser {
  id: string;
  username: string;
  role: SystemRole;
  personId?: string;
  lastActiveAt: number;
}

export const getCurrentUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.state?.currentUser || null;
  } catch {
    return null;
  }
};

export const getCurrentUserId = (): string | null => {
  return getCurrentUser()?.id || null;
};

export const getCurrentUserRole = (): SystemRole | null => {
  return getCurrentUser()?.role || null;
};

export const checkActionPermission = (action: PermissionAction): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  return hasPermission(user.role, action);
};

export const canEditOwnData = (createdBy?: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;

  if (user.role === '管理员' || user.role === '领队') {
    return true;
  }

  if (user.role === '记录员') {
    return createdBy === user.id;
  }

  return false;
};

export const canDeleteOwnData = (createdBy?: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;

  if (user.role === '管理员') {
    return true;
  }

  if (user.role === '领队') {
    return true;
  }

  return false;
};

export const logOperationToStorage = (data: {
  operation: OperationType;
  targetType: TargetType;
  targetId: string;
  targetName?: string;
  details: string;
}) => {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const storage = raw ? JSON.parse(raw) : { state: {} };
    if (!storage.state) storage.state = {};
    if (!storage.state.operationLogs) storage.state.operationLogs = [];

    const log = {
      id: crypto.randomUUID(),
      userId: user.id,
      username: user.username,
      operation: data.operation,
      targetType: data.targetType,
      targetId: data.targetId,
      targetName: data.targetName,
      details: data.details,
      timestamp: Date.now(),
    };

    storage.state.operationLogs.push(log);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(storage));
  } catch (e) {
    console.error('Failed to log operation:', e);
  }
};
