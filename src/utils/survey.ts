import { ControlPoint, IDWResult, ContourLine, ElevationAnomaly, GridCell, Stratigraphy } from '../types';

export const IDW_MAX_POINTS = 6;
export const IDW_POWER = 2;
export const IDW_MAX_DISTANCE = 200;
export const IDW_MIN_POINTS_FOR_ACCURACY = 3;

export const ANOMALY_TOP_THRESHOLD = 0.5;
export const ANOMALY_BOTTOM_THRESHOLD = 5;

export const DEFAULT_CONTOUR_INTERVAL = 0.5;
export const MIN_CONTOUR_INTERVAL = 0.1;
export const MAX_CONTOUR_INTERVAL = 2.0;
export const CONTOUR_GRID_DIVISOR = 5;

export const calculateDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

export const interpolateIDW = (
  x: number,
  y: number,
  controlPoints: ControlPoint[],
  maxPoints: number = IDW_MAX_POINTS,
  power: number = IDW_POWER,
  maxDistance: number = IDW_MAX_DISTANCE
): IDWResult => {
  const pointsWithDistance = controlPoints
    .map((point) => ({
      point,
      distance: calculateDistance(x, y, point.x, point.y),
    }))
    .filter((p) => p.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);

  const nearbyPoints = pointsWithDistance.slice(0, maxPoints);

  const sufficientAccuracy = nearbyPoints.length >= IDW_MIN_POINTS_FOR_ACCURACY;
  const warning = !sufficientAccuracy
    ? `200米范围内控制点不足${IDW_MIN_POINTS_FOR_ACCURACY}个，插值精度不足`
    : undefined;

  if (nearbyPoints.length === 0) {
    return {
      elevation: 0,
      pointsUsed: [],
      sufficientAccuracy: false,
      warning: '200米范围内无控制点，无法插值',
    };
  }

  if (nearbyPoints.length === 1 || nearbyPoints[0].distance === 0) {
    return {
      elevation: nearbyPoints[0].point.z,
      pointsUsed: nearbyPoints.map((p) => ({ ...p, weight: p.distance === 0 ? 1 : 0 })),
      sufficientAccuracy,
      warning,
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;

  const pointsWithWeight = nearbyPoints.map((p) => {
    const weight = 1 / Math.pow(p.distance, power);
    totalWeight += weight;
    weightedSum += weight * p.point.z;
    return { ...p, weight };
  });

  const elevation = totalWeight > 0 ? weightedSum / totalWeight : nearbyPoints[0].point.z;

  return {
    elevation: Math.round(elevation * 1000) / 1000,
    pointsUsed: pointsWithWeight,
    sufficientAccuracy,
    warning,
  };
};

export interface ControlPointImportRow {
  rowIndex: number;
  code: string;
  x: string;
  y: string;
  z: string;
  valid: boolean;
  errors: string[];
  xNum?: number;
  yNum?: number;
  zNum?: number;
}

export const parseControlPointImport = (text: string): ControlPointImportRow[] => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows: ControlPointImportRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const errors: string[] = [];
    const parts = line.split(/[,，\t\s]+/).filter((p) => p.length > 0);

    const row: ControlPointImportRow = {
      rowIndex: i + 1,
      code: '',
      x: '',
      y: '',
      z: '',
      valid: true,
      errors,
    };

    if (parts.length < 4) {
      errors.push('格式错误，需要"编号,X,Y,Z"四列');
      row.valid = false;
      rows.push(row);
      continue;
    }

    row.code = parts[0];
    row.x = parts[1];
    row.y = parts[2];
    row.z = parts[3];

    if (!row.code.trim()) {
      errors.push('编号不能为空');
    }

    const xNum = parseFloat(row.x);
    const yNum = parseFloat(row.y);
    const zNum = parseFloat(row.z);

    if (isNaN(xNum)) {
      errors.push('X坐标不是有效数字');
    } else {
      row.xNum = xNum;
    }

    if (isNaN(yNum)) {
      errors.push('Y坐标不是有效数字');
    } else {
      row.yNum = yNum;
    }

    if (isNaN(zNum)) {
      errors.push('Z标高不是有效数字');
    } else {
      row.zNum = zNum;
    }

    row.valid = errors.length === 0;
    rows.push(row);
  }

  return rows;
};

interface MarchingSquaresGrid {
  values: number[][];
  xMin: number;
  yMin: number;
  cellSize: number;
  cols: number;
  rows: number;
}

