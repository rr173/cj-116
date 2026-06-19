import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { useSampleStore } from '../store/useSampleStore';
import { PermissionAction, SystemRole } from '../types';
import { hasPermission } from '../utils';

interface UsePermissionReturn {
  currentRole: SystemRole | null;
  currentUserId: string | null;
  can: (action: PermissionAction) => boolean;
  canEdit: (createdBy?: string) => boolean;
  canDelete: (createdBy?: string) => boolean;
  canEditStratigraphy: (stratigraphyId: string) => boolean;
  canDeleteStratigraphy: (stratigraphyId: string) => boolean;
  canEditArtifact: (artifactId: string) => boolean;
  canDeleteArtifact: (artifactId: string) => boolean;
  canEditSample: (sampleId: string) => boolean;
  canDeleteSample: (sampleId: string) => boolean;
  isAdmin: boolean;
  isLeader: boolean;
  isRecorder: boolean;
  isGuest: boolean;
}

export const usePermission = (): UsePermissionReturn => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentRole = currentUser?.role || null;
  const currentUserId = currentUser?.id || null;

  const can = (action: PermissionAction): boolean => {
    if (!currentUser) return false;
    return hasPermission(currentUser.role, action);
  };

  const canEdit = (createdBy?: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员' || currentUser.role === '领队') {
      return true;
    }
    if (currentUser.role === '记录员') {
      return createdBy === currentUser.id;
    }
    return false;
  };

  const canDelete = (createdBy?: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员') {
      return true;
    }
    if (currentUser.role === '领队') {
      return true;
    }
    return false;
  };

  const canEditStratigraphy = (stratigraphyId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员' || currentUser.role === '领队') {
      return true;
    }
    if (currentUser.role === '记录员') {
      const strat = useAppStore.getState().stratigraphies.find((s) => s.id === stratigraphyId);
      return strat?.createdBy === currentUser.id;
    }
    return false;
  };

  const canDeleteStratigraphy = (stratigraphyId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员') {
      return true;
    }
    if (currentUser.role === '领队') {
      return true;
    }
    return false;
  };

  const canEditArtifact = (artifactId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员' || currentUser.role === '领队') {
      return true;
    }
    if (currentUser.role === '记录员') {
      const artifact = useAppStore.getState().artifacts.find((a) => a.id === artifactId);
      return artifact?.createdBy === currentUser.id;
    }
    return false;
  };

  const canDeleteArtifact = (artifactId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员') {
      return true;
    }
    if (currentUser.role === '领队') {
      return true;
    }
    return false;
  };

  const canEditSample = (sampleId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员' || currentUser.role === '领队') {
      return true;
    }
    if (currentUser.role === '记录员') {
      const sample = useSampleStore.getState().samples.find((s) => s.id === sampleId);
      return sample?.createdBy === currentUser.id;
    }
    return false;
  };

  const canDeleteSample = (sampleId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === '管理员') {
      return true;
    }
    if (currentUser.role === '领队') {
      return true;
    }
    return false;
  };

  return {
    currentRole,
    currentUserId,
    can,
    canEdit,
    canDelete,
    canEditStratigraphy,
    canDeleteStratigraphy,
    canEditArtifact,
    canDeleteArtifact,
    canEditSample,
    canDeleteSample,
    isAdmin: currentRole === '管理员',
    isLeader: currentRole === '领队',
    isRecorder: currentRole === '记录员',
    isGuest: currentRole === '访客',
  };
};
