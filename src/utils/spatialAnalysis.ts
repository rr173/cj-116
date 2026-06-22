import {
  Artifact,
  Coordinate,
  DensityGridCell,
  DistributionStats,
  ArtifactCluster,
  RelicFeature,
  ArtifactCategory,
} from '../types';
import { generateId } from './index';

export const distance2D = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

export const distance3D = (
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number
): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
};

export const artifactDistance3D = (a: Artifact, b: Artifact): number => {
  return distance3D(a.x, a.y, a.z, b.x, b.y, b.z);
};

export const generateDensityGrid = (
  artifacts: Artifact[],
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
  gridSize: number
): DensityGridCell[] => {
  const gridCells: DensityGridCell[] = [];

  const gridXCount = Math.ceil((xMax - xMin) / gridSize);
  const gridYCount = Math.ceil((yMax - yMin) / gridSize);

  for (let gx = 0; gx < gridXCount; gx++) {
    for (let gy = 0; gy < gridYCount; gy++) {
      const cellXMin = xMin + gx * gridSize;
      const cellXMax = Math.min(cellXMin + gridSize, xMax);
      const cellYMin = yMin + gy * gridSize;
      const cellYMax = Math.min(cellYMin + gridSize, yMax);

      const cellArtifacts = artifacts.filter(
        (a) => a.x >= cellXMin && a.x < cellXMax && a.y >= cellYMin && a.y < cellYMax
      );

      gridCells.push({
        gridX: gx,
        gridY: gy,
        xMin: cellXMin,
        xMax: cellXMax,
        yMin: cellYMin,
        yMax: cellYMax,
        count: cellArtifacts.length,
        artifactIds: cellArtifacts.map((a) => a.id),
      });
    }
  }

  return gridCells;
};

