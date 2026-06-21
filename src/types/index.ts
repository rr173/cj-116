export type SoilType = '粘土' | '砂土' | '砾石' | '粉土' | '壤土' | '有机质土' | '生土' | '其他';

export type RelationType = '叠压' | '打破' | '被打破';

export interface Coordinate {
  x: number;
  y: number;
}

export interface GridCell {
  id: string;
  code: string;
  trenchId: string;
  row: number;
  col: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  centerX: number;
  centerY: number;
}

export interface Trench {
  id: string;
  name: string;
  code: string;
  description: string;
  rows: number;
  cols: number;
  cellSize: number;
  originX: number;
  originY: number;
  createdAt: number;
}

export interface Stratigraphy {
  id: string;
  cellId: string;
  trenchId: string;
  layerNumber: number;
  topElevation: number;
  bottomElevation: number;
  soilType: SoilType;
  munsellColor: string;
  description: string;
  inclusions: string;
  unitId?: string;
  createdBy?: string;
  createdAt: number;
}

export interface StratigraphicUnit {
  id: string;
  code: string;
  name: string;
  description: string;
  color: string;
  trenchId: string;
}

export interface StratigraphicRelation {
  id: string;
  trenchId: string;
  fromUnitId: string;
  toUnitId: string;
  type: RelationType;
  description: string;
}

export type ArtifactCategory =
  | '陶器'
  | '石器'
  | '骨器'
  | '铜器'
  | '铁器'
  | '玉器'
  | '其他';

export const ARTIFACT_CATEGORIES: ArtifactCategory[] = [
  '陶器',
  '石器',
  '骨器',
  '铜器',
  '铁器',
  '玉器',
  '其他',
];

export const CATEGORY_COLORS: Record<ArtifactCategory, string> = {
  '陶器': '#D97706',
  '石器': '#6B7280',
  '骨器': '#F5DEB3',
  '铜器': '#B8860B',
  '铁器': '#4B5563',
  '玉器': '#10B981',
  '其他': '#9CA3AF',
};

export interface ArtifactSubtype {
  id: string;
  category: ArtifactCategory;
  name: string;
  aliases?: string[];
  createdAt: number;
}

export interface Artifact {
  id: string;
  trenchId: string;
  cellId: string;
  stratigraphyId?: string;
  unitId?: string;
  periodId?: string;
  catalogNumber: string;
  type: string;
  subtypeId?: string;
  material: string;
  description: string;
  dimensions: string;
  photoNumber: string;
  x: number;
  y: number;
  z: number;
  createdBy?: string;
  createdAt: number;
}

export interface HarrisMatrixNode {
  id: string;
  unitId: string;
  label: string;
  description: string;
  x: number;
  y: number;
  level: number;
}

export interface HarrisMatrixEdge {
  id: string;
  fromId: string;
  toId: string;
  type: RelationType;
}

export interface HarrisMatrix {
  nodes: HarrisMatrixNode[];
  edges: HarrisMatrixEdge[];
  hasCycle: boolean;
  cycleNodes: string[];
}

export type SampleType = '碳十四测年' | '孢粉' | '土壤' | '浮选' | '其他';

export type SampleStatus = '采集' | '登记' | '送检' | '检测中' | '结果回填' | '归档';

export const SAMPLE_STATUS_ORDER: SampleStatus[] = ['采集', '登记', '送检', '检测中', '结果回填', '归档'];

export const SAMPLE_TYPE_PREFIX: Record<SampleType, string> = {
  '碳十四测年': 'C14',
  '孢粉': 'BP',
  '土壤': 'TR',
  '浮选': 'FX',
  '其他': 'QT',
};

export interface StatusChangeLog {
  from: SampleStatus;
  to: SampleStatus;
  operator: string;
  timestamp: number;
}

export interface SampleResult {
  description: string;
  values: Record<string, number>;
}

export interface Sample {
  id: string;
  sampleNumber: string;
  type: SampleType;
  status: SampleStatus;
  trenchId: string;
  cellId: string;
  stratigraphyId: string;
  unitId?: string;
  collector: string;
  collectedAt: number;
  statusHistory: StatusChangeLog[];
  laboratory?: string;
  expectedReturnDate?: string;
  batchId?: string;
  result?: SampleResult;
  createdBy?: string;
  createdAt: number;
}

