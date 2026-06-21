import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Snapshot,
  SnapshotCellState,
  SnapshotCompareResult,
} from '../types';
import { generateId } from '../utils';
import { getCurrentUserId } from '../utils/auth';

interface SnapshotState {
  snapshots: Snapshot[];
  selectedSnapshotId: string | null;
  compareSnapshotAId: string | null;
  compareSnapshotBId: string | null;

  createSnapshot: (data: {
    trenchId: string;
    name: string;
    remark: string;
    cellStates: SnapshotCellState[];
    totalArtifacts: number;
    totalSamples: number;
    totalStratigraphies: number;
    totalRelations: number;
    totalFeatures: number;
    exposedCellCount: number;
    totalCellCount: number;
    featureSnapshots: Snapshot['featureSnapshots'];
  }) => Snapshot;

  deleteSnapshot: (id: string) => void;
  updateSnapshot: (id: string, data: Partial<Pick<Snapshot, 'name' | 'remark'>>) => void;

  getSnapshotsByTrench: (trenchId: string) => Snapshot[];
  getSnapshotById: (id: string) => Snapshot | undefined;

  setSelectedSnapshot: (id: string | null) => void;
  setCompareSnapshotA: (id: string | null) => void;
  setCompareSnapshotB: (id: string | null) => void;

  compareSnapshots: (snapshotAId: string, snapshotBId: string) => SnapshotCompareResult | null;
}

export const useSnapshotStore = create<SnapshotState>()(
  persist(
    (set, get) => ({
      snapshots: [],
      selectedSnapshotId: null,
      compareSnapshotAId: null,
      compareSnapshotBId: null,

      createSnapshot: (data) => {
        const currentUserId = getCurrentUserId();
        const snapshot: Snapshot = {
          ...data,
          id: generateId(),
          createdBy: currentUserId || undefined,
          createdAt: Date.now(),
        };
        set((state) => ({
          snapshots: [...state.snapshots, snapshot],
        }));
        return snapshot;
      },

      deleteSnapshot: (id) => {
        set((state) => ({
          snapshots: state.snapshots.filter((s) => s.id !== id),
          selectedSnapshotId: state.selectedSnapshotId === id ? null : state.selectedSnapshotId,
          compareSnapshotAId: state.compareSnapshotAId === id ? null : state.compareSnapshotAId,
          compareSnapshotBId: state.compareSnapshotBId === id ? null : state.compareSnapshotBId,
        }));
      },

      updateSnapshot: (id, data) => {
        set((state) => ({
          snapshots: state.snapshots.map((s) =>
            s.id === id ? { ...s, ...data } : s
          ),
        }));
      },

      getSnapshotsByTrench: (trenchId) => {
        return get()
          .snapshots.filter((s) => s.trenchId === trenchId)
          .sort((a, b) => a.createdAt - b.createdAt);
      },

      getSnapshotById: (id) => {
        return get().snapshots.find((s) => s.id === id);
      },

      setSelectedSnapshot: (id) => set({ selectedSnapshotId: id }),
      setCompareSnapshotA: (id) => set({ compareSnapshotAId: id }),
      setCompareSnapshotB: (id) => set({ compareSnapshotBId: id }),

      compareSnapshots: (snapshotAId, snapshotBId) => {
        const state = get();
        const snapshotA = state.snapshots.find((s) => s.id === snapshotAId);
        const snapshotB = state.snapshots.find((s) => s.id === snapshotBId);
        if (!snapshotA || !snapshotB) return null;

        const [earlier, later] =
          snapshotA.createdAt <= snapshotB.createdAt
            ? [snapshotA, snapshotB]
            : [snapshotB, snapshotA];

        const cellMapA = new Map(earlier.cellStates.map((c) => [c.cellId, c]));
        const cellMapB = new Map(later.cellStates.map((c) => [c.cellId, c]));

        const newlyExposedCells: string[] = [];
        const deepenedCells: string[] = [];
        const unchangedCells: string[] = [];
        const cellDifferences: SnapshotCompareResult['cellDifferences'] = {};

        const allCellIds = new Set([
          ...earlier.cellStates.map((c) => c.cellId),
          ...later.cellStates.map((c) => c.cellId),
        ]);

        for (const cellId of allCellIds) {
          const stateA = cellMapA.get(cellId);
          const stateB = cellMapB.get(cellId);
          const layerA = stateA?.deepestLayerNumber ?? 0;
          const layerB = stateB?.deepestLayerNumber ?? 0;

          if (!stateA && stateB && stateB.deepestLayerNumber > 0) {
            newlyExposedCells.push(cellId);
            cellDifferences[cellId] = {
              layerDelta: layerB - layerA,
              status: 'new',
            };
          } else if (stateA && stateB && layerB > layerA) {
            deepenedCells.push(cellId);
            cellDifferences[cellId] = {
              layerDelta: layerB - layerA,
              status: 'deepened',
            };
          } else if (stateA && stateB) {
            unchangedCells.push(cellId);
            cellDifferences[cellId] = {
              layerDelta: 0,
              status: 'unchanged',
            };
          }
        }

        return {
          snapshotA: earlier,
          snapshotB: later,
          newlyExposedCells,
          deepenedCells,
          unchangedCells,
          newStratigraphies: later.totalStratigraphies - earlier.totalStratigraphies,
          newArtifacts: later.totalArtifacts - earlier.totalArtifacts,
          newFeatures: later.totalFeatures - earlier.totalFeatures,
          newRelations: later.totalRelations - earlier.totalRelations,
          newSamples: later.totalSamples - earlier.totalSamples,
          cellDifferences,
        };
      },
    }),
    {
      name: 'archaeology-snapshot-storage',
    }
  )
);
