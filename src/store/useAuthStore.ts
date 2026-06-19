import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  User,
  SystemRole,
  OperationLog,
  OperationType,
  TargetType,
} from '../types';
import {
  generateId,
  hashPassword,
  verifyPassword,
  isSessionExpired,
} from '../utils';

interface AuthState {
  users: User[];
  currentUser: User | null;
  operationLogs: OperationLog[];

  initDefaultAdmin: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkSession: () => boolean;
  updateLastActive: () => void;

  createUser: (data: {
    username: string;
    password: string;
    role: SystemRole;
    personId?: string;
  }) => Promise<User | null>;
  updateUser: (id: string, data: Partial<Omit<User, 'id' | 'passwordHash' | 'createdAt'>>) => void;
  changePassword: (id: string, newPassword: string) => Promise<void>;
  deleteUser: (id: string) => void;
  getUserById: (id: string) => User | undefined;
  getUserByUsername: (username: string) => User | undefined;

  logOperation: (data: {
    operation: OperationType;
    targetType: TargetType;
    targetId: string;
    targetName?: string;
    details: string;
  }) => void;

  queryLogs: (params?: {
    userId?: string;
    startDate?: number;
    endDate?: number;
    operation?: OperationType;
    targetType?: TargetType;
  }) => OperationLog[];
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: [],
      currentUser: null,
      operationLogs: [],

      initDefaultAdmin: async () => {
        const state = get();
        if (state.users.length === 0) {
          const passwordHash = await hashPassword('admin123');
          const admin: User = {
            id: generateId(),
            username: 'admin',
            passwordHash,
            role: '管理员',
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
          };
          set({ users: [admin] });
        }
      },

      login: async (username: string, password: string) => {
        const state = get();
        const user = state.users.find((u) => u.username === username);
        if (!user) return false;

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) return false;

        const updatedUser = { ...user, lastActiveAt: Date.now() };
        set({
          users: state.users.map((u) => (u.id === user.id ? updatedUser : u)),
          currentUser: updatedUser,
        });
        return true;
      },

      logout: () => {
        set({ currentUser: null });
      },

      checkSession: () => {
        const state = get();
        if (!state.currentUser) return false;
        if (isSessionExpired(state.currentUser.lastActiveAt)) {
          set({ currentUser: null });
          return false;
        }
        return true;
      },

      updateLastActive: () => {
        const state = get();
        if (!state.currentUser) return;
        const updatedUser = { ...state.currentUser, lastActiveAt: Date.now() };
        set({
          users: state.users.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
          currentUser: updatedUser,
        });
      },

      createUser: async (data) => {
        const state = get();
        if (state.users.some((u) => u.username === data.username)) {
          return null;
        }
        const passwordHash = await hashPassword(data.password);
        const user: User = {
          id: generateId(),
          username: data.username,
          passwordHash,
          role: data.role,
          personId: data.personId,
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        };
        set((state) => ({ users: [...state.users, user] }));
        return user;
      },

      updateUser: (id, data) => {
        set((state) => ({
          users: state.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
          currentUser:
            state.currentUser?.id === id
              ? { ...state.currentUser, ...data }
              : state.currentUser,
        }));
      },

      changePassword: async (id, newPassword) => {
        const passwordHash = await hashPassword(newPassword);
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, passwordHash } : u
          ),
        }));
      },

      deleteUser: (id) => {
        set((state) => ({
          users: state.users.filter((u) => u.id !== id),
          currentUser: state.currentUser?.id === id ? null : state.currentUser,
        }));
      },

      getUserById: (id) => {
        return get().users.find((u) => u.id === id);
      },

      getUserByUsername: (username) => {
        return get().users.find((u) => u.username === username);
      },

      logOperation: (data) => {
        const state = get();
        if (!state.currentUser) return;

        const log: OperationLog = {
          id: generateId(),
          userId: state.currentUser.id,
          username: state.currentUser.username,
          operation: data.operation,
          targetType: data.targetType,
          targetId: data.targetId,
          targetName: data.targetName,
          details: data.details,
          timestamp: Date.now(),
        };

        set((state) => ({ operationLogs: [...state.operationLogs, log] }));
      },

      queryLogs: (params) => {
        let logs = [...get().operationLogs];

        if (params?.userId) {
          logs = logs.filter((l) => l.userId === params.userId);
        }
        if (params?.startDate !== undefined) {
          logs = logs.filter((l) => l.timestamp >= params.startDate!);
        }
        if (params?.endDate !== undefined) {
          logs = logs.filter((l) => l.timestamp <= params.endDate!);
        }
        if (params?.operation) {
          logs = logs.filter((l) => l.operation === params.operation);
        }
        if (params?.targetType) {
          logs = logs.filter((l) => l.targetType === params.targetType);
        }

        return logs.sort((a, b) => b.timestamp - a.timestamp);
      },
    }),
    {
      name: 'archaeology-auth-storage',
    }
  )
);
