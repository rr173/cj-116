import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { PermissionAction, SystemRole } from '../types';
import { hasPermission } from '../utils';

interface UsePermissionReturn {
  currentRole: SystemRole | null;
  can: (action: PermissionAction) => boolean;
  canAccessCell: (cellId: string) => boolean;
  canAccessStratigraphy: (stratigraphyId: string) => boolean;
  canAccessArtifact: (artifactId: string) => boolean;
  isAdmin: boolean;
  isLeader: boolean;
  isRecorder: boolean;
  isGuest: boolean;
}

export const usePermission = (): UsePermissionReturn => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const getCellById = useAppStore((state) => state.getCellById);
  const getStratigraphiesByCell = useAppStore((state) => state.getStratigraphiesByCell);
  const getArtifactsByCell = useAppStore((state) => state.getArtifactsByCell);
  const getLogsByPerson = useAppStore((state) => state.getLogsByPerson);

  const currentRole = currentUser?.role || null;

  const can = (action: PermissionAction): boolean => {
    if (!currentUser) return false;
    return hasPermission(currentUser.role, action);
  };

  const getParticipatedCellIds = (): string[] => {
    if (!currentUser?.personId) return [];
    const logs = getLogsByPerson(currentUser.personId);
    const cellIds = new Set<string>();
    logs.forEach((log) => {
      log.newlyExposedCellIds.forEach((id) => cellIds.add(id));
    });
    return Array.from(cellIds);
  };

  const canAccessCell = (cellId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员' || currentUser.role === '领队' || currentUser.role === '访客') {
      return true;
    }
    if (currentUser.role === '记录员') {
      const participatedCellIds = getParticipatedCellIds();
      return participatedCellIds.includes(cellId);
    }
    return false;
  };

  const canAccessStratigraphy = (stratigraphyId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员' || currentUser.role === '领队' || currentUser.role === '访客') {
      return true;
    }
    if (currentUser.role === '记录员') {
      const allStratigraphies = useAppStore.getState().stratigraphies;
      const strat = allStratigraphies.find((s) => s.id === stratigraphyId);
      if (!strat) return false;
      return canAccessCell(strat.cellId);
    }
    return false;
  };

  const canAccessArtifact = (artifactId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员' || currentUser.role === '领队' || currentUser.role === '访客') {
      return true;
    }
    if (currentUser.role === '记录员') {
      const allArtifacts = useAppStore.getState().artifacts;
      const artifact = allArtifacts.find((a) => a.id === artifactId);
      if (!artifact) return false;
      return canAccessCell(artifact.cellId);
    }
    return false;
  };

  return {
    currentRole,
    can,
    canAccessCell,
    canAccessStratigraphy,
    canAccessArtifact,
    isAdmin: currentRole === '管理员',
    isLeader: currentRole === '领队',
    isRecorder: currentRole === '记录员',
    isGuest: currentRole === '访客',
  };
};
