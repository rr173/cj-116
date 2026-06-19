import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Trench,
  GridCell,
  Stratigraphy,
  StratigraphicUnit,
  StratigraphicRelation,
  Artifact,
  RelationType,
  Person,
  PersonRole,
  PersonStatus,
  ExcavationLog,
  TimeSlot,
  WeatherType,
  PermissionAction,
  TargetType,
} from '../types';
import {
  generateId,
  generateGridCells,
  calculateThickness,
  validateElevationOrder,
  getUnitColor,
  formatDate,
  timestampToDateString,
  hasPermission,
} from '../utils';

interface AppState {
  trenches: Trench[];
  cells: GridCell[];
  stratigraphies: Stratigraphy[];
  units: StratigraphicUnit[];
  relations: StratigraphicRelation[];
  artifacts: Artifact[];
  persons: Person[];
  excavationLogs: ExcavationLog[];
  selectedTrenchId: string | null;
  selectedCellId: string | null;
  selectedUnitId: string | null;

  createTrench: (data: Omit<Trench, 'id' | 'createdAt'>) => Trench;
  deleteTrench: (id: string) => void;
  setSelectedTrench: (id: string | null) => void;
  setSelectedCell: (id: string | null) => void;
  setSelectedUnit: (id: string | null) => void;

  getCellsByTrench: (trenchId: string) => GridCell[];
  getCellById: (id: string) => GridCell | undefined;

  addStratigraphy: (data: Omit<Stratigraphy, 'id' | 'createdAt'>) => Stratigraphy | null;
  updateStratigraphy: (id: string, data: Partial<Stratigraphy>) => void;
  deleteStratigraphy: (id: string) => void;
  getStratigraphiesByCell: (cellId: string) => Stratigraphy[];
  getStratigraphiesByUnit: (unitId: string) => Stratigraphy[];
  validateStratigraphyElevation: (cellId: string, excludeId?: string) => boolean;

  createUnit: (data: Omit<StratigraphicUnit, 'id' | 'color'>) => StratigraphicUnit;
  updateUnit: (id: string, data: Partial<StratigraphicUnit>) => void;
  deleteUnit: (id: string) => void;
  assignStratigraphyToUnit: (stratigraphyId: string, unitId: string) => void;
  unassignStratigraphyFromUnit: (stratigraphyId: string) => void;

  addRelation: (data: Omit<StratigraphicRelation, 'id'>) => StratigraphicRelation;
  deleteRelation: (id: string) => void;
  getRelationsByTrench: (trenchId: string) => StratigraphicRelation[];

  addArtifact: (data: Omit<Artifact, 'id' | 'createdAt'>) => Artifact;
  updateArtifact: (id: string, data: Partial<Artifact>) => void;
  deleteArtifact: (id: string) => void;
  getArtifactsByCell: (cellId: string) => Artifact[];
  getArtifactsByUnit: (unitId: string) => Artifact[];
  getArtifactsByStratigraphy: (stratigraphyId: string) => Artifact[];

