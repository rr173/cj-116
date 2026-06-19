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
        return trench;
      },

      deleteTrench: (id) => {
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
        return strat;
      },

      updateStratigraphy: (id, data) => {
        set((state) => {
          const updated = state.stratigraphies.map((s) =>
            s.id === id ? { ...s, ...data } : s
          );
          return { stratigraphies: updated };
        });
      },

      deleteStratigraphy: (id) => {
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
        const unitCount = get().units.filter((u) => u.trenchId === data.trenchId).length;
        const unit: StratigraphicUnit = {
          ...data,
          id: generateId(),
          color: getUnitColor(unitCount),
        };
        set((state) => ({
          units: [...state.units, unit],
        }));
        return unit;
      },

      updateUnit: (id, data) => {
        set((state) => ({
          units: state.units.map((u) => (u.id === id ? { ...u, ...data } : u)),
        }));
      },

      deleteUnit: (id) => {
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
        const relation: StratigraphicRelation = {
          ...data,
          id: generateId(),
        };
        set((state) => ({
          relations: [...state.relations, relation],
        }));
        return relation;
      },

      deleteRelation: (id) => {
        set((state) => ({
          relations: state.relations.filter((r) => r.id !== id),
        }));
      },

      getRelationsByTrench: (trenchId) => {
        return get().relations.filter((r) => r.trenchId === trenchId);
      },

      addArtifact: (data) => {
        const artifact: Artifact = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };
        set((state) => ({
          artifacts: [...state.artifacts, artifact],
        }));
        return artifact;
      },

      updateArtifact: (id, data) => {
        set((state) => ({
          artifacts: state.artifacts.map((a) =>
            a.id === id ? { ...a, ...data } : a
          ),
        }));
      },

      deleteArtifact: (id) => {
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
        const person: Person = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };
        set((state) => ({ persons: [...state.persons, person] }));
        return person;
      },

      updatePerson: (id, data) => {
        set((state) => ({
          persons: state.persons.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        }));
      },

      deletePerson: (id) => {
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
        return log;
      },

      updateExcavationLog: (id, data) => {
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