export interface InspectionBatch {
  id: string;
  batchNumber: string;
  laboratory: string;
  sampleIds: string[];
  sentDate: string;
  expectedReturnDate: string;
  createdAt: number;
}

export interface ProfileData {
  cells: GridCell[];
  stratigraphies: Stratigraphy[];
  minElevation: number;
  maxElevation: number;
}

export type PersonRole = '领队' | '技工' | '学生' | '志愿者';

export type PersonStatus = '在岗' | '离场';

export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  organization: string;
  phone: string;
  status: PersonStatus;
  createdAt: number;
}

export type SystemRole = '管理员' | '领队' | '记录员' | '访客';

export type OperationType = 'create' | 'update' | 'delete';

export type TargetType = 'trench' | 'stratigraphy' | 'unit' | 'artifact' | 'person' | 'excavationLog' | 'relation' | 'sample' | 'user' | 'feature' | 'period' | 'controlPoint';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: SystemRole;
  personId?: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface OperationLog {
  id: string;
  userId: string;
  username: string;
  operation: OperationType;
  targetType: TargetType;
  targetId: string;
  targetName?: string;
  details: string;
  timestamp: number;
}

export type PermissionAction =
  | 'trench:create' | 'trench:edit' | 'trench:delete'
  | 'stratigraphy:create' | 'stratigraphy:edit' | 'stratigraphy:delete'
  | 'unit:create' | 'unit:edit' | 'unit:delete'
  | 'artifact:create' | 'artifact:edit' | 'artifact:delete'
  | 'artifactSubtype:create' | 'artifactSubtype:edit' | 'artifactSubtype:delete'
  | 'person:create' | 'person:edit' | 'person:delete'
  | 'excavationLog:create' | 'excavationLog:edit' | 'excavationLog:delete'
  | 'relation:create' | 'relation:delete'
  | 'sample:create' | 'sample:edit' | 'sample:delete'
  | 'feature:create' | 'feature:edit' | 'feature:delete'
  | 'period:create' | 'period:edit' | 'period:delete'
  | 'user:create' | 'user:edit' | 'user:delete'
  | 'controlPoint:create' | 'controlPoint:edit' | 'controlPoint:delete'
  | 'controlPoint:view'
  | 'logs:view';

export type FeatureType = '灰坑' | '房址' | '墓葬' | '灶' | '柱洞' | '沟' | '其他';

export type FeatureRelationType = '叠压' | '打破' | '共存';

export interface RelicFeature {
  id: string;
  trenchId: string;
  featureNumber: string;
  featureType: FeatureType;
  unitId: string;
  topElevation: number;
  bottomElevation: number;
  vertices: Coordinate[];
  coveredCellIds: string[];
  description: string;
  photoNumbers: string;
  periodId?: string;
  createdBy?: string;
  createdAt: number;
}

export interface FeatureSpatialRelation {
  id: string;
  trenchId: string;
  featureIdA: string;
  featureIdB: string;
  type: FeatureRelationType;
  confirmed: boolean;
  createdAt: number;
}

export interface Period {
  id: string;
  trenchId: string;
  name: string;
  dateRange: string;
  color: string;
  order: number;
  createdAt: number;
}

export type ControlPointType = '基准点' | '加密点' | '临时点';

export interface ControlPoint {
  id: string;
  trenchId: string;
  code: string;
  x: number;
  y: number;
  z: number;
  type: ControlPointType;
  measuredAt: number;
  measuredBy: string;
  createdAt: number;
}

export interface IDWResult {
  elevation: number;
  pointsUsed: { point: ControlPoint; distance: number; weight: number }[];
  sufficientAccuracy: boolean;
  warning?: string;
}

export interface ElevationAnomaly {
  stratigraphyId: string;
  cellId: string;
  cellCode: string;
  layerNumber: number;
  topElevation: number;
  bottomElevation: number;
  interpolatedElevation: number;
  topDeviation: number;
  bottomDeviation: number;
  anomalyType: 'top_high' | 'bottom_low' | 'both';
}

