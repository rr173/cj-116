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
} from '../types';
import {
  generateId,
  generateGridCells,
  calculateThickness,
  validateElevationOrder,
  getUnitColor,
} from '../utils';

interface AppState {
  trenches: Trench[];
  cells: GridCell[];
  stratigraphies: Stratigraphy[];
  units: StratigraphicUnit[];
  relations: StratigraphicRelation[];
  artifacts: Artifact[];
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
    }),
    {
      name: 'archaeology-grid-storage',
    }
  )
);