export const getHeatmapColor = (count: number, maxCount: number): string => {
  if (count === 0 || maxCount === 0) return 'transparent';

  const ratio = Math.min(count / maxCount, 1);

  const r = Math.round(254 * ratio + 255 * (1 - ratio));
  const g = Math.round(229 * (1 - ratio) + 229 * ratio * 0.3);
  const b = Math.round(229 * (1 - ratio));

  const alpha = ratio * 0.8 + 0.1;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const pointInPolygon = (px: number, py: number, polygon: Coordinate[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const generateCirclePolygon = (
  cx: number,
  cy: number,
  radius: number,
  segments: number = 64
): Coordinate[] => {
  const points: Coordinate[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  }
  return points;
};

export const bufferPolygon = (
  polygon: Coordinate[],
  distance: number,
  segments: number = 16
): Coordinate[] => {
  if (polygon.length < 3) {
    if (polygon.length === 1) {
      return generateCirclePolygon(polygon[0].x, polygon[0].y, distance, segments * 2);
    }
    return generateCirclePolygon(
      (polygon[0].x + polygon[1].x) / 2,
      (polygon[0].y + polygon[1].y) / 2,
      distance + distance2D(polygon[0].x, polygon[0].y, polygon[1].x, polygon[1].y) / 2,
      segments * 2
    );
  }

  const buffered: Coordinate[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
    const nx1 = -dy1 / len1;
    const ny1 = dx1 / len1;

    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
    const nx2 = -dy2 / len2;
    const ny2 = dx2 / len2;

    const mx = (nx1 + nx2) / 2;
    const my = (ny1 + ny2) / 2;
    const mLen = Math.sqrt(mx * mx + my * my) || 1;
    const scale = distance / mLen;

    const cross = dx1 * dy2 - dy1 * dx2;

    if (cross > 0) {
      buffered.push({
        x: curr.x + mx * scale,
        y: curr.y + my * scale,
      });
    } else {
      const angle = Math.atan2(ny1, nx1);
      const endAngle = Math.atan2(ny2, nx2);

      let startAngle = angle;
      let angleDiff = endAngle - startAngle;
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      const steps = Math.max(1, Math.ceil(Math.abs(angleDiff) / (Math.PI / segments)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const a = startAngle + angleDiff * t;
        buffered.push({
          x: curr.x + Math.cos(a) * distance,
          y: curr.y + Math.sin(a) * distance,
        });
      }
    }
  }

  return buffered;
};

export const getArtifactsInBuffer = (
  artifacts: Artifact[],
  bufferPolygon: Coordinate[],
  centerX: number,
  centerY: number,
  radius: number
): Artifact[] => {
  return artifacts.filter((a) => {
    const dist = distance2D(a.x, a.y, centerX, centerY);
    if (dist <= radius) return true;
    return pointInPolygon(a.x, a.y, bufferPolygon);
  });
};

export const getFeatureBufferPolygon = (
  feature: RelicFeature,
  bufferDistance: number
): Coordinate[] => {
  return bufferPolygon(feature.vertices, bufferDistance, 8);
};

export const getArtifactsInFeatureBuffer = (
  artifacts: Artifact[],
  feature: RelicFeature,
  bufferDistance: number
): { bufferPolygon: Coordinate[]; artifacts: Artifact[]; centroid: Coordinate } => {
  const bufferPoly = bufferPolygon(feature.vertices, bufferDistance, 8);

  const cx = feature.vertices.reduce((sum, v) => sum + v.x, 0) / feature.vertices.length;
  const cy = feature.vertices.reduce((sum, v) => sum + v.y, 0) / feature.vertices.length;

  const found = artifacts.filter((a) => pointInPolygon(a.x, a.y, bufferPoly));

  return {
    bufferPolygon: bufferPoly,
    artifacts: found,
    centroid: { x: cx, y: cy },
  };
};

export const findNearestNeighbors = (
  target: Artifact,
  allArtifacts: Artifact[],
  count: number
): { artifact: Artifact; distance: number }[] => {
  const distances = allArtifacts
    .filter((a) => a.id !== target.id)
    .map((a) => ({
      artifact: a,
      distance: artifactDistance3D(target, a),
    }))
    .sort((a, b) => a.distance - b.distance);

  return distances.slice(0, count);
};

export const calculateDistributionStats = (artifacts: Artifact[]): DistributionStats => {
  if (artifacts.length === 0) {
    return {
      count: 0,
      boundingBox: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 },
      elevationRange: { min: 0, max: 0, range: 0 },
      averageNearestNeighborDistance: 0,
    };
  }

  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  let zMin = Infinity, zMax = -Infinity;

  for (const a of artifacts) {
    xMin = Math.min(xMin, a.x);
    xMax = Math.max(xMax, a.x);
    yMin = Math.min(yMin, a.y);
    yMax = Math.max(yMax, a.y);
    zMin = Math.min(zMin, a.z);
    zMax = Math.max(zMax, a.z);
  }

  let totalNNDist = 0;
  let nnCount = 0;
  for (let i = 0; i < artifacts.length; i++) {
    let minDist = Infinity;
    for (let j = 0; j < artifacts.length; j++) {
      if (i === j) continue;
      const dist = artifactDistance3D(artifacts[i], artifacts[j]);
      if (dist < minDist) {
        minDist = dist;
      }
    }
    if (minDist < Infinity) {
      totalNNDist += minDist;
      nnCount++;
    }
  }

  return {
    count: artifacts.length,
    boundingBox: {
      xMin,
      xMax,
      yMin,
      yMax,
      width: xMax - xMin,
      height: yMax - yMin,
    },
    elevationRange: {
      min: zMin,
      max: zMax,
      range: zMax - zMin,
    },
    averageNearestNeighborDistance: nnCount > 0 ? totalNNDist / nnCount : 0,
  };
};

const crossProduct = (
  o: Coordinate,
  a: Coordinate,
  b: Coordinate
): number => {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
};

export const convexHull = (points: Coordinate[]): Coordinate[] => {
  if (points.length < 3) return [...points];

  const sorted = [...points].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  const lower: Coordinate[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Coordinate[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (
      upper.length >= 2 &&
      crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();

  return [...lower, ...upper];
};

export const clusterArtifacts = (
  artifacts: Artifact[],
  distanceThreshold: number,
  minClusterSize: number
): ArtifactCluster[] => {
  if (artifacts.length === 0) return [];

  const parent: Map<string, string> = new Map();
  const rank: Map<string, number> = new Map();

  const find = (id: string): string => {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  };

  const union = (id1: string, id2: string) => {
    const root1 = find(id1);
    const root2 = find(id2);
    if (root1 === root2) return;

    const rank1 = rank.get(root1) || 1;
    const rank2 = rank.get(root2) || 1;

    if (rank1 < rank2) {
      parent.set(root1, root2);
    } else {
      parent.set(root2, root1);
      if (rank1 === rank2) {
        rank.set(root1, rank1 + 1);
      }
    }
  };

  for (const a of artifacts) {
    parent.set(a.id, a.id);
    rank.set(a.id, 1);
  }

  for (let i = 0; i < artifacts.length; i++) {
    for (let j = i + 1; j < artifacts.length; j++) {
      const dist = artifactDistance3D(artifacts[i], artifacts[j]);
      if (dist <= distanceThreshold) {
        union(artifacts[i].id, artifacts[j].id);
      }
    }
  }

  const clustersMap = new Map<string, Artifact[]>();
  for (const a of artifacts) {
    const root = find(a.id);
    if (!clustersMap.has(root)) {
      clustersMap.set(root, []);
    }
    clustersMap.get(root)!.push(a);
  }

  const clusters: ArtifactCluster[] = [];
  let clusterNum = 1;

  for (const [, members] of clustersMap) {
    if (members.length >= minClusterSize) {
      const hullPoints = convexHull(members.map((m) => ({ x: m.x, y: m.y })));

      const centroid = {
        x: members.reduce((s, m) => s + m.x, 0) / members.length,
        y: members.reduce((s, m) => s + m.y, 0) / members.length,
      };

      clusters.push({
        id: `cluster-${clusterNum}`,
        memberIds: members.map((m) => m.id),
        members,
        convexHull: hullPoints,
        centroid,
      });
      clusterNum++;
    }
  }

  return clusters.sort((a, b) => b.members.length - a.members.length);
};

export const CLUSTER_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
  '#14B8A6',
  '#FBBF24',
];

export const getClusterColor = (index: number): string => {
  return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
};

export const filterArtifactsByCategory = (
  artifacts: Artifact[],
  category: ArtifactCategory | 'all',
  subtypes: { id: string; category: ArtifactCategory }[]
): Artifact[] => {
  if (category === 'all') return artifacts;

  const subtypeIds = new Set(
    subtypes.filter((s) => s.category === category).map((s) => s.id)
  );

  return artifacts.filter((a) => a.subtypeId && subtypeIds.has(a.subtypeId));
};