  addPerson: (data: Omit<Person, 'id' | 'createdAt'>) => Person;
  updatePerson: (id: string, data: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  getPersonById: (id: string) => Person | undefined;
  getPersonsByRole: (role: PersonRole) => Person[];
  getActivePersons: () => Person[];

  addExcavationLog: (data: Omit<ExcavationLog, 'id' | 'newlyExposedCellIds' | 'newlyArtifactIds' | 'createdAt' | 'updatedAt'>) => ExcavationLog;
  updateExcavationLog: (id: string, data: Partial<Omit<ExcavationLog, 'id' | 'newlyExposedCellIds' | 'newlyArtifactIds' | 'createdAt'>>) => void;
  deleteExcavationLog: (id: string) => void;
  getExcavationLogById: (id: string) => ExcavationLog | undefined;
  getLogsByDate: (date: string) => ExcavationLog[];
  getLogsByPerson: (personId: string) => ExcavationLog[];
  getCellsNewlyExposedOnDate: (date: string) => string[];
  getArtifactsNewlyCreatedOnDate: (date: string) => string[];
}

const getAuthState = () => {
  const authState = JSON.parse(localStorage.getItem('archaeology-auth-storage') || '{}');
  return authState.state || { currentUser: null };
};

const checkPermission = (action: PermissionAction, cellId?: string, stratigraphyId?: string, artifactId?: string): boolean => {
  const auth = getAuthState();
  if (!auth.currentUser) return false;

  if (!hasPermission(auth.currentUser.role, action)) return false;

  if (auth.currentUser.role === '记录员' && cellId) {
    const appState = JSON.parse(localStorage.getItem('archaeology-grid-storage') || '{}');
    const state = appState.state || {};
    const personId = auth.currentUser.personId;
    if (!personId) return false;

    const logs: any[] = state.excavationLogs || [];
    const participatedCellIds = new Set<string>();
    logs.forEach((log: any) => {
      if (log.participantIds?.includes(personId)) {
        log.newlyExposedCellIds?.forEach((id: string) => participatedCellIds.add(id));
      }
    });

    if (stratigraphyId) {
      const stratigraphies: any[] = state.stratigraphies || [];
      const strat = stratigraphies.find((s: any) => s.id === stratigraphyId);
      if (strat && !participatedCellIds.has(strat.cellId)) return false;
    }

    if (artifactId) {
      const artifacts: any[] = state.artifacts || [];
      const artifact = artifacts.find((a: any) => a.id === artifactId);
      if (artifact && !participatedCellIds.has(artifact.cellId)) return false;
    }

    if (cellId && !participatedCellIds.has(cellId)) return false;
  }

  return true;
};

const logOperation = (
  operation: 'create' | 'update' | 'delete',
  targetType: TargetType,
  targetId: string,
  targetName: string | undefined,
  details: string
) => {
  const auth = getAuthState();
  if (!auth.currentUser) return;

  const log = {
    id: generateId(),
    userId: auth.currentUser.id,
    username: auth.currentUser.username,
    operation,
    targetType,
    targetId,
    targetName,
    details,
    timestamp: Date.now(),
  };

  const authStorage = JSON.parse(localStorage.getItem('archaeology-auth-storage') || '{}');
  if (!authStorage.state) authStorage.state = {};
  if (!authStorage.state.operationLogs) authStorage.state.operationLogs = [];
  authStorage.state.operationLogs.push(log);
  localStorage.setItem('archaeology-auth-storage', JSON.stringify(authStorage));
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      trenches: [],
      cells: [],
      stratigraphies: [],
      units: [],
      relations: [],
      artifacts: [],
      persons: [],
      excavationLogs: [],
      selectedTrenchId: null,
      selectedCellId: null,
      selectedUnitId: null,

      createTrench: (data) => {
        if (!checkPermission('trench:create')) {
          throw new Error('没有权限创建发掘区');
        }

        const trench: Trench = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };
        const newCells = generateGridCells(trench);
        set((state) => ({
          trenches: [...state.trenches, trench],
          cells: [...state.cells, ...newCells],
          selectedTrenchId: state.selectedTrenchId || trench.id,
        }));
        logOperation('create', 'trench', trench.id, trench.name, `创建发掘区: ${trench.name} (${trench.code}), ${trench.rows}×${trench.cols}方格`);
        return trench;
      },

      deleteTrench: (id) => {
        if (!checkPermission('trench:delete')) {
          throw new Error('没有权限删除发掘区');
        }
        const trench = get().trenches.find((t) => t.id === id);
        logOperation('delete', 'trench', id, trench?.name, `删除发掘区: ${trench?.name || id}`);
        set((state) => ({
          trenches: state.trenches.filter((t) => t.id !== id),
          cells: state.cells.filter((c) => c.trenchId !== id),
          stratigraphies: state.stratigraphies.filter((s) => s.trenchId !== id),
          units: state.units.filter((u) => u.trenchId !== id),
          relations: state.relations.filter((r) => r.trenchId !== id),
          artifacts: state.artifacts.filter((a) => a.trenchId !== id),
          selectedTrenchId: state.selectedTrenchId === id ? null : state.selectedTrenchId,
          selectedCellId: null,
        }));
      },

      setSelectedTrench: (id) => set({ selectedTrenchId: id, selectedCellId: null }),
      setSelectedCell: (id) => set({ selectedCellId: id }),
      setSelectedUnit: (id) => set({ selectedUnitId: id }),

      getCellsByTrench: (trenchId) => {
        return get().cells.filter((c) => c.trenchId === trenchId);
      },

      getCellById: (id) => {
        return get().cells.find((c) => c.id === id);
      },

      addStratigraphy: (data) => {
        if (!checkPermission('stratigraphy:create', data.cellId)) {
          throw new Error('没有权限在此方格录入地层');
        }

        const strat: Stratigraphy = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };

        const state = get();
        const cellStrats = state.stratigraphies
          .filter((s) => s.cellId === data.cellId)
          .concat(strat);

        if (!validateElevationOrder(cellStrats)) {
          return null;
        }

        set((state) => ({
          stratigraphies: [...state.stratigraphies, strat],
        }));
        const cell = get().getCellById(data.cellId);
        logOperation('create', 'stratigraphy', strat.id, `第${strat.layerNumber}层`, `录入地层: ${cell?.code || data.cellId} 第${strat.layerNumber}层, 海拔${strat.topElevation}-${strat.bottomElevation}m`);
        return strat;
      },

      updateStratigraphy: (id, data) => {
        if (!checkPermission('stratigraphy:edit', undefined, id)) {
          throw new Error('没有权限编辑此地层');
        }
        const existing = get().stratigraphies.find((s) => s.id === id);
        if (!existing) return;
        const cell = get().getCellById(existing.cellId);
        const changes = Object.keys(data).map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`).join(', ');
        logOperation('update', 'stratigraphy', id, `第${existing.layerNumber}层`, `更新地层: ${cell?.code || existing.cellId} 第${existing.layerNumber}层, ${changes}`);
        set((state) => {
          const updated = state.stratigraphies.map((s) =>
            s.id === id ? { ...s, ...data } : s
          );
          return { stratigraphies: updated };
        });
      },

      deleteStratigraphy: (id) => {
        if (!checkPermission('stratigraphy:delete', undefined, id)) {
          throw new Error('没有权限删除此地层');
        }
        const existing = get().stratigraphies.find((s) => s.id === id);
        if (!existing) return;
        const cell = get().getCellById(existing.cellId);
        logOperation('delete', 'stratigraphy', id, `第${existing.layerNumber}层`, `删除地层: ${cell?.code || existing.cellId} 第${existing.layerNumber}层`);
        set((state) => ({
          stratigraphies: state.stratigraphies.filter((s) => s.id !== id),
        }));
      },

      getStratigraphiesByCell: (cellId) => {
        return get()
          .stratigraphies.filter((s) => s.cellId === cellId)
          .sort((a, b) => b.topElevation - a.topElevation);
      },

      getStratigraphiesByUnit: (unitId) => {
        return get().stratigraphies.filter((s) => s.unitId === unitId);
      },

      validateStratigraphyElevation: (cellId, excludeId) => {
        const strats = get()
          .stratigraphies.filter((s) => s.cellId === cellId && s.id !== excludeId);
        return validateElevationOrder(strats);
      },

      createUnit: (data) => {
        if (!checkPermission('unit:create')) {
          throw new Error('没有权限创建地层单位');
        }
        const unitCount = get().units.filter((u) => u.trenchId === data.trenchId).length;
        const unit: StratigraphicUnit = {
          ...data,
          id: generateId(),
          color: getUnitColor(unitCount),
        };
        set((state) => ({
          units: [...state.units, unit],
        }));
        logOperation('create', 'unit', unit.id, unit.code, `创建地层单位: ${unit.code} (${unit.name})`);
        return unit;
      },

      updateUnit: (id, data) => {
        if (!checkPermission('unit:edit')) {
          throw new Error('没有权限编辑地层单位');
        }
        const existing = get().units.find((u) => u.id === id);
        if (!existing) return;
        const changes = Object.keys(data).map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`).join(', ');
        logOperation('update', 'unit', id, existing.code, `更新地层单位: ${existing.code}, ${changes}`);
        set((state) => ({
          units: state.units.map((u) => (u.id === id ? { ...u, ...data } : u)),
        }));
      },

      deleteUnit: (id) => {
        if (!checkPermission('unit:delete')) {
          throw new Error('没有权限删除地层单位');
        }
        const existing = get().units.find((u) => u.id === id);
        logOperation('delete', 'unit', id, existing?.code, `删除地层单位: ${existing?.code || id}`);
        set((state) => ({
          units: state.units.filter((u) => u.id !== id),
          stratigraphies: state.stratigraphies.map((s) =>
            s.unitId === id ? { ...s, unitId: undefined } : s
          ),
          relations: state.relations.filter(
            (r) => r.fromUnitId !== id && r.toUnitId !== id
          ),
        }));
      },

      assignStratigraphyToUnit: (stratigraphyId, unitId) => {
        set((state) => ({
          stratigraphies: state.stratigraphies.map((s) =>
            s.id === stratigraphyId ? { ...s, unitId } : s
          ),
        }));
      },

      unassignStratigraphyFromUnit: (stratigraphyId) => {
        set((state) => ({
          stratigraphies: state.stratigraphies.map((s) =>
            s.id === stratigraphyId ? { ...s, unitId: undefined } : s
          ),
        }));
      },

      addRelation: (data) => {
        if (!checkPermission('relation:create')) {
          throw new Error('没有权限创建地层关系');
        }
        const relation: StratigraphicRelation = {
          ...data,
          id: generateId(),
        };
        const fromUnit = get().units.find((u) => u.id === data.fromUnitId);
        const toUnit = get().units.find((u) => u.id === data.toUnitId);
        set((state) => ({
          relations: [...state.relations, relation],
        }));
        logOperation('create', 'relation', relation.id, data.type, `创建地层关系: ${fromUnit?.code || data.fromUnitId} ${data.type} ${toUnit?.code || data.toUnitId}`);
        return relation;
      },

      deleteRelation: (id) => {
        if (!checkPermission('relation:delete')) {
          throw new Error('没有权限删除地层关系');
        }
        const existing = get().relations.find((r) => r.id === id);
        logOperation('delete', 'relation', id, existing?.type, `删除地层关系: ${existing?.type || id}`);
        set((state) => ({
          relations: state.relations.filter((r) => r.id !== id),
        }));
      },

      getRelationsByTrench: (trenchId) => {
        return get().relations.filter((r) => r.trenchId === trenchId);
      },

      addArtifact: (data) => {
        if (!checkPermission('artifact:create', data.cellId)) {
          throw new Error('没有权限在此方格录入遗物');
        }
        const artifact: Artifact = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };
        set((state) => ({
          artifacts: [...state.artifacts, artifact],
        }));
        const cell = get().getCellById(data.cellId);
        logOperation('create', 'artifact', artifact.id, artifact.catalogNumber, `录入遗物: ${cell?.code || data.cellId} ${artifact.catalogNumber} (${artifact.type})`);
        return artifact;
      },

      updateArtifact: (id, data) => {
        if (!checkPermission('artifact:edit', undefined, undefined, id)) {
          throw new Error('没有权限编辑此遗物');
        }
        const existing = get().artifacts.find((a) => a.id === id);
        if (!existing) return;
        const cell = get().getCellById(existing.cellId);
        const changes = Object.keys(data).map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`).join(', ');
        logOperation('update', 'artifact', id, existing.catalogNumber, `更新遗物: ${cell?.code || existing.cellId} ${existing.catalogNumber}, ${changes}`);
        set((state) => ({
          artifacts: state.artifacts.map((a) =>
            a.id === id ? { ...a, ...data } : a
          ),
        }));
      },

      deleteArtifact: (id) => {
        if (!checkPermission('artifact:delete', undefined, undefined, id)) {
          throw new Error('没有权限删除此遗物');
        }
        const existing = get().artifacts.find((a) => a.id === id);
        if (!existing) return;
        const cell = get().getCellById(existing.cellId);
        logOperation('delete', 'artifact', id, existing.catalogNumber, `删除遗物: ${cell?.code || existing.cellId} ${existing.catalogNumber}`);
        set((state) => ({
          artifacts: state.artifacts.filter((a) => a.id !== id),
        }));
      },

      getArtifactsByCell: (cellId) => {
        return get().artifacts.filter((a) => a.cellId === cellId);
      },

      getArtifactsByUnit: (unitId) => {
        return get().artifacts.filter((a) => a.unitId === unitId);
      },

      getArtifactsByStratigraphy: (stratigraphyId) => {
        return get().artifacts.filter((a) => a.stratigraphyId === stratigraphyId);
      },

      addPerson: (data) => {
        if (!checkPermission('person:create')) {
          throw new Error('没有权限添加人员');
        }
        const person: Person = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };
        set((state) => ({ persons: [...state.persons, person] }));
        logOperation('create', 'person', person.id, person.name, `添加人员: ${person.name} (${person.role})`);
        return person;
      },

      updatePerson: (id, data) => {
        if (!checkPermission('person:edit')) {
          throw new Error('没有权限编辑人员');
        }
        const existing = get().persons.find((p) => p.id === id);
        if (!existing) return;
        const changes = Object.keys(data).map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`).join(', ');
        logOperation('update', 'person', id, existing.name, `更新人员: ${existing.name}, ${changes}`);
        set((state) => ({
          persons: state.persons.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        }));
      },

      deletePerson: (id) => {
        if (!checkPermission('person:delete')) {
          throw new Error('没有权限删除人员');
        }
        const existing = get().persons.find((p) => p.id === id);
        logOperation('delete', 'person', id, existing?.name, `删除人员: ${existing?.name || id}`);
        set((state) => ({
          persons: state.persons.filter((p) => p.id !== id),
          excavationLogs: state.excavationLogs.map((log) => ({
            ...log,
            participantIds: log.participantIds.filter((pid) => pid !== id),
          })),
        }));
      },

      getPersonById: (id) => {
        return get().persons.find((p) => p.id === id);
      },

      getPersonsByRole: (role) => {
        return get().persons.filter((p) => p.role === role);
      },

      getActivePersons: () => {
        return get().persons.filter((p) => p.status === '在岗');
      },

      addExcavationLog: (data) => {
        if (!checkPermission('excavationLog:create')) {
          throw new Error('没有权限创建发掘日志');
        }
        const now = Date.now();
        const log: ExcavationLog = {
          ...data,
          id: generateId(),
          newlyExposedCellIds: get().getCellsNewlyExposedOnDate(data.date),
          newlyArtifactIds: get().getArtifactsNewlyCreatedOnDate(data.date),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ excavationLogs: [...state.excavationLogs, log] }));
        logOperation('create', 'excavationLog', log.id, data.date, `创建发掘日志: ${data.date}, 天气${data.weather}, 参与人员${data.participantIds.length}人`);
        return log;
      },

      updateExcavationLog: (id, data) => {
        if (!checkPermission('excavationLog:edit')) {
          throw new Error('没有权限编辑发掘日志');
        }
        const existing = get().excavationLogs.find((l) => l.id === id);
        if (!existing) return;
        const changes = Object.keys(data).map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`).join(', ');
        logOperation('update', 'excavationLog', id, existing.date, `更新发掘日志: ${existing.date}, ${changes}`);
        set((state) => {
          const existing = state.excavationLogs.find((l) => l.id === id);
          if (!existing) return state;
          const updatedDate = data.date ?? existing.date;
          return {
            excavationLogs: state.excavationLogs.map((l) =>
              l.id === id
                ? {
                    ...l,
                    ...data,
                    newlyExposedCellIds: get().getCellsNewlyExposedOnDate(updatedDate),
                    newlyArtifactIds: get().getArtifactsNewlyCreatedOnDate(updatedDate),
                    updatedAt: Date.now(),
                  }
                : l
            ),
          };
        });
      },

      deleteExcavationLog: (id) => {
        if (!checkPermission('excavationLog:delete')) {
          throw new Error('没有权限删除发掘日志');
        }
        const existing = get().excavationLogs.find((l) => l.id === id);
        logOperation('delete', 'excavationLog', id, existing?.date, `删除发掘日志: ${existing?.date || id}`);
        set((state) => ({
          excavationLogs: state.excavationLogs.filter((l) => l.id !== id),
        }));
      },

      getExcavationLogById: (id) => {
        return get().excavationLogs.find((l) => l.id === id);
      },

      getLogsByDate: (date) => {
        return get().excavationLogs.filter((l) => l.date === date);
      },

      getLogsByPerson: (personId) => {
        return get().excavationLogs.filter((l) =>
          l.participantIds.includes(personId)
        );
      },

      getCellsNewlyExposedOnDate: (date) => {
        const state = get();
        const stratDate = new Date(date);
        const year = stratDate.getFullYear();
        const month = stratDate.getMonth();
        const day = stratDate.getDate();
        const cellIdsSet = new Set<string>();
        for (const s of state.stratigraphies) {
          const d = new Date(s.createdAt);
          if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
            cellIdsSet.add(s.cellId);
          }
        }
        return Array.from(cellIdsSet);
      },

      getArtifactsNewlyCreatedOnDate: (date) => {
        const state = get();
        const artifactDate = new Date(date);
        const year = artifactDate.getFullYear();
        const month = artifactDate.getMonth();
        const day = artifactDate.getDate();
        return state.artifacts
          .filter((a) => {
            const d = new Date(a.createdAt);
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
          })
          .map((a) => a.id);
      },
    }),
    {
      name: 'archaeology-grid-storage',
    }
  )
);
