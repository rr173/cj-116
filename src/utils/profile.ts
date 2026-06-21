import {
  ProfileSection,
  ProfileBoundaryLine,
  ProfileBezierPoint,
  GridCell,
  Stratigraphy,
  ProfileElevationReference,
} from '../types';

export const generateBezierPath = (points: ProfileBezierPoint[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    if (prev.cp2x !== undefined && prev.cp2y !== undefined &&
        curr.cp1x !== undefined && curr.cp1y !== undefined) {
      path += ` C ${prev.cp2x} ${prev.cp2y}, ${curr.cp1x} ${curr.cp1y}, ${curr.x} ${curr.y}`;
    } else {
      path += ` L ${curr.x} ${curr.y}`;
    }
  }

  return path;
};

export const calculateProfileCells = (
  startCell: GridCell,
  endCell: GridCell,
  cells: GridCell[]
): GridCell[] => {
  if (startCell.row === endCell.row) {
    const row = startCell.row;
    const minCol = Math.min(startCell.col, endCell.col);
    const maxCol = Math.max(startCell.col, endCell.col);
    return cells
      .filter((c) => c.row === row && c.col >= minCol && c.col <= maxCol)
      .sort((a, b) => a.col - b.col);
  }

  if (startCell.col === endCell.col) {
    const col = startCell.col;
    const minRow = Math.min(startCell.row, endCell.row);
    const maxRow = Math.max(startCell.row, endCell.row);
    return cells
      .filter((c) => c.col === col && c.row >= minRow && c.row <= maxRow)
      .sort((a, b) => b.row - a.row);
  }

  return [];
};

export const calculateProfileDirection = (
  startCell: GridCell,
  endCell: GridCell
): 'horizontal' | 'vertical' | 'diagonal' => {
  if (startCell.row === endCell.row) return 'horizontal';
  if (startCell.col === endCell.col) return 'vertical';
  return 'diagonal';
};

export const calculateTotalLength = (
  cells: GridCell[],
  cellSize: number
): number => {
  return cells.length * cellSize;
};

export const calculateElevationRange = (
  cells: GridCell[],
  stratigraphies: Stratigraphy[]
): { minElevation: number; maxElevation: number } => {
  let minElev = Infinity;
  let maxElev = -Infinity;

  cells.forEach((cell) => {
    const strats = stratigraphies.filter((s) => s.cellId === cell.id);
    strats.forEach((s) => {
      if (s.topElevation > maxElev) maxElev = s.topElevation;
      if (s.bottomElevation < minElev) minElev = s.bottomElevation;
    });
  });

  if (minElev === Infinity) {
    minElev = 0;
    maxElev = 5;
  }

  return {
    minElevation: minElev - 0.5,
    maxElevation: maxElev + 0.5,
  };
};

export const getElevationReferences = (
  profile: ProfileSection,
  cells: GridCell[],
  stratigraphies: Stratigraphy[],
  cellSize: number
): ProfileElevationReference[] => {
  const references: ProfileElevationReference[] = [];

  profile.cellIds.forEach((cellId, idx) => {
    const cell = cells.find((c) => c.id === cellId);
    if (!cell) return;

    const cellStrats = stratigraphies
      .filter((s) => s.cellId === cellId)
      .sort((a, b) => b.topElevation - a.topElevation);

    cellStrats.forEach((strat) => {
      const distance = idx * cellSize + cellSize / 2;
      references.push({
        cellId,
        stratigraphyId: strat.id,
        distance,
        topElevation: strat.topElevation,
        bottomElevation: strat.bottomElevation,
        layerNumber: strat.layerNumber,
        unitId: strat.unitId,
      });
    });
  });

  return references;
};

export const getCellBoundaryPositions = (
  profile: ProfileSection,
  cellSize: number
): number[] => {
  const positions: number[] = [];
  for (let i = 0; i <= profile.cellIds.length; i++) {
    positions.push(i * cellSize);
  }
  return positions;
};