export interface ContourLine {
  elevation: number;
  points: { x: number; y: number }[];
}

export interface ContourConfig {
  interval: number;
  showLabels: boolean;
  visible: boolean;
}

export type WeatherType = '晴' | '多云' | '阴' | '小雨' | '中雨' | '大雨' | '雪' | '雾' | '大风';

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
}

export interface ExcavationLog {
  id: string;
  date: string;
  weather: WeatherType;
  participantIds: string[];
  timeSlots: TimeSlot[];
  summary: string;
  newlyExposedCellIds: string[];
  newlyArtifactIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SnapshotCellState {
  cellId: string;
  deepestLayerNumber: number;
  stratigraphyCount: number;
  featureIds: string[];
}

export interface Snapshot {
  id: string;
  trenchId: string;
  name: string;
  remark: string;
  createdAt: number;
  createdBy?: string;
  cellStates: SnapshotCellState[];
  totalArtifacts: number;
  totalSamples: number;
  totalStratigraphies: number;
  totalRelations: number;
  totalFeatures: number;
  exposedCellCount: number;
  totalCellCount: number;
  featureSnapshots: Array<{
    id: string;
    featureNumber: string;
    featureType: FeatureType;
    coveredCellIds: string[];
    topElevation: number;
    bottomElevation: number;
  }>;
}

export type SnapshotViewMode = 'list' | 'timeline' | 'review' | 'compare' | 'stats';

export interface SnapshotCompareResult {
  snapshotA: Snapshot;
  snapshotB: Snapshot;
  newlyExposedCells: string[];
  deepenedCells: string[];
  unchangedCells: string[];
  newStratigraphies: number;
  newArtifacts: number;
  newFeatures: number;
  newRelations: number;
  newSamples: number;
  cellDifferences: Record<string, {
    layerDelta: number;
    status: 'new' | 'deepened' | 'unchanged';
  }>;
}

export type ProfileEditorTool = 'select' | 'boundary' | 'cut' | 'annotation' | 'pan' | 'zoom';

export type BoundaryType = 'top' | 'bottom';

export interface ProfileBezierPoint {
  x: number;
  y: number;
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
}

export interface ProfileBoundaryLine {
  id: string;
  profileId: string;
  trenchId: string;
  unitId: string;
  type: BoundaryType;
  points: ProfileBezierPoint[];
  strokeColor: string;
  strokeWidth: number;
  visible: boolean;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileCutLine {
  id: string;
  profileId: string;
  trenchId: string;
  featureId: string;
  featureNumber: string;
  points: ProfileBezierPoint[];
  strokeColor: string;
  strokeWidth: number;
  dashArray: string;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileAnnotation {
  id: string;
  profileId: string;
  trenchId: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  rotation: number;
  color: string;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileElevationReference {
  cellId: string;
  stratigraphyId: string;
  distance: number;
  topElevation: number;
  bottomElevation: number;
  layerNumber: number;
  unitId?: string;
}

export interface ProfileIntersection {
  id: string;
  profileIdA: string;
  profileIdB: string;
  cellId: string;
  distanceA: number;
  distanceB: number;
  elevationA?: number;
  elevationB?: number;
  unitId?: string;
  aligned: boolean;
  deviation: number;
}

export interface ProfileSection {
  id: string;
  trenchId: string;
  name: string;
  description: string;
  startCellId: string;
  endCellId: string;
  direction: 'horizontal' | 'vertical' | 'diagonal';
  cellIds: string[];
  minElevation: number;
  maxElevation: number;
  totalLength: number;
  width: number;
  height: number;
  boundaryLines: ProfileBoundaryLine[];
  cutLines: ProfileCutLine[];
  annotations: ProfileAnnotation[];
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export type ViewType = 'grid' | 'stratigraphy' | 'units' | 'matrix' | 'artifacts' | 'samples' | 'profile' | 'profileEditor' | 'personnel' | 'logs' | 'workhours' | 'timeline' | 'users' | 'operationLogs' | 'features' | 'controlPoints' | 'snapshots';
