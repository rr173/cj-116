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
} from '../types';
import {
  generateId,
  generateGridCells,
  calculateThickness,
  validateElevationOrder,
  getUnitColor,
  formatDate,
  timestampToDateString,
} from '../utils';
import {
  checkActionPermission,
  canEditOwnData,
  canDeleteOwnData,
  logOperationToStorage,
  getCurrentUserId,
} from '../utils/auth';

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

  addStratigraphy: (data: Omit<Stratigraphy, 'id' | 'createdAt' | 'createdBy'>) => Stratigraphy | null;
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

  addArtifact: (data: Omit<Artifact, 'id' | 'createdAt' | 'createdBy'>) => Artifact;
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
        if (!checkActionPermission('trench:create')) {
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
        logOperationToStorage({
          operation: 'create',
          targetType: 'trench',
          targetId: trench.id,
          targetName: trench.name,
          details: `创建发掘区: ${trench.name} (${trench.code}), ${trench.rows}×${trench.cols}方格`,
        });
        return trench;
      },

      deleteTrench: (id) => {
        if (!checkActionPermission('trench:delete')) {
          throw new Error('没有权限删除发掘区');
        }
        const trench = get().trenches.find((t) => t.id === id);
        logOperationToStorage({
          operation: 'delete',
          targetType: 'trench',
          targetId: id,
          targetName: trench?.name,
          details: `删除发掘区: ${trench?.name || id}`,
        });
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
        if (!checkActionPermission('stratigraphy:create')) {
          throw new Error('没有权限录入地层');
        }
        const currentUserId = getCurrentUserId();
        const strat: Stratigraphy = {
          ...data,
          id: generateId(),
          createdBy: currentUserId || undefined,
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
        logOperationToStorage({
          operation: 'create',
          targetType: 'stratigraphy',
          targetId: strat.id,
          targetName: `第${strat.layerNumber}层`,
          details: `录入地层: ${cell?.code || data.cellId} 第${strat.layerNumber}层, 海拔${strat.topElevation}-${strat.bottomElevation}m`,
        });
        return strat;
      },

      updateStratigraphy: (id, data) => {
        const existing = get().stratigraphies.find((s) => s.id === id);
        if (!existing) return;
        if (!canEditOwnData(existing.createdBy)) {
          throw new Error('没有权限编辑此地层（只能编辑自己录入的）');
        }
        if (!checkActionPermission('stratigraphy:edit')) {
          throw new Error('没有权限编辑地层');
        }
        const cell = get().getCellById(existing.cellId);
        const changes = Object.keys(data).map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`).join(', ');
        logOperationToStorage({
          operation: 'update',
          targetType: 'stratigraphy',
          targetId: id,
          targetName: `第${existing.layerNumber}层`,
          details: `更新地层: ${cell?.code || existing.cellId} 第${existing.layerNumber}层, ${changes}`,
        });
        set((state) => {
          const updated = state.stratigraphies.map((s) =>
            s.id === id ? { ...s, ...data } : s
          );
          return { stratigraphies: updated };
        });
      },

      deleteStratigraphy: (id) => {
        const existing = get().stratigraphies.find((s) => s.id === id);
        if (!existing) return;
        if (!canDeleteOwnData(existing.createdBy)) {
          throw new Error('没有权限删除此地层');
        }
        const cell = get().getCellById(existing.cellId);
        logOperationToStorage({
          operation: 'delete',
          targetType: 'stratigraphy',
          targetId: id,
          targetName: `第${existing.layerNumber}层`,
          details: `删除地层: ${cell?.code || existing.cellId} 第${existing.layerNumber}层`,
        });
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
        if (!checkActionPermission('unit:create')) {
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
        logOperationToStorage({
          operation: 'create',
          targetType: 'unit',
          targetId: unit.id,
          targetName: unit.code,
          details: `创建地层单位: ${unit.code} (${unit.name})`,
        });
        return unit;
      },

      updateUnit: (id, data) => {
        if (!checkActionPermission('unit:edit')) {
          throw new Error('没有权限编辑地层单位');
        }
        const existing = get().units.find((u) => u.id === id);
        if (!existing) return;
        const changes = Object.keys(data).map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`).join(', ');
        logOperationToStorage({
          operation: 'update',
          targetType: 'unit',
          targetId: id,
          targetName: existing.code,
          details: `更新地层单位: ${existing.code}, ${changes}`,
        });
        set((state) => ({
          units: state.units.map((u) => (u.id === id ? { ...u, ...data } : u)),
        }));
      },

      deleteUnit: (id) => {
        if (!checkActionPermission('unit:delete')) {
          throw new Error('没有权限删除地层单位');
        }
        const existing = get().units.find((u) => u.id === id);
        logOperationToStorage({
          operation: 'delete',
          targetType: 'unit',
          targetId: id,
          targetName: existing?.code,
          details: `删除地层单位: ${existing?.code || id}`,
        });
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
        if (!checkActionPermission('relation:create')) {
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
        logOperationToStorage({
          operation: 'create',
          targetType: 'relation',
          targetId: relation.id,
          targetName: data.type,
          details: `创建地层关系: ${fromUnit?.code || data.fromUnitId} ${data.type} ${toUnit?.code || data.toUnitId}`,
        });
        return relation;
      },

      deleteRelation: (id) => {
        if (!checkActionPermission('relation:delete')) {
          throw new Error('没有权限删除地层关系');
        }
        const existing = get().relations.find((r) => r.id === id);
        logOperationToStorage({
          operation: 'delete',
          targetType: 'relation',
          targetId: id,
          targetName: existing?.type,
          details: `删除地层关系: ${existing?.type || id}`,
        });
        set((state) => ({
          relations: state.relations.filter((r) => r.id !== id),
        }));
      },

      getRelationsByTrench: (trenchId) => {
        return get().relations.filter((r) => r.trenchId === trenchId);
      },

      addArtifact: (data) => {
        if (!checkActionPermission('artifact:create')) {
          throw new Error('没有权限录入遗物');
        }
        const currentUserId = getCurrentUserId();
        const artifact: Artifact = {
          ...data,
          id: generateId(),
          createdBy: currentUserId || undefined,
          createdAt: Date.now(),
        };
        set((state) => ({
          artifacts: [...state.artifacts, artifact],
        }));
        const cell = get().getCellById(data.cellId);
        logOperationToStorage({
          operation: 'create',
          targetType: 'artifact',
          targetId: artifact.id,
          targetName: artifact.catalogNumber,
          details: `录入遗物: ${cell?.code || data.cellId} ${artifact.catalogNumber} (${artifact.type})`,
        });
        return artifact;
      },

      updateArtifact: (id, data) => {
        const existing = get().artifacts.find((a) => a.id === id);
        if (!existing) return;
        if (!canEditOwnData(existing.createdBy)) {
          throw new Error('没有权限编辑此遗物（只能编辑自己录入的）');
        }
        if (!checkActionPermission('artifact:edit')) {
          throw new Error('没有权限编辑遗物');
        }
        const cell = get().getCellById(existing.cellId);
        const changes = Object.keys(data).map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`).join(', ');
        logOperationToStorage({
          operation: 'update',
          targetType: 'artifact',
          targetId: id,
          targetName: existing.catalogNumber,
          details: `更新遗物: ${cell?.code || existing.cellId} ${existing.catalogNumber}, ${changes}`,
        });
        set((state) => ({
          artifacts: state.artifacts.map((a) =>
            a.id === id ? { ...a, ...data } : a
          ),
        }));
      },

      deleteArtifact: (id) => {
        const existing = get().artifacts.find((a) => a.id === id);
        if (!existing) return;
        if (!canDeleteOwnData(existing.createdBy)) {
          throw new Error('没有权限删除此遗物');
        }
        const cell = get().getCellById(existing.cellId);
        logOperationToStorage({
          operation: 'delete',
          targetType: 'artifact',
          targetId: id,
          targetName: existing.catalogNumber,
          details: `删除遗物: ${cell?.code || existing.cellId} ${existing.catalogNumber}`,
        });
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
        if (!checkActionPermission('person:create')) {
          throw new Error('没有权限添加人员');
        }
        const person: Person = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };
        set((state) => ({ persons: [...state.persons, person] }));
        logOperationToStorage({
          operation: 'create',
          targetType: 'person',
          targetId: person.id,
          targetName: person.name,
          details: `添加人员: ${person.name} (${person.role})`,
        });
        return person;
      },

      updatePerson: (id, data) => {
        if (!checkActionPermission('person:edit')) {
          throw new Error('没有权限编辑人员');
        }
        const existing = get().persons.find((p) => p.id === id);
        if (!existing) return;
        const changes = Object.keys(data).map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`).join(', ');
        logOperationToStorage({
          operation: 'update',
          targetType: 'person',
          targetId: id,
          targetName: existing.name,
          details: `更新人员: ${existing.name}, ${changes}`,
        });
        set((state) => ({
          persons: state.persons.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        }));
      },

      deletePerson: (id) => {
        if (!checkActionPermission('person:delete')) {
          throw new Error('没有权限删除人员');
        }
        const existing = get().persons.find((p) => p.id === id);
        logOperationToStorage({
          operation: 'delete',
          targetType: 'person',
          targetId: id,
          targetName: existing?.name,
          details: `删除人员: ${existing?.name || id}`,
        });
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
        if (!checkActionPermission('excavationLog:create')) {
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
        logOperationToStorage({
          operation: 'create',
          targetType: 'excavationLog',
          targetId: log.id,
          targetName: data.date,
          details: `创建发掘日志: ${data.date}, 天气${data.weather}, 参与人员${data.participantIds.length}人`,
        });
        return log;
      },

      updateExcavationLog: (id, data) => {
        if (!checkActionPermission('excavationLog:edit')) {
          throw new Error('没有权限编辑发掘日志');
        }
        const existing = get().excavationLogs.find((l) => l.id === id);
        if (!existing) return;
        const changes = Object.keys(data).map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`).join(', ');
        logOperationToStorage({
          operation: 'update',
          targetType: 'excavationLog',
          targetId: id,
          targetName: existing.date,
          details: `更新发掘日志: ${existing.date}, ${changes}`,
        });
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
        if (!checkActionPermission('excavationLog:delete')) {
          throw new Error('没有权限删除发掘日志');
        }
        const existing = get().excavationLogs.find((l) => l.id === id);
        logOperationToStorage({
          operation: 'delete',
          targetType: 'excavationLog',
          targetId: id,
          targetName: existing?.date,
          details: `删除发掘日志: ${existing?.date || id}`,
        });
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