export const evaluateBezierAt = (
  points: ProfileBezierPoint[],
  t: number
): { x: number; y: number } => {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y };

  const totalSegments = points.length - 1;
  const segmentT = t * totalSegments;
  const segmentIdx = Math.min(Math.floor(segmentT), totalSegments - 1);
  const localT = segmentT - segmentIdx;

  const p0 = points[segmentIdx];
  const p1 = points[segmentIdx + 1];

  const cp1x = p0.cp2x ?? p0.x + (p1.x - p0.x) / 3;
  const cp1y = p0.cp2y ?? p0.y + (p1.y - p0.y) / 3;
  const cp2x = p1.cp1x ?? p0.x + (p1.x - p0.x) * 2 / 3;
  const cp2y = p1.cp1y ?? p0.y + (p1.y - p0.y) * 2 / 3;

  const mt = 1 - localT;
  const x = mt * mt * mt * p0.x + 3 * mt * mt * localT * cp1x + 3 * mt * localT * localT * cp2x + localT * localT * localT * p1.x;
  const y = mt * mt * mt * p0.y + 3 * mt * mt * localT * cp1y + 3 * mt * localT * localT * cp2y + localT * localT * localT * p1.y;

  return { x, y };
};

export const findNearestPointOnCurve = (
  points: ProfileBezierPoint[],
  targetX: number,
  targetY: number,
  samples: number = 100
): { t: number; x: number; y: number; distance: number } => {
  let nearest = { t: 0, x: 0, y: 0, distance: Infinity };

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const pt = evaluateBezierAt(points, t);
    const distance = Math.sqrt((pt.x - targetX) ** 2 + (pt.y - targetY) ** 2);
    if (distance < nearest.distance) {
      nearest = { t, x: pt.x, y: pt.y, distance };
    }
  }

  return nearest;
};

export const generateFillPath = (
  topLine: ProfileBoundaryLine,
  bottomLine: ProfileBoundaryLine
): string => {
  if (topLine.points.length < 2 || bottomLine.points.length < 2) return '';

  const topPath = generateBezierPath(topLine.points);

  const reversedBottom = [...bottomLine.points].reverse();
  const bottomPath = generateBezierPath(reversedBottom).replace('M', 'L');

  return `${topPath} ${bottomPath} Z`;
};

