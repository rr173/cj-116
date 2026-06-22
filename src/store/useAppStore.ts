import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Trench,
  GridCell,
  Stratigraphy,
  StratigraphicUnit,
  StratigraphicRelation,
  Artifact,
  ArtifactSubtype,
  ArtifactCategory,
  ARTIFACT_CATEGORIES,
  RelationType,
  Person,
  PersonRole,
  PersonStatus,
  ExcavationLog,
  TimeSlot,
  WeatherType,
  RelicFeature,
  FeatureSpatialRelation,
  Period,
  FeatureType,
  FeatureRelationType,
  ControlPoint,
  ControlPointType,
  ElevationAnomaly,
  ContourConfig,
  ProfileSection,
  ProfileBoundaryLine,
  ProfileCutLine,
  ProfileAnnotation,
  ProfileIntersection,
  ProfileBezierPoint,
  BoundaryType,
  DensityHeatmapConfig,
  BufferQueryConfig,
  NearestNeighborConfig,
  ClusterConfig,
  DensityGridCell,
  DistributionStats,
  ArtifactCluster,
  BufferQueryResult,
  NearestNeighborResult,
} from '../types';
import {
  generateId,
  generateGridCells,
  calculateThickness,
  validateElevationOrder,
  getUnitColor,
  formatDate,
  timestampToDateString,
  computeCoveredCells,
  polygonsIntersect,
  PERIOD_COLORS,
} from '../utils';
import {
  interpolateIDW,
  checkElevationAnomalies,
  generateContours,
  DEFAULT_CONTOUR_INTERVAL,
  parseControlPointImport,
  ControlPointImportRow,
} from '../utils/survey';
import {
  generateDensityGrid,
  getArtifactsInFeatureBuffer,
  generateCirclePolygon,
  pointInPolygon,
  findNearestNeighbors,
  calculateDistributionStats,
  clusterArtifacts,
  filterArtifactsByCategory,
} from '../utils/spatialAnalysis';
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

  features: RelicFeature[];
  periods: Period[];
  featureSpatialRelations: FeatureSpatialRelation[];
  selectedFeatureId: string | null;

  addFeature: (data: Omit<RelicFeature, 'id' | 'createdAt' | 'createdBy' | 'coveredCellIds'>) => RelicFeature;
  updateFeature: (id: string, data: Partial<RelicFeature>) => void;
  deleteFeature: (id: string) => void;
  getFeaturesByTrench: (trenchId: string) => RelicFeature[];
  getFeaturesByCell: (cellId: string) => RelicFeature[];
  getFeaturesByUnit: (unitId: string) => RelicFeature[];
  getFeaturesByPeriod: (periodId: string) => RelicFeature[];
  setSelectedFeature: (id: string | null) => void;
  detectSpatialRelations: (trenchId: string) => FeatureSpatialRelation[];
  confirmSpatialRelation: (id: string) => void;
  rejectSpatialRelation: (id: string) => void;

  createPeriod: (data: Omit<Period, 'id' | 'createdAt' | 'color' | 'order'>) => Period;
  updatePeriod: (id: string, data: Partial<Period>) => void;
  deletePeriod: (id: string) => void;
  getPeriodsByTrench: (trenchId: string) => Period[];
  assignFeatureToPeriod: (featureId: string, periodId: string) => boolean;
  unassignFeatureFromPeriod: (featureId: string) => void;
  validatePeriodAssignment: (featureId: string, periodId: string) => { valid: boolean; warnings: string[] };

  addExcavationLog: (data: Omit<ExcavationLog, 'id' | 'newlyExposedCellIds' | 'newlyArtifactIds' | 'createdAt' | 'updatedAt'>) => ExcavationLog;
  updateExcavationLog: (id: string, data: Partial<Omit<ExcavationLog, 'id' | 'newlyExposedCellIds' | 'newlyArtifactIds' | 'createdAt'>>) => void;
  deleteExcavationLog: (id: string) => void;
  getExcavationLogById: (id: string) => ExcavationLog | undefined;
  getLogsByDate: (date: string) => ExcavationLog[];
  getLogsByPerson: (personId: string) => ExcavationLog[];
  getCellsNewlyExposedOnDate: (date: string) => string[];
  getArtifactsNewlyCreatedOnDate: (date: string) => string[];

  controlPoints: ControlPoint[];
  selectedControlPointId: string | null;
  contourConfig: ContourConfig;
  showControlPointsOnMap: boolean;

  addControlPoint: (data: Omit<ControlPoint, 'id' | 'createdAt'>) => ControlPoint | null;
  updateControlPoint: (id: string, data: Partial<Omit<ControlPoint, 'id' | 'trenchId' | 'createdAt'>>) => void;
  deleteControlPoint: (id: string) => void;
  getControlPointsByTrench: (trenchId: string) => ControlPoint[];
  getControlPointById: (id: string) => ControlPoint | undefined;
  setSelectedControlPoint: (id: string | null) => void;
  batchImportControlPoints: (trenchId: string, importText: string, defaultType: ControlPointType, measuredBy: string) => { success: number; failed: ControlPointImportRow[] };
  interpolateElevationAt: (x: number, y: number, trenchId: string) => ReturnType<typeof interpolateIDW>;
  getElevationAnomalies: (trenchId: string) => ElevationAnomaly[];
  generateContoursForTrench: (trenchId: string, interval?: number) => ReturnType<typeof generateContours>;
  setContourConfig: (config: Partial<ContourConfig>) => void;
  setShowControlPointsOnMap: (show: boolean) => void;

  profiles: ProfileSection[];
  selectedProfileId: string | null;

  createProfile: (data: Omit<ProfileSection, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'boundaryLines' | 'cutLines' | 'annotations'>) => ProfileSection;
  updateProfile: (id: string, data: Partial<Omit<ProfileSection, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'boundaryLines' | 'cutLines' | 'annotations'>>) => void;
  deleteProfile: (id: string) => void;
  setSelectedProfile: (id: string | null) => void;
  getProfilesByTrench: (trenchId: string) => ProfileSection[];
  getProfileById: (id: string) => ProfileSection | undefined;

  addBoundaryLine: (data: Omit<ProfileBoundaryLine, 'id' | 'createdAt' | 'updatedAt'>) => ProfileBoundaryLine;
  updateBoundaryLine: (id: string, data: Partial<ProfileBoundaryLine>) => void;
  deleteBoundaryLine: (id: string) => void;
  getBoundaryLinesByProfile: (profileId: string) => ProfileBoundaryLine[];

  addCutLine: (data: Omit<ProfileCutLine, 'id' | 'createdAt' | 'updatedAt'>) => ProfileCutLine;
  updateCutLine: (id: string, data: Partial<ProfileCutLine>) => void;
  deleteCutLine: (id: string) => void;
  getCutLinesByProfile: (profileId: string) => ProfileCutLine[];

  addAnnotation: (data: Omit<ProfileAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => ProfileAnnotation;
  updateAnnotation: (id: string, data: Partial<ProfileAnnotation>) => void;
  deleteAnnotation: (id: string) => void;
  getAnnotationsByProfile: (profileId: string) => ProfileAnnotation[];

  getProfileIntersections: (trenchId: string) => ProfileIntersection[];
  alignBoundaryAtIntersection: (intersectionId: string, sourceProfileId: string, unitId: string) => void;

  artifactSubtypes: ArtifactSubtype[];
  addArtifactSubtype: (data: Omit<ArtifactSubtype, 'id' | 'createdAt'>) => ArtifactSubtype;
  updateArtifactSubtype: (id: string, data: Partial<Omit<ArtifactSubtype, 'id' | 'createdAt' | 'category'>>) => void;
  deleteArtifactSubtype: (id: string) => void;
  getSubtypesByCategory: (category: ArtifactCategory) => ArtifactSubtype[];
  matchArtifactSubtype: (typeText: string) => ArtifactSubtype | null;
  autoAssignSubtypes: () => { matched: number; unmatched: number };
  assignArtifactToSubtype: (artifactId: string, subtypeId: string) => void;

  densityHeatmapConfig: DensityHeatmapConfig;
  bufferQueryConfig: BufferQueryConfig;
  nearestNeighborConfig: NearestNeighborConfig;
  clusterConfig: ClusterConfig;

  setDensityHeatmapConfig: (config: Partial<DensityHeatmapConfig>) => void;
  setBufferQueryConfig: (config: Partial<BufferQueryConfig>) => void;
  setNearestNeighborConfig: (config: Partial<NearestNeighborConfig>) => void;
  setClusterConfig: (config: Partial<ClusterConfig>) => void;

  getDensityGrid: (trenchId: string) => DensityGridCell[];
  getBufferQueryResult: (trenchId: string) => BufferQueryResult | null;
  getNearestNeighbors: (trenchId: string) => NearestNeighborResult | null;
  getDistributionStats: (artifactIds?: string[]) => DistributionStats;
  getArtifactClusters: (trenchId: string) => ArtifactCluster[];
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
      features: [],
      periods: [],
      featureSpatialRelations: [],
      selectedFeatureId: null,
      selectedTrenchId: null,
      selectedCellId: null,
      selectedUnitId: null,
      controlPoints: [],
      selectedControlPointId: null,
      contourConfig: {
        interval: DEFAULT_CONTOUR_INTERVAL,
        showLabels: true,
        visible: false,
      },
      showControlPointsOnMap: true,
      profiles: [],
      selectedProfileId: null,
      artifactSubtypes: [],

      densityHeatmapConfig: {
        visible: false,
        gridSize: 0.5,
        selectedCategory: 'all',
      },
      bufferQueryConfig: {
        active: false,
        mode: 'point',
        radius: 1,
        centerPoint: null,
        selectedFeatureId: null,
      },
      nearestNeighborConfig: {
        active: false,
        artifactId: null,
        neighborCount: 5,
      },
      clusterConfig: {
        visible: false,
        distanceThreshold: 0.3,
        minClusterSize: 3,
      },

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
          features: state.features.filter((f) => f.trenchId !== id),
          periods: state.periods.filter((p) => p.trenchId !== id),
          featureSpatialRelations: state.featureSpatialRelations.filter((r) => r.trenchId !== id),
          controlPoints: state.controlPoints.filter((cp) => cp.trenchId !== id),
          selectedTrenchId: state.selectedTrenchId === id ? null : state.selectedTrenchId,
          selectedCellId: null,
          selectedControlPointId: null,
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

      addFeature: (data) => {
        if (!checkActionPermission('feature:create')) {
          throw new Error('没有权限创建遗迹要素');
        }
        const currentUserId = getCurrentUserId();
        const state = get();
        const trenchCells = state.cells.filter((c) => c.trenchId === data.trenchId);
        const coveredCellIds = computeCoveredCells(data.vertices, trenchCells);
        const feature: RelicFeature = {
          ...data,
          id: generateId(),
          coveredCellIds,
          createdBy: currentUserId || undefined,
          createdAt: Date.now(),
        };
        set((state) => ({
          features: [...state.features, feature],
        }));
        logOperationToStorage({
          operation: 'create',
          targetType: 'feature',
          targetId: feature.id,
          targetName: feature.featureNumber,
          details: `创建遗迹要素: ${feature.featureNumber} (${feature.featureType}), 覆盖${coveredCellIds.length}格`,
        });
        return feature;
      },

      updateFeature: (id, data) => {
        const existing = get().features.find((f) => f.id === id);
        if (!existing) return;
        if (!checkActionPermission('feature:edit')) {
          throw new Error('没有权限编辑遗迹要素');
        }
        let coveredCellIds = data.coveredCellIds;
        if (data.vertices) {
          const state = get();
          const trenchCells = state.cells.filter((c) => c.trenchId === (data.trenchId || existing.trenchId));
          coveredCellIds = computeCoveredCells(data.vertices, trenchCells);
        }
        logOperationToStorage({
          operation: 'update',
          targetType: 'feature',
          targetId: id,
          targetName: existing.featureNumber,
          details: `更新遗迹要素: ${existing.featureNumber}`,
        });
        set((state) => ({
          features: state.features.map((f) =>
            f.id === id ? { ...f, ...data, coveredCellIds: coveredCellIds || f.coveredCellIds } : f
          ),
        }));
      },

      deleteFeature: (id) => {
        if (!checkActionPermission('feature:delete')) {
          throw new Error('没有权限删除遗迹要素');
        }
        const existing = get().features.find((f) => f.id === id);
        logOperationToStorage({
          operation: 'delete',
          targetType: 'feature',
          targetId: id,
          targetName: existing?.featureNumber,
          details: `删除遗迹要素: ${existing?.featureNumber || id}`,
        });
        set((state) => ({
          features: state.features.filter((f) => f.id !== id),
          featureSpatialRelations: state.featureSpatialRelations.filter(
            (r) => r.featureIdA !== id && r.featureIdB !== id
          ),
        }));
      },

      getFeaturesByTrench: (trenchId) => {
        return get().features.filter((f) => f.trenchId === trenchId);
      },

      getFeaturesByCell: (cellId) => {
        return get().features.filter((f) => f.coveredCellIds.includes(cellId));
      },

      getFeaturesByUnit: (unitId) => {
        return get().features.filter((f) => f.unitId === unitId);
      },

      getFeaturesByPeriod: (periodId) => {
        return get().features.filter((f) => f.periodId === periodId);
      },

      setSelectedFeature: (id) => set({ selectedFeatureId: id }),

      detectSpatialRelations: (trenchId) => {
        const state = get();
        const trenchFeatures = state.features.filter((f) => f.trenchId === trenchId);
        const newRelations: FeatureSpatialRelation[] = [];

        for (let i = 0; i < trenchFeatures.length; i++) {
          for (let j = i + 1; j < trenchFeatures.length; j++) {
            const a = trenchFeatures[i];
            const b = trenchFeatures[j];

            const existing = state.featureSpatialRelations.find(
              (r) =>
                (r.featureIdA === a.id && r.featureIdB === b.id) ||
                (r.featureIdA === b.id && r.featureIdB === a.id)
            );
            if (existing) continue;

            if (!polygonsIntersect(a.vertices, b.vertices)) continue;

            let relationType: FeatureRelationType;
            if (a.unitId === b.unitId) {
              relationType = '共存';
            } else {
              relationType = a.topElevation > b.topElevation ? '打破' : '叠压';
            }

            const rel: FeatureSpatialRelation = {
              id: generateId(),
              trenchId,
              featureIdA: a.id,
              featureIdB: b.id,
              type: relationType,
              confirmed: false,
              createdAt: Date.now(),
            };
            newRelations.push(rel);
          }
        }

        if (newRelations.length > 0) {
          set((state) => ({
            featureSpatialRelations: [...state.featureSpatialRelations, ...newRelations],
          }));
        }

        return newRelations;
      },

      confirmSpatialRelation: (id) => {
        set((state) => ({
          featureSpatialRelations: state.featureSpatialRelations.map((r) =>
            r.id === id ? { ...r, confirmed: true } : r
          ),
        }));
      },

      rejectSpatialRelation: (id) => {
        set((state) => ({
          featureSpatialRelations: state.featureSpatialRelations.filter((r) => r.id !== id),
        }));
      },

      createPeriod: (data) => {
        if (!checkActionPermission('period:create')) {
          throw new Error('没有权限创建时期');
        }
        const periodCount = get().periods.filter((p) => p.trenchId === data.trenchId).length;
        const period: Period = {
          ...data,
          id: generateId(),
          color: PERIOD_COLORS[periodCount % PERIOD_COLORS.length],
          order: periodCount + 1,
          createdAt: Date.now(),
        };
        set((state) => ({
          periods: [...state.periods, period],
        }));
        logOperationToStorage({
          operation: 'create',
          targetType: 'period',
          targetId: period.id,
          targetName: period.name,
          details: `创建时期: ${period.name} (${period.dateRange})`,
        });
        return period;
      },

      updatePeriod: (id, data) => {
        if (!checkActionPermission('period:edit')) {
          throw new Error('没有权限编辑时期');
        }
        set((state) => ({
          periods: state.periods.map((p) => (p.id === id ? { ...p, ...data } : p)),
        }));
      },

      deletePeriod: (id) => {
        if (!checkActionPermission('period:delete')) {
          throw new Error('没有权限删除时期');
        }
        set((state) => ({
          periods: state.periods.filter((p) => p.id !== id),
          features: state.features.map((f) =>
            f.periodId === id ? { ...f, periodId: undefined } : f
          ),
        }));
      },

      getPeriodsByTrench: (trenchId) => {
        return get()
          .periods.filter((p) => p.trenchId === trenchId)
          .sort((a, b) => a.order - b.order);
      },

      assignFeatureToPeriod: (featureId, periodId) => {
        const validation = get().validatePeriodAssignment(featureId, periodId);
        if (!validation.valid && !confirm(`${validation.warnings.join('\n')}\n\n是否强制分配？`)) {
          return false;
        }
        set((state) => ({
          features: state.features.map((f) =>
            f.id === featureId ? { ...f, periodId } : f
          ),
        }));
        return true;
      },

      unassignFeatureFromPeriod: (featureId) => {
        set((state) => ({
          features: state.features.map((f) =>
            f.id === featureId ? { ...f, periodId: undefined } : f
          ),
        }));
      },

      validatePeriodAssignment: (featureId, periodId) => {
        const state = get();
        const feature = state.features.find((f) => f.id === featureId);
        const period = state.periods.find((p) => p.id === periodId);
        if (!feature || !period) return { valid: true, warnings: [] };

        const warnings: string[] = [];
        const featureUnit = state.units.find((u) => u.id === feature.unitId);
        if (!featureUnit) return { valid: true, warnings };

        const earlierUnits = new Set<string>();
        const queueDown = [featureUnit.id];
        const visitedDown = new Set<string>();
        while (queueDown.length > 0) {
          const current = queueDown.shift()!;
          if (visitedDown.has(current)) continue;
          visitedDown.add(current);
          const belowRelations = state.relations.filter(
            (r) => r.fromUnitId === current && (r.type === '叠压' || r.type === '打破')
          );
          for (const rel of belowRelations) {
            earlierUnits.add(rel.toUnitId);
            queueDown.push(rel.toUnitId);
          }
        }

        const featuresInEarlierUnits = state.features.filter(
          (f) => f.id !== featureId && earlierUnits.has(f.unitId) && f.periodId
        );

        for (const earlierFeature of featuresInEarlierUnits) {
          const earlierPeriod = state.periods.find((p) => p.id === earlierFeature.periodId);
          if (earlierPeriod && earlierPeriod.order > period.order) {
            warnings.push(
              `「${earlierFeature.featureNumber}」所属地层单位在"${featureUnit.code}"之下（更早），却分配了更晚时期"${earlierPeriod.name}"，而当前要分配的"${period.name}"更早，违反时序约束`
            );
          }
        }

        const laterUnits = new Set<string>();
        const queueUp = [featureUnit.id];
        const visitedUp = new Set<string>();
        while (queueUp.length > 0) {
          const current = queueUp.shift()!;
          if (visitedUp.has(current)) continue;
          visitedUp.add(current);
          const aboveRelations = state.relations.filter(
            (r) => r.toUnitId === current && (r.type === '叠压' || r.type === '打破')
          );
          for (const rel of aboveRelations) {
            laterUnits.add(rel.fromUnitId);
            queueUp.push(rel.fromUnitId);
          }
        }

        const featuresInLaterUnits = state.features.filter(
          (f) => f.id !== featureId && laterUnits.has(f.unitId) && f.periodId
        );

        for (const laterFeature of featuresInLaterUnits) {
          const laterPeriod = state.periods.find((p) => p.id === laterFeature.periodId);
          if (laterPeriod && laterPeriod.order < period.order) {
            warnings.push(
              `「${laterFeature.featureNumber}」所属地层单位在"${featureUnit.code}"之上（更晚），却分配了更早时期"${laterPeriod.name}"，而当前要分配的"${period.name}"更晚，违反时序约束`
            );
          }
        }

        return { valid: warnings.length === 0, warnings };
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

      addControlPoint: (data) => {
        if (!checkActionPermission('controlPoint:create')) {
          throw new Error('没有权限创建控制点');
        }
        const state = get();
        const existing = state.controlPoints.find(
          (cp) => cp.trenchId === data.trenchId && cp.code === data.code
        );
        if (existing) {
          return null;
        }

        const point: ControlPoint = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };

        set((state) => ({
          controlPoints: [...state.controlPoints, point],
        }));

        logOperationToStorage({
          operation: 'create',
          targetType: 'controlPoint',
          targetId: point.id,
          targetName: point.code,
          details: `创建控制点: ${point.code} (${point.type}), 坐标(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`,
        });

        return point;
      },

      updateControlPoint: (id, data) => {
        if (!checkActionPermission('controlPoint:edit')) {
          throw new Error('没有权限编辑控制点');
        }
        const existing = get().controlPoints.find((cp) => cp.id === id);
        if (!existing) return;

        if (existing.type === '基准点' && (data.x !== undefined || data.y !== undefined || data.z !== undefined)) {
          throw new Error('基准点坐标不可修改');
        }

        if (data.code && data.code !== existing.code) {
          const duplicate = get().controlPoints.find(
            (cp) => cp.trenchId === existing.trenchId && cp.code === data.code && cp.id !== id
          );
          if (duplicate) {
            throw new Error('控制点编号已存在');
          }
        }

        const changes = Object.keys(data)
          .map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`)
          .join(', ');

        logOperationToStorage({
          operation: 'update',
          targetType: 'controlPoint',
          targetId: id,
          targetName: existing.code,
          details: `更新控制点: ${existing.code}, ${changes}`,
        });

        set((state) => ({
          controlPoints: state.controlPoints.map((cp) =>
            cp.id === id ? { ...cp, ...data } : cp
          ),
        }));
      },

      deleteControlPoint: (id) => {
        if (!checkActionPermission('controlPoint:delete')) {
          throw new Error('没有权限删除控制点');
        }
        const existing = get().controlPoints.find((cp) => cp.id === id);
        if (!existing) return;

        if (existing.type === '基准点') {
          throw new Error('基准点不可删除');
        }

        logOperationToStorage({
          operation: 'delete',
          targetType: 'controlPoint',
          targetId: id,
          targetName: existing.code,
          details: `删除控制点: ${existing.code} (${existing.type})`,
        });

        set((state) => ({
          controlPoints: state.controlPoints.filter((cp) => cp.id !== id),
          selectedControlPointId: state.selectedControlPointId === id ? null : state.selectedControlPointId,
        }));
      },

      getControlPointsByTrench: (trenchId) => {
        return get().controlPoints.filter((cp) => cp.trenchId === trenchId);
      },

      getControlPointById: (id) => {
        return get().controlPoints.find((cp) => cp.id === id);
      },

      setSelectedControlPoint: (id) => set({ selectedControlPointId: id }),

      batchImportControlPoints: (trenchId, importText, defaultType, measuredBy) => {
        if (!checkActionPermission('controlPoint:create')) {
          throw new Error('没有权限创建控制点');
        }

        const rows = parseControlPointImport(importText);
        const validRows = rows.filter((r) => r.valid);
        const failedRows = rows.filter((r) => !r.valid);

        const state = get();
        const existingPoints = state.controlPoints.filter((cp) => cp.trenchId === trenchId);
        const existingCodes = new Set(existingPoints.map((cp) => cp.code));

        const newPoints: ControlPoint[] = [];
        const actuallyFailed: ControlPointImportRow[] = [...failedRows];

        for (const row of validRows) {
          if (existingCodes.has(row.code)) {
            actuallyFailed.push({
              ...row,
              valid: false,
              errors: [...row.errors, '编号已存在'],
            });
            continue;
          }

          if (row.xNum === undefined || row.yNum === undefined || row.zNum === undefined) {
            actuallyFailed.push({
              ...row,
              valid: false,
              errors: [...row.errors, '坐标数据无效'],
            });
            continue;
          }

          const point: ControlPoint = {
            id: generateId(),
            trenchId,
            code: row.code,
            x: Math.round(row.xNum * 1000) / 1000,
            y: Math.round(row.yNum * 1000) / 1000,
            z: Math.round(row.zNum * 1000) / 1000,
            type: defaultType,
            measuredAt: Date.now(),
            measuredBy,
            createdAt: Date.now(),
          };

          newPoints.push(point);
          existingCodes.add(row.code);
        }

        if (newPoints.length > 0) {
          set((state) => ({
            controlPoints: [...state.controlPoints, ...newPoints],
          }));

          logOperationToStorage({
            operation: 'create',
            targetType: 'controlPoint',
            targetId: 'batch',
            targetName: `批量导入${newPoints.length}个`,
            details: `批量导入控制点: 成功${newPoints.length}个, 失败${actuallyFailed.length}个`,
          });
        }

        return {
          success: newPoints.length,
          failed: actuallyFailed,
        };
      },

      interpolateElevationAt: (x, y, trenchId) => {
        const state = get();
        const points = state.controlPoints.filter((cp) => cp.trenchId === trenchId);
        return interpolateIDW(x, y, points);
      },

      getElevationAnomalies: (trenchId) => {
        const state = get();
        const cells = state.cells.filter((c) => c.trenchId === trenchId);
        const strats = state.stratigraphies.filter((s) => s.trenchId === trenchId);
        const points = state.controlPoints.filter((cp) => cp.trenchId === trenchId);
        return checkElevationAnomalies(cells, strats, points);
      },

      generateContoursForTrench: (trenchId, interval) => {
        const state = get();
        const trench = state.trenches.find((t) => t.id === trenchId);
        if (!trench) return [];

        const points = state.controlPoints.filter((cp) => cp.trenchId === trenchId);
        const cells = state.cells.filter((c) => c.trenchId === trenchId);

        if (cells.length === 0) return [];

        let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
        for (const cell of cells) {
          xMin = Math.min(xMin, cell.xMin);
          yMin = Math.min(yMin, cell.yMin);
          xMax = Math.max(xMax, cell.xMax);
          yMax = Math.max(yMax, cell.yMax);
        }

        const contourInterval = interval ?? state.contourConfig.interval;
        return generateContours(points, xMin, yMin, xMax, yMax, contourInterval);
      },

      setContourConfig: (config) => {
        set((state) => ({
          contourConfig: { ...state.contourConfig, ...config },
        }));
      },

      setShowControlPointsOnMap: (show) => {
        set({ showControlPointsOnMap: show });
      },

      createProfile: (data) => {
        if (!checkActionPermission('stratigraphy:create')) {
          throw new Error('没有权限创建剖面');
        }
        const currentUserId = getCurrentUserId();
        const now = Date.now();
        const profile: ProfileSection = {
          ...data,
          id: generateId(),
          boundaryLines: [],
          cutLines: [],
          annotations: [],
          createdAt: now,
          updatedAt: now,
          createdBy: currentUserId || undefined,
        };
        set((state) => ({
          profiles: [...state.profiles, profile],
          selectedProfileId: state.selectedProfileId || profile.id,
        }));
        logOperationToStorage({
          operation: 'create',
          targetType: 'stratigraphy',
          targetId: profile.id,
          targetName: profile.name,
          details: `创建剖面: ${profile.name}`,
        });
        return profile;
      },

      updateProfile: (id, data) => {
        if (!checkActionPermission('stratigraphy:edit')) {
          throw new Error('没有权限编辑剖面');
        }
        const existing = get().profiles.find((p) => p.id === id);
        if (!existing) return;
        logOperationToStorage({
          operation: 'update',
          targetType: 'stratigraphy',
          targetId: id,
          targetName: existing.name,
          details: `更新剖面: ${existing.name}`,
        });
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p
          ),
        }));
      },

      deleteProfile: (id) => {
        if (!checkActionPermission('stratigraphy:delete')) {
          throw new Error('没有权限删除剖面');
        }
        const existing = get().profiles.find((p) => p.id === id);
        logOperationToStorage({
          operation: 'delete',
          targetType: 'stratigraphy',
          targetId: id,
          targetName: existing?.name,
          details: `删除剖面: ${existing?.name || id}`,
        });
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
          selectedProfileId: state.selectedProfileId === id ? null : state.selectedProfileId,
        }));
      },

      setSelectedProfile: (id) => set({ selectedProfileId: id }),

      getProfilesByTrench: (trenchId) => {
        return get().profiles.filter((p) => p.trenchId === trenchId);
      },

      getProfileById: (id) => {
        return get().profiles.find((p) => p.id === id);
      },

      addBoundaryLine: (data) => {
        if (!checkActionPermission('stratigraphy:create')) {
          throw new Error('没有权限添加界面线');
        }
        const now = Date.now();
        const line: ProfileBoundaryLine = {
          ...data,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === data.profileId
              ? { ...p, boundaryLines: [...p.boundaryLines, line], updatedAt: now }
              : p
          ),
        }));
        logOperationToStorage({
          operation: 'create',
          targetType: 'stratigraphy',
          targetId: line.id,
          targetName: `${data.type === 'top' ? '顶面' : '底面'}线`,
          details: `添加地层界面线: ${data.type === 'top' ? '顶面' : '底面'}`,
        });
        return line;
      },

      updateBoundaryLine: (id, data) => {
        if (!checkActionPermission('stratigraphy:edit')) {
          throw new Error('没有权限编辑界面线');
        }
        const now = Date.now();
        set((state) => ({
          profiles: state.profiles.map((p) => ({
            ...p,
            boundaryLines: p.boundaryLines.map((l) =>
              l.id === id ? { ...l, ...data, updatedAt: now } : l
            ),
            updatedAt: p.boundaryLines.some((l) => l.id === id) ? now : p.updatedAt,
          })),
        }));
        logOperationToStorage({
          operation: 'update',
          targetType: 'stratigraphy',
          targetId: id,
          details: `更新地层界面线`,
        });
      },

      deleteBoundaryLine: (id) => {
        if (!checkActionPermission('stratigraphy:delete')) {
          throw new Error('没有权限删除界面线');
        }
        const now = Date.now();
        set((state) => ({
          profiles: state.profiles.map((p) => ({
            ...p,
            boundaryLines: p.boundaryLines.filter((l) => l.id !== id),
            updatedAt: p.boundaryLines.some((l) => l.id === id) ? now : p.updatedAt,
          })),
        }));
        logOperationToStorage({
          operation: 'delete',
          targetType: 'stratigraphy',
          targetId: id,
          details: `删除地层界面线`,
        });
      },

      getBoundaryLinesByProfile: (profileId) => {
        const profile = get().profiles.find((p) => p.id === profileId);
        return profile ? profile.boundaryLines : [];
      },

      addCutLine: (data) => {
        if (!checkActionPermission('feature:create')) {
          throw new Error('没有权限添加打破线');
        }
        const now = Date.now();
        const line: ProfileCutLine = {
          ...data,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === data.profileId
              ? { ...p, cutLines: [...p.cutLines, line], updatedAt: now }
              : p
          ),
        }));
        logOperationToStorage({
          operation: 'create',
          targetType: 'feature',
          targetId: line.id,
          targetName: data.featureNumber,
          details: `添加打破线: ${data.featureNumber}`,
        });
        return line;
      },

      updateCutLine: (id, data) => {
        if (!checkActionPermission('feature:edit')) {
          throw new Error('没有权限编辑打破线');
        }
        const now = Date.now();
        set((state) => ({
          profiles: state.profiles.map((p) => ({
            ...p,
            cutLines: p.cutLines.map((l) =>
              l.id === id ? { ...l, ...data, updatedAt: now } : l
            ),
            updatedAt: p.cutLines.some((l) => l.id === id) ? now : p.updatedAt,
          })),
        }));
      },

      deleteCutLine: (id) => {
        if (!checkActionPermission('feature:delete')) {
          throw new Error('没有权限删除打破线');
        }
        const now = Date.now();
        set((state) => ({
          profiles: state.profiles.map((p) => ({
            ...p,
            cutLines: p.cutLines.filter((l) => l.id !== id),
            updatedAt: p.cutLines.some((l) => l.id === id) ? now : p.updatedAt,
          })),
        }));
      },

      getCutLinesByProfile: (profileId) => {
        const profile = get().profiles.find((p) => p.id === profileId);
        return profile ? profile.cutLines : [];
      },

      addAnnotation: (data) => {
        if (!checkActionPermission('stratigraphy:create')) {
          throw new Error('没有权限添加注记');
        }
        const now = Date.now();
        const annotation: ProfileAnnotation = {
          ...data,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === data.profileId
              ? { ...p, annotations: [...p.annotations, annotation], updatedAt: now }
              : p
          ),
        }));
        return annotation;
      },

      updateAnnotation: (id, data) => {
        if (!checkActionPermission('stratigraphy:edit')) {
          throw new Error('没有权限编辑注记');
        }
        const now = Date.now();
        set((state) => ({
          profiles: state.profiles.map((p) => ({
            ...p,
            annotations: p.annotations.map((a) =>
              a.id === id ? { ...a, ...data, updatedAt: now } : a
            ),
            updatedAt: p.annotations.some((a) => a.id === id) ? now : p.updatedAt,
          })),
        }));
      },

      deleteAnnotation: (id) => {
        if (!checkActionPermission('stratigraphy:delete')) {
          throw new Error('没有权限删除注记');
        }
        const now = Date.now();
        set((state) => ({
          profiles: state.profiles.map((p) => ({
            ...p,
            annotations: p.annotations.filter((a) => a.id !== id),
            updatedAt: p.annotations.some((a) => a.id === id) ? now : p.updatedAt,
          })),
        }));
      },

      getAnnotationsByProfile: (profileId) => {
        const profile = get().profiles.find((p) => p.id === profileId);
        return profile ? profile.annotations : [];
      },

      getProfileIntersections: (trenchId) => {
        const state = get();
        const profiles = state.profiles.filter((p) => p.trenchId === trenchId);
        const intersections: ProfileIntersection[] = [];

        for (let i = 0; i < profiles.length; i++) {
          for (let j = i + 1; j < profiles.length; j++) {
            const profileA = profiles[i];
            const profileB = profiles[j];

            const sharedCells = profileA.cellIds.filter((cid) =>
              profileB.cellIds.includes(cid)
            );

            for (const cellId of sharedCells) {
              const cell = state.cells.find((c) => c.id === cellId);
              if (!cell) continue;

              const idxA = profileA.cellIds.indexOf(cellId);
              const idxB = profileB.cellIds.indexOf(cellId);

              const distanceA = idxA * (profileA.totalLength / profileA.cellIds.length) +
                (profileA.totalLength / profileA.cellIds.length / 2);
              const distanceB = idxB * (profileB.totalLength / profileB.cellIds.length) +
                (profileB.totalLength / profileB.cellIds.length / 2);

              const unitIds = new Set<string>();
              profileA.boundaryLines.forEach((l) => unitIds.add(l.unitId));
              profileB.boundaryLines.forEach((l) => unitIds.add(l.unitId));

              for (const unitId of unitIds) {
                const getElevationAt = (
                  profile: ProfileSection,
                  distance: number,
                  unitId: string,
                  type: BoundaryType
                ): number | undefined => {
                  const line = profile.boundaryLines.find(
                    (l) => l.unitId === unitId && l.type === type
                  );
                  if (!line || line.points.length < 2) return undefined;

                  const totalDist = profile.totalLength;
                  const xRatio = distance / totalDist;
                  const pointIdx = Math.floor(xRatio * (line.points.length - 1));
                  const nextIdx = Math.min(pointIdx + 1, line.points.length - 1);

                  if (pointIdx >= line.points.length) return undefined;

                  const p1 = line.points[pointIdx];
                  const p2 = line.points[nextIdx];
                  const localT = (xRatio * (line.points.length - 1)) % 1;

                  return p1.y + (p2.y - p1.y) * localT;
                };

                const elevA = getElevationAt(profileA, distanceA, unitId, 'top');
                const elevB = getElevationAt(profileB, distanceB, unitId, 'top');

                if (elevA !== undefined && elevB !== undefined) {
                  const deviation = Math.abs(elevA - elevB);
                  intersections.push({
                    id: generateId(),
                    profileIdA: profileA.id,
                    profileIdB: profileB.id,
                    cellId,
                    distanceA,
                    distanceB,
                    elevationA: elevA,
                    elevationB: elevB,
                    unitId,
                    aligned: deviation <= 0.05,
                    deviation,
                  });
                }
              }
            }
          }
        }

        return intersections;
      },

      alignBoundaryAtIntersection: (intersectionId, sourceProfileId, unitId) => {
        const state = get();
        const intersections = state.getProfileIntersections(state.selectedTrenchId || '');
        const intersection = intersections.find((i) => i.id === intersectionId);
        if (!intersection) return;

        const targetProfileId =
          intersection.profileIdA === sourceProfileId
            ? intersection.profileIdB
            : intersection.profileIdA;

        const sourceElevation =
          intersection.profileIdA === sourceProfileId
            ? intersection.elevationA
            : intersection.elevationB;

        if (sourceElevation === undefined) return;

        const targetDistance =
          intersection.profileIdA === sourceProfileId
            ? intersection.distanceB
            : intersection.distanceA;

        set((state) => ({
          profiles: state.profiles.map((p) => {
            if (p.id !== targetProfileId) return p;

            const totalDist = p.totalLength;
            const xRatio = targetDistance / totalDist;

            return {
              ...p,
              boundaryLines: p.boundaryLines.map((l) => {
                if (l.unitId !== unitId) return l;

                const pointIdx = Math.floor(xRatio * (l.points.length - 1));
                if (pointIdx < 0 || pointIdx >= l.points.length) return l;

                const newPoints = [...l.points];
                newPoints[pointIdx] = {
                  ...newPoints[pointIdx],
                  y: sourceElevation,
                };

                return {
                  ...l,
                  points: newPoints,
                  updatedAt: Date.now(),
                };
              }),
              updatedAt: Date.now(),
            };
          }),
        }));

        logOperationToStorage({
          operation: 'update',
          targetType: 'stratigraphy',
          targetId: targetProfileId,
          details: `对齐剖面标高，单位ID: ${unitId}, 标高: ${sourceElevation.toFixed(3)}m`,
        });
      },

      addArtifactSubtype: (data) => {
        if (!checkActionPermission('artifactSubtype:create')) {
          throw new Error('没有权限添加器型');
        }
        const subtype: ArtifactSubtype = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };
        set((state) => ({
          artifactSubtypes: [...state.artifactSubtypes, subtype],
        }));
        logOperationToStorage({
          operation: 'create',
          targetType: 'artifact',
          targetId: subtype.id,
          targetName: subtype.name,
          details: `添加器型: ${subtype.category} - ${subtype.name}`,
        });
        return subtype;
      },

      updateArtifactSubtype: (id, data) => {
        if (!checkActionPermission('artifactSubtype:edit')) {
          throw new Error('没有权限编辑器型');
        }
        const existing = get().artifactSubtypes.find((s) => s.id === id);
        if (!existing) return;
        const changes = Object.keys(data)
          .map((k) => `${k}: ${existing[k as keyof typeof existing]} → ${data[k as keyof typeof data]}`)
          .join(', ');
        logOperationToStorage({
          operation: 'update',
          targetType: 'artifact',
          targetId: id,
          targetName: existing.name,
          details: `更新器型: ${existing.category} - ${existing.name}, ${changes}`,
        });
        set((state) => ({
          artifactSubtypes: state.artifactSubtypes.map((s) =>
            s.id === id ? { ...s, ...data } : s
          ),
        }));
      },

      deleteArtifactSubtype: (id) => {
        if (!checkActionPermission('artifactSubtype:delete')) {
          throw new Error('没有权限删除器型');
        }
        const existing = get().artifactSubtypes.find((s) => s.id === id);
        logOperationToStorage({
          operation: 'delete',
          targetType: 'artifact',
          targetId: id,
          targetName: existing?.name,
          details: `删除器型: ${existing?.category || ''} - ${existing?.name || id}`,
        });
        set((state) => ({
          artifactSubtypes: state.artifactSubtypes.filter((s) => s.id !== id),
          artifacts: state.artifacts.map((a) =>
            a.subtypeId === id ? { ...a, subtypeId: undefined } : a
          ),
        }));
      },

      getSubtypesByCategory: (category) => {
        return get()
          .artifactSubtypes.filter((s) => s.category === category)
          .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      },

      matchArtifactSubtype: (typeText) => {
        if (!typeText || !typeText.trim()) return null;
        const text = typeText.trim();
        const subtypes = get().artifactSubtypes;

        for (const subtype of subtypes) {
          if (subtype.name === text) return subtype;
          if (text.includes(subtype.name)) return subtype;
          if (subtype.name.includes(text)) return subtype;
          if (subtype.aliases) {
            for (const alias of subtype.aliases) {
              if (alias === text || text.includes(alias) || alias.includes(text)) {
                return subtype;
              }
            }
          }
        }
        return null;
      },

      autoAssignSubtypes: () => {
        const state = get();
        let matched = 0;
        let unmatched = 0;
        const updatedArtifacts = state.artifacts.map((a) => {
          if (a.subtypeId) {
            matched++;
            return a;
          }
          const matchedSubtype = state.matchArtifactSubtype(a.type);
          if (matchedSubtype) {
            matched++;
            return { ...a, subtypeId: matchedSubtype.id };
          }
          unmatched++;
          return a;
        });
        set({ artifacts: updatedArtifacts });
        return { matched, unmatched };
      },

      assignArtifactToSubtype: (artifactId, subtypeId) => {
        if (!checkActionPermission('artifact:edit')) {
          throw new Error('没有权限编辑遗物');
        }
        set((state) => ({
          artifacts: state.artifacts.map((a) =>
            a.id === artifactId ? { ...a, subtypeId } : a
          ),
        }));
      },

      setDensityHeatmapConfig: (config) => {
        set((state) => ({
          densityHeatmapConfig: { ...state.densityHeatmapConfig, ...config },
        }));
      },

      setBufferQueryConfig: (config) => {
        set((state) => ({
          bufferQueryConfig: { ...state.bufferQueryConfig, ...config },
        }));
      },

      setNearestNeighborConfig: (config) => {
        set((state) => ({
          nearestNeighborConfig: { ...state.nearestNeighborConfig, ...config },
        }));
      },

      setClusterConfig: (config) => {
        set((state) => ({
          clusterConfig: { ...state.clusterConfig, ...config },
        }));
      },

      getDensityGrid: (trenchId) => {
        const state = get();
        const trench = state.trenches.find((t) => t.id === trenchId);
        if (!trench) return [];

        const allArtifacts = state.artifacts.filter((a) => a.trenchId === trenchId);
        const filteredArtifacts = filterArtifactsByCategory(
          allArtifacts,
          state.densityHeatmapConfig.selectedCategory,
          state.artifactSubtypes
        );

        const xMin = trench.originX;
        const yMin = trench.originY;
        const xMax = trench.originX + trench.cols * trench.cellSize;
        const yMax = trench.originY + trench.rows * trench.cellSize;

        return generateDensityGrid(
          filteredArtifacts,
          xMin,
          yMin,
          xMax,
          yMax,
          state.densityHeatmapConfig.gridSize
        );
      },

      getBufferQueryResult: (trenchId) => {
        const state = get();
        const config = state.bufferQueryConfig;
        if (!config.active) return null;

        const allArtifacts = state.artifacts.filter((a) => a.trenchId === trenchId);

        if (config.mode === 'point' && config.centerPoint) {
          const bufferPolygon = generateCirclePolygon(
            config.centerPoint.x,
            config.centerPoint.y,
            config.radius
          );
          const found = allArtifacts.filter(
            (a) => pointInPolygon(a.x, a.y, bufferPolygon)
          );
          return {
            centerX: config.centerPoint.x,
            centerY: config.centerPoint.y,
            radius: config.radius,
            bufferPolygon,
            artifacts: found,
          };
        }

        if (config.mode === 'feature' && config.selectedFeatureId) {
          const feature = state.features.find((f) => f.id === config.selectedFeatureId);
          if (!feature) return null;

          const result = getArtifactsInFeatureBuffer(
            allArtifacts,
            feature,
            config.radius
          );

          return {
            centerX: result.centroid.x,
            centerY: result.centroid.y,
            radius: config.radius,
            featureId: feature.id,
            bufferPolygon: result.bufferPolygon,
            artifacts: result.artifacts,
          };
        }

        return null;
      },

      getNearestNeighbors: (trenchId) => {
        const state = get();
        const config = state.nearestNeighborConfig;
        if (!config.active || !config.artifactId) return null;

        const allArtifacts = state.artifacts.filter((a) => a.trenchId === trenchId);
        const target = allArtifacts.find((a) => a.id === config.artifactId);
        if (!target) return null;

        const neighbors = findNearestNeighbors(target, allArtifacts, config.neighborCount);
        return {
          artifactId: config.artifactId,
          neighbors,
        };
      },

      getDistributionStats: (artifactIds) => {
        const state = get();
        let artifacts: Artifact[];

        if (artifactIds && artifactIds.length > 0) {
          const idSet = new Set(artifactIds);
          artifacts = state.artifacts.filter((a) => idSet.has(a.id));
        } else {
          const selectedTrenchId = state.selectedTrenchId;
          if (!selectedTrenchId) {
            return {
              count: 0,
              boundingBox: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 },
              elevationRange: { min: 0, max: 0, range: 0 },
              averageNearestNeighborDistance: 0,
            };
          }
          artifacts = state.artifacts.filter((a) => a.trenchId === selectedTrenchId);
        }

        return calculateDistributionStats(artifacts);
      },

      getArtifactClusters: (trenchId) => {
        const state = get();
        if (!state.clusterConfig.visible) return [];

        const allArtifacts = state.artifacts.filter((a) => a.trenchId === trenchId);
        return clusterArtifacts(
          allArtifacts,
          state.clusterConfig.distanceThreshold,
          state.clusterConfig.minClusterSize
        );
      },
    }),
    {
      name: 'archaeology-grid-storage',
    }
  )
);