const generateElevationGrid = (
  controlPoints: ControlPoint[],
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
  gridSpacing: number
): MarchingSquaresGrid => {
  const cols = Math.ceil((xMax - xMin) / gridSpacing) + 1;
  const rows = Math.ceil((yMax - yMin) / gridSpacing) + 1;

  const values: number[][] = [];

  for (let row = 0; row < rows; row++) {
    values[row] = [];
    for (let col = 0; col < cols; col++) {
      const x = xMin + col * gridSpacing;
      const y = yMin + row * gridSpacing;
      const result = interpolateIDW(x, y, controlPoints);
      values[row][col] = result.elevation;
    }
  }

  return { values, xMin, yMin, cellSize: gridSpacing, cols, rows };
};

const marchingSquaresCell = (
  grid: MarchingSquaresGrid,
  row: number,
  col: number,
  level: number
): { x1: number; y1: number; x2: number; y2: number } | null => {
  const { values, xMin, yMin, cellSize } = grid;

  const v0 = values[row][col];
  const v1 = values[row][col + 1];
  const v2 = values[row + 1][col + 1];
  const v3 = values[row + 1][col];

  const x0 = xMin + col * cellSize;
  const y0 = yMin + row * cellSize;
  const x1 = xMin + (col + 1) * cellSize;
  const y1 = yMin + (row + 1) * cellSize;

  let index = 0;
  if (v0 >= level) index |= 1;
  if (v1 >= level) index |= 2;
  if (v2 >= level) index |= 4;
  if (v3 >= level) index |= 8;

  if (index === 0 || index === 15) return null;

  const interpolateEdge = (vA: number, vB: number, a: number, b: number): number => {
    if (Math.abs(vB - vA) < 1e-10) return a;
    return a + ((level - vA) / (vB - vA)) * (b - a);
  };

  const topX = interpolateEdge(v0, v1, x0, x1);
  const rightY = interpolateEdge(v1, v2, y0, y1);
  const bottomX = interpolateEdge(v3, v2, x0, x1);
  const leftY = interpolateEdge(v0, v3, y0, y1);

  const top = { x: topX, y: y0 };
  const right = { x: x1, y: rightY };
  const bottom = { x: bottomX, y: y1 };
  const left = { x: x0, y: leftY };

  switch (index) {
    case 1:
    case 14:
      return { x1: left.x, y1: left.y, x2: top.x, y2: top.y };
    case 2:
    case 13:
      return { x1: top.x, y1: top.y, x2: right.x, y2: right.y };
    case 3:
    case 12:
      return { x1: left.x, y1: left.y, x2: right.x, y2: right.y };
    case 4:
    case 11:
      return { x1: right.x, y1: right.y, x2: bottom.x, y2: bottom.y };
    case 6:
    case 9:
      return { x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y };
    case 7:
    case 8:
      return { x1: left.x, y1: left.y, x2: bottom.x, y2: bottom.y };
    case 5:
    case 10:
      return { x1: left.x, y1: left.y, x2: bottom.x, y2: bottom.y };
    default:
      return null;
  }
};

const buildContourPaths = (
  segments: { x1: number; y1: number; x2: number; y2: number }[]
): { x: number; y: number }[][] => {
  if (segments.length === 0) return [];

  const paths: { x: number; y: number }[][] = [];
  const used = new Set<number>();
  const tolerance = 1e-6;

  const pointEqual = (p1: { x: number; y: number }, p2: { x: number; y: number }): boolean => {
    return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
  };

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;

    const path: { x: number; y: number }[] = [
      { x: segments[i].x1, y: segments[i].y1 },
      { x: segments[i].x2, y: segments[i].y2 },
    ];
    used.add(i);

    let extended = true;
    while (extended) {
      extended = false;
      const lastPoint = path[path.length - 1];
      const firstPoint = path[0];

      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;

        const seg = segments[j];
        const segStart = { x: seg.x1, y: seg.y1 };
        const segEnd = { x: seg.x2, y: seg.y2 };

        if (pointEqual(lastPoint, segStart)) {
          path.push(segEnd);
          used.add(j);
          extended = true;
          break;
        } else if (pointEqual(lastPoint, segEnd)) {
          path.push(segStart);
          used.add(j);
          extended = true;
          break;
        } else if (pointEqual(firstPoint, segEnd)) {
          path.unshift(segStart);
          used.add(j);
          extended = true;
          break;
        } else if (pointEqual(firstPoint, segStart)) {
          path.unshift(segEnd);
          used.add(j);
          extended = true;
          break;
        }
      }
    }

    paths.push(path);
  }

  return paths;
};