export const exportProfileToSVG = (
  profile: ProfileSection,
  cells: GridCell[],
  units: { id: string; code: string; name: string; color: string }[],
  features: { id: string; featureNumber: string }[],
  cellSize: number,
  width: number = 1200,
  height: number = 800
): string => {
  const margin = { top: 60, right: 80, bottom: 80, left: 80 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const xScale = (x: number) => margin.left + (x / profile.totalLength) * plotWidth;
  const yScale = (y: number) =>
    margin.top + plotHeight - ((y - profile.minElevation) / (profile.maxElevation - profile.minElevation)) * plotHeight;

  const transformPoints = (points: ProfileBezierPoint[]): ProfileBezierPoint[] =>
    points.map((p) => ({
      ...p,
      x: xScale(p.x),
      y: yScale(p.y),
      cp1x: p.cp1x !== undefined ? xScale(p.cp1x) : undefined,
      cp1y: p.cp1y !== undefined ? yScale(p.cp1y) : undefined,
      cp2x: p.cp2x !== undefined ? xScale(p.cp2x) : undefined,
      cp2y: p.cp2y !== undefined ? yScale(p.cp2y) : undefined,
    }));

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .title { font: bold 18px sans-serif; fill: #333; }
      .axis-label { font: 12px sans-serif; fill: #666; }
      .tick-label { font: 10px sans-serif; fill: #666; }
      .grid-line { stroke: #e0e0e0; stroke-width: 1; }
      .cell-boundary { stroke: #999; stroke-width: 1; stroke-dasharray: 4,2; }
      .boundary-line { stroke-width: 2; fill: none; }
      .cut-line { stroke-width: 1.5; fill: none; }
      .annotation { font: 12px sans-serif; fill: #333; }
      .legend-title { font: bold 14px sans-serif; fill: #333; }
      .legend-item { font: 11px sans-serif; fill: #666; }
    </style>
  </defs>

  <rect width="${width}" height="${height}" fill="white"/>

  <text x="${width / 2}" y="30" text-anchor="middle" class="title">${profile.name}</text>
  ${profile.description ? `<text x="${width / 2}" y="50" text-anchor="middle" class="axis-label">${profile.description}</text>` : ''}

  <g id="grid">`;

  const elevRange = profile.maxElevation - profile.minElevation;
  const tickInterval = elevRange <= 5 ? 0.5 : elevRange <= 10 ? 1 : 2;
  for (let e = Math.ceil(profile.minElevation / tickInterval) * tickInterval; e <= profile.maxElevation; e += tickInterval) {
    const y = yScale(e);
    svg += `
    <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="grid-line"/>
    <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" class="tick-label">${e.toFixed(1)}m</text>`;
  }

  const cellPositions = getCellBoundaryPositions(profile, cellSize);
  cellPositions.forEach((pos, i) => {
    const x = xScale(pos);
    svg += `
    <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" class="cell-boundary"/>`;
    if (i < profile.cellIds.length) {
      const cell = cells.find((c) => c.id === profile.cellIds[i]);
      if (cell) {
        const midX = xScale(pos + cellSize / 2);
        svg += `
    <text x="${midX}" y="${height - margin.bottom + 20}" text-anchor="middle" class="tick-label">${cell.code}</text>`;
      }
    }
  });

  svg += `
  </g>

  <g id="fills">`;

  const unitIds = new Set(profile.boundaryLines.map((l) => l.unitId));
  unitIds.forEach((unitId) => {
    const topLine = profile.boundaryLines.find((l) => l.unitId === unitId && l.type === 'top');
    const bottomLine = profile.boundaryLines.find((l) => l.unitId === unitId && l.type === 'bottom');
    const unit = units.find((u) => u.id === unitId);

    if (topLine && bottomLine && unit) {
      const fillPath = generateFillPath(
        { ...topLine, points: transformPoints(topLine.points) },
        { ...bottomLine, points: transformPoints(bottomLine.points) }
      );
      svg += `
    <path d="${fillPath}" fill="${unit.color}" fill-opacity="0.6"/>`;
    }
  });

  svg += `
  </g>

  <g id="boundary-lines">`;

  profile.boundaryLines.forEach((line) => {
    if (!line.visible) return;
    const path = generateBezierPath(transformPoints(line.points));
    svg += `
    <path d="${path}" class="boundary-line" stroke="${line.strokeColor}" stroke-width="${line.strokeWidth}"/>`;
  });

  svg += `
  </g>

  <g id="cut-lines">`;

  profile.cutLines.forEach((line) => {
    if (!line.visible) return;
    const path = generateBezierPath(transformPoints(line.points));
    const feature = features.find((f) => f.id === line.featureId);
    const labelX = transformPoints(line.points)[Math.floor(line.points.length / 2)]?.x || 0;
    const labelY = transformPoints(line.points)[Math.floor(line.points.length / 2)]?.y || 0;
    svg += `
    <path d="${path}" class="cut-line" stroke="${line.strokeColor}" stroke-width="${line.strokeWidth}" stroke-dasharray="${line.dashArray}"/>
    <text x="${labelX}" y="${labelY - 5}" text-anchor="middle" class="annotation" fill="${line.strokeColor}">${feature?.featureNumber || line.featureNumber}</text>`;
  });

  svg += `
  </g>

  <g id="annotations">`;

  profile.annotations.forEach((ann) => {
    if (!ann.visible) return;
    const x = xScale(ann.x);
    const y = yScale(ann.y);
    svg += `
    <text x="${x}" y="${y}" text-anchor="middle" class="annotation" font-size="${ann.fontSize}" fill="${ann.color}" transform="rotate(${ann.rotation} ${x} ${y})">${ann.text}</text>`;
  });

  svg += `
  </g>

  <g id="legend" transform="translate(${width - margin.right + 20}, ${margin.top})">
    <text x="0" y="0" class="legend-title">图例</text>`;

  let legendY = 25;
  units.forEach((unit) => {
    svg += `
    <rect x="0" y="${legendY - 10}" width="20" height="15" fill="${unit.color}" fill-opacity="0.6" stroke="#999"/>
    <text x="30" y="${legendY + 2}" class="legend-item">${unit.code} - ${unit.name}</text>`;
    legendY += 22;
  });

  svg += `
  </g>

  <text x="${width / 2}" y="${height - 15}" text-anchor="middle" class="axis-label">水平距离 (m)</text>
  <text x="25" y="${height / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90 25 ${height / 2})">标高 (m)</text>
</svg>`;

  return svg;
};

export const downloadSVG = (svgContent: string, filename: string) => {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