export const generateContours = (
  controlPoints: ControlPoint[],
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
  interval: number = DEFAULT_CONTOUR_INTERVAL
): ContourLine[] => {
  if (controlPoints.length < IDW_MIN_POINTS_FOR_ACCURACY) {
    return [];
  }

  const gridSpacing = interval / CONTOUR_GRID_DIVISOR;
  const grid = generateElevationGrid(controlPoints, xMin, yMin, xMax, yMax, gridSpacing);

  let minElevation = Infinity;
  let maxElevation = -Infinity;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      minElevation = Math.min(minElevation, grid.values[row][col]);
      maxElevation = Math.max(maxElevation, grid.values[row][col]);
    }
  }

  const contours: ContourLine[] = [];

  const startLevel = Math.ceil(minElevation / interval) * interval;
  for (let level = startLevel; level <= maxElevation; level += interval) {
    const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];

    for (let row = 0; row < grid.rows - 1; row++) {
      for (let col = 0; col < grid.cols - 1; col++) {
        const segment = marchingSquaresCell(grid, row, col, level);
        if (segment) {
          segments.push(segment);
        }
      }
    }

    const paths = buildContourPaths(segments);
    for (const path of paths) {
      if (path.length >= 2) {
        contours.push({
          elevation: Math.round(level * 1000) / 1000,
          points: path,
        });
      }
    }
  }

  return contours;
};

export const smoothPath = (
  points: { x: number; y: number }[],
  tension: number = 0.5
): { x: number; y: number }[] => {
  if (points.length < 3) return points;

  const result: { x: number; y: number }[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const steps = 5;
    for (let t = 0; t < steps; t++) {
      const tt = t / steps;
      const tt2 = tt * tt;
      const tt3 = tt2 * tt;

      const x =
        tension * (2 * p1.x + (-p0.x + p2.x) * tt + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tt2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * tt3);
      const y =
        tension * (2 * p1.y + (-p0.y + p2.y) * tt + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * tt2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * tt3);

      result.push({ x, y });
    }
  }

  result.push(points[points.length - 1]);
  return result;
};

export const getLabelPoints = (
  points: { x: number; y: number }[],
  minSpacing: number
): { x: number; y: number; angle: number }[] => {
  if (points.length < 2) return [];

  const labels: { x: number; y: number; angle: number }[] = [];
  let accumulatedDist = 0;
  let lastLabelDist = -minSpacing;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (accumulatedDist - lastLabelDist >= minSpacing) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      labels.push({
        x: points[i].x,
        y: points[i].y,
        angle: angle > 90 || angle < -90 ? angle + 180 : angle,
      });
      lastLabelDist = accumulatedDist;
    }

    accumulatedDist += dist;
  }

  return labels;
};

export const checkElevationAnomalies = (
  cells: GridCell[],
  stratigraphies: Stratigraphy[],
  controlPoints: ControlPoint[]
): ElevationAnomaly[] => {
  const anomalies: ElevationAnomaly[] = [];

  for (const strat of stratigraphies) {
    const cell = cells.find((c) => c.id === strat.cellId);
    if (!cell) continue;

    const interpolatedResult = interpolateIDW(cell.centerX, cell.centerY, controlPoints);
    if (!interpolatedResult.sufficientAccuracy) continue;

    const interpolatedElevation = interpolatedResult.elevation;
    const topDeviation = strat.topElevation - interpolatedElevation;
    const bottomDeviation = strat.bottomElevation - interpolatedElevation;

    const topTooHigh = topDeviation > ANOMALY_TOP_THRESHOLD;
    const bottomTooLow = bottomDeviation < -ANOMALY_BOTTOM_THRESHOLD;

    if (topTooHigh || bottomTooLow) {
      let anomalyType: 'top_high' | 'bottom_low' | 'both';
      if (topTooHigh && bottomTooLow) {
        anomalyType = 'both';
      } else if (topTooHigh) {
        anomalyType = 'top_high';
      } else {
        anomalyType = 'bottom_low';
      }

      anomalies.push({
        stratigraphyId: strat.id,
        cellId: strat.cellId,
        cellCode: cell.code,
        layerNumber: strat.layerNumber,
        topElevation: strat.topElevation,
        bottomElevation: strat.bottomElevation,
        interpolatedElevation,
        topDeviation: Math.round(topDeviation * 1000) / 1000,
        bottomDeviation: Math.round(bottomDeviation * 1000) / 1000,
        anomalyType,
      });
    }
  }

  return anomalies;
};

export const CONTROL_POINT_TYPE_COLORS: Record<string, string> = {
  '基准点': '#DC2626',
  '加密点': '#2563EB',
  '临时点': '#059669',
};

export const CONTROL_POINT_TYPE_ICONS: Record<string, string> = {
  '基准点': '★',
  '加密点': '◆',
  '临时点': '●',
};
