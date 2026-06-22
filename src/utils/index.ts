import { v4 as uuidv4 } from 'uuid';
import {
  GridCell, Trench, Stratigraphy, StratigraphicUnit, StratigraphicRelation, Artifact,
  ArtifactSubtype, ArtifactCategory, ARTIFACT_CATEGORIES, StratigraphicRelation as _unused,
  RelationType, TimeSlot, ExcavationLog, WeatherType, SystemRole, PermissionAction,
  Period,
} from '../types';

export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const computedHash = await hashPassword(password);
  return computedHash === hash;
};

const ROLE_PERMISSIONS: Record<SystemRole, PermissionAction[]> = {
  '管理员': [
    'trench:create', 'trench:edit', 'trench:delete',
    'stratigraphy:create', 'stratigraphy:edit', 'stratigraphy:delete',
    'unit:create', 'unit:edit', 'unit:delete',
    'artifact:create', 'artifact:edit', 'artifact:delete',
    'artifactSubtype:create', 'artifactSubtype:edit', 'artifactSubtype:delete',
    'person:create', 'person:edit', 'person:delete',
    'excavationLog:create', 'excavationLog:edit', 'excavationLog:delete',
    'relation:create', 'relation:delete',
    'sample:create', 'sample:edit', 'sample:delete',
    'feature:create', 'feature:edit', 'feature:delete',
    'period:create', 'period:edit', 'period:delete',
    'controlPoint:create', 'controlPoint:edit', 'controlPoint:delete', 'controlPoint:view',
    'user:create', 'user:edit', 'user:delete',
    'logs:view',
  ],
  '领队': [
    'trench:create', 'trench:edit',
    'stratigraphy:create', 'stratigraphy:edit', 'stratigraphy:delete',
    'unit:create', 'unit:edit', 'unit:delete',
    'artifact:create', 'artifact:edit', 'artifact:delete',
    'person:create', 'person:edit',
    'excavationLog:create', 'excavationLog:edit', 'excavationLog:delete',
    'relation:create', 'relation:delete',
    'sample:create', 'sample:edit', 'sample:delete',
    'feature:create', 'feature:edit', 'feature:delete',
    'period:create', 'period:edit', 'period:delete',
    'controlPoint:create', 'controlPoint:edit', 'controlPoint:delete', 'controlPoint:view',
    'logs:view',
  ],
  '记录员': [
    'stratigraphy:create', 'stratigraphy:edit',
    'artifact:create', 'artifact:edit',
    'sample:create', 'sample:edit',
    'excavationLog:create', 'excavationLog:edit',
    'feature:create', 'feature:edit',
    'period:create', 'period:edit',
    'controlPoint:view',
  ],
  '访客': [
    'controlPoint:view',
  ],
};

export const hasPermission = (role: SystemRole, action: PermissionAction): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
};

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const isSessionExpired = (lastActiveAt: number): boolean => {
  return Date.now() - lastActiveAt > SEVEN_DAYS_MS;
};

export const generateId = (): string => uuidv4();

export const generateGridCode = (trenchCode: string, row: number, col: number): string => {
  return `${trenchCode}N${row}E${col}`;
};

export const generateGridCells = (trench: Trench): GridCell[] => {
  const cells: GridCell[] = [];
  for (let row = 1; row <= trench.rows; row++) {
    for (let col = 1; col <= trench.cols; col++) {
      const xMin = trench.originX + (col - 1) * trench.cellSize;
      const xMax = trench.originX + col * trench.cellSize;
      const yMin = trench.originY + (row - 1) * trench.cellSize;
      const yMax = trench.originY + row * trench.cellSize;
      
      cells.push({
        id: generateId(),
        code: generateGridCode(trench.code, row, col),
        trenchId: trench.id,
        row,
        col,
        xMin,
        xMax,
        yMin,
        yMax,
        centerX: (xMin + xMax) / 2,
        centerY: (yMin + yMax) / 2,
      });
    }
  }
  return cells;
};

export const calculateThickness = (top: number, bottom: number): number => {
  return Math.max(0, top - bottom);
};

export const validateElevationOrder = (stratigraphies: Stratigraphy[]): boolean => {
  const sorted = [...stratigraphies].sort((a, b) => b.topElevation - a.topElevation);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].bottomElevation < sorted[i + 1].topElevation) {
      return false;
    }
  }
  return true;
};

export const SOIL_COLORS: Record<string, string> = {
  '粘土': '#8B4513',
  '砂土': '#D2B48C',
  '砾石': '#696969',
  '粉土': '#DEB887',
  '壤土': '#A0522D',
  '有机质土': '#2F4F4F',
  '生土': '#8B7355',
  '其他': '#9370DB',
};

export const UNIT_COLORS = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
  '#1ABC9C', '#E67E22', '#34495E', '#16A085', '#C0392B',
  '#D35400', '#8E44AD', '#27AE60', '#2980B9', '#F1C40F',
];

export const getUnitColor = (index: number): string => {
  return UNIT_COLORS[index % UNIT_COLORS.length];
};

export const detectCycles = (nodes: string[], edges: { from: string; to: string }[]): boolean => {
  const visited = new Set<string>();
  const recStack = new Set<string>();

  const dfs = (node: string): boolean => {
    visited.add(node);
    recStack.add(node);

    const neighbors = edges.filter(e => e.from === node).map(e => e.to);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node)) {
      if (dfs(node)) return true;
    }
  }

  return false;
};

export const topologicalSort = (
  nodes: string[],
  edges: { from: string; to: string }[]
): string[] => {
  const inDegree = new Map<string, number>();
  nodes.forEach(n => inDegree.set(n, 0));
  
  edges.forEach(e => {
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  });

  const queue: string[] = [];
  nodes.forEach(n => {
    if (inDegree.get(n) === 0) queue.push(n);
  });

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    edges.filter(e => e.from === node).forEach(e => {
      const newDegree = (inDegree.get(e.to) || 0) - 1;
      inDegree.set(e.to, newDegree);
      if (newDegree === 0) queue.push(e.to);
    });
  }

  return result;
};

export const buildRelationsFromUnits = (
  units: StratigraphicUnit[],
  relations: StratigraphicRelation[]
): { nodes: string[]; edges: { from: string; to: string; type: RelationType }[] } => {
  const nodeIds = units.map(u => u.id);
  const edges = relations.map(r => ({
    from: r.fromUnitId,
    to: r.toUnitId,
    type: r.type,
  }));

  return { nodes: nodeIds, edges };
};

export const checkElevationContinuity = (
  strat1: Stratigraphy,
  strat2: Stratigraphy,
  threshold: number = 0.3
): { continuous: boolean; topDiff: number; bottomDiff: number } => {
  const topDiff = Math.abs(strat1.topElevation - strat2.topElevation);
  const bottomDiff = Math.abs(strat1.bottomElevation - strat2.bottomElevation);
  return {
    continuous: topDiff <= threshold && bottomDiff <= threshold,
    topDiff,
    bottomDiff,
  };
};

export interface ImportRow {
  rowIndex: number;
  cellCode: string;
  layerNumber: string;
  type: string;
  material: string;
  dimensions: string;
  photoNumber: string;
  x: string;
  y: string;
  z: string;
}

export interface ValidatedImportRow extends ImportRow {
  valid: boolean;
  errors: string[];
  cellId?: string;
  stratigraphyId?: string;
  unitId?: string;
  xNum?: number;
  yNum?: number;
  zNum?: number;
}

const REQUIRED_COLUMNS = [
  '出土方格编号', '出土层号', '类型', '材质', '尺寸描述', '照片编号', '平面X', '平面Y', '标高Z'
];

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const parseTSVLine = (line: string): string[] => {
  return line.split('\t').map(s => s.trim());
};

const detectDelimiter = (firstLine: string): ',' | '\t' => {
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
};

export const parseImportData = (text: string): { headers: string[]; rows: ImportRow[]; error?: string } => {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], error: '数据为空' };
  }

  const delimiter = detectDelimiter(lines[0]);
  const parseLine = delimiter === ',' ? parseCSVLine : parseTSVLine;
  
  const headers = parseLine(lines[0]);
  
  const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  if (missingColumns.length > 0) {
    return { headers, rows: [], error: `缺少必需列: ${missingColumns.join('、')}` };
  }

  const getCol = (row: string[], name: string) => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? row[idx] : '';
  };

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.every(c => !c.trim())) continue;
    
    rows.push({
      rowIndex: i,
      cellCode: getCol(cells, '出土方格编号'),
      layerNumber: getCol(cells, '出土层号'),
      type: getCol(cells, '类型'),
      material: getCol(cells, '材质'),
      dimensions: getCol(cells, '尺寸描述'),
      photoNumber: getCol(cells, '照片编号'),
      x: getCol(cells, '平面X'),
      y: getCol(cells, '平面Y'),
      z: getCol(cells, '标高Z'),
    });
  }

  return { headers, rows };
};

export const validateImportRows = (
  rows: ImportRow[],
  cells: GridCell[],
  stratigraphies: Stratigraphy[]
): ValidatedImportRow[] => {
  return rows.map(row => {
    const errors: string[] = [];
    const validated: ValidatedImportRow = {
      ...row,
      valid: true,
      errors,
    };

    if (!row.cellCode.trim()) {
      errors.push('出土方格编号不能为空');
    } else {
      const cell = cells.find(c => c.code === row.cellCode.trim());
      if (!cell) {
        errors.push(`方格编号"${row.cellCode}"不存在`);
      } else {
        validated.cellId = cell.id;
        
        if (!row.layerNumber.trim()) {
          errors.push('出土层号不能为空');
        } else {
          const layerNum = parseInt(row.layerNumber, 10);
          if (isNaN(layerNum)) {
            errors.push(`层号"${row.layerNumber}"不是有效数字`);
          } else {
            const strat = stratigraphies.find(
              s => s.cellId === cell.id && s.layerNumber === layerNum
            );
            if (!strat) {
              errors.push(`方格${row.cellCode}的第${layerNum}层不存在`);
            } else {
              validated.stratigraphyId = strat.id;
              validated.unitId = strat.unitId;
            }
          }
        }
      }
    }

    if (!row.type.trim()) {
      errors.push('类型不能为空');
    }

    if (!row.material.trim()) {
      errors.push('材质不能为空');
    }

    const xNum = row.x.trim() ? parseFloat(row.x) : NaN;
    const yNum = row.y.trim() ? parseFloat(row.y) : NaN;
    const zNum = row.z.trim() ? parseFloat(row.z) : NaN;

    if (isNaN(xNum)) {
      errors.push('平面X不是有效数字');
    }
    if (isNaN(yNum)) {
      errors.push('平面Y不是有效数字');
    }
    if (isNaN(zNum)) {
      errors.push('标高Z不是有效数字');
    }

    if (!isNaN(xNum) && !isNaN(yNum) && validated.cellId) {
      const cell = cells.find(c => c.id === validated.cellId);
      if (cell && (xNum < cell.xMin || xNum > cell.xMax || yNum < cell.yMin || yNum > cell.yMax)) {
        errors.push(`坐标(${xNum}, ${yNum})超出方格${row.cellCode}范围(X:${cell.xMin}-${cell.xMax}, Y:${cell.yMin}-${cell.yMax})`);
      }
    }

    validated.xNum = isNaN(xNum) ? 0 : xNum;
    validated.yNum = isNaN(yNum) ? 0 : yNum;
    validated.zNum = isNaN(zNum) ? 0 : zNum;

    validated.valid = errors.length === 0;
    return validated;
  });
};

export const exportArtifactsToCSV = (
  artifacts: Artifact[],
  cells: GridCell[],
  units: StratigraphicUnit[],
  stratigraphies: Stratigraphy[],
  subtypes: ArtifactSubtype[] = []
): string => {
  const headers = [
    '标本编号', '大类', '器型', '原类型文字', '材质', '尺寸描述', '照片编号',
    '出土方格编号', '出土地层单位', '出土层号',
    '平面X', '平面Y', '标高Z', '描述', '登记时间'
  ];

  const getCellCode = (cellId: string) => cells.find(c => c.id === cellId)?.code || '-';
  const getUnitCode = (unitId?: string) => {
    if (!unitId) return '-';
    return units.find(u => u.id === unitId)?.code || '-';
  };
  const getLayerNumber = (stratId?: string, cellId?: string) => {
    if (!stratId || !cellId) return '-';
    const strat = stratigraphies.find(s => s.id === stratId && s.cellId === cellId);
    return strat ? strat.layerNumber.toString() : '-';
  };
  const getSubtypeById = (id?: string) => subtypes.find(s => s.id === id);

  const escapeCSV = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = artifacts.map(a => {
    const subtype = getSubtypeById(a.subtypeId);
    return [
      a.catalogNumber,
      subtype?.category || '',
      subtype?.name || '',
      a.type,
      a.material,
      a.dimensions,
      a.photoNumber,
      getCellCode(a.cellId),
      getUnitCode(a.unitId),
      getLayerNumber(a.stratigraphyId, a.cellId),
      a.x.toFixed(2),
      a.y.toFixed(2),
      a.z.toFixed(2),
      a.description,
      new Date(a.createdAt).toLocaleString('zh-CN'),
    ];
  });

  return [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
};

export const topologicalSortUnits = (
  units: StratigraphicUnit[],
  relations: StratigraphicRelation[]
): string[] => {
  const nodeIds = units.map(u => u.id);
  const edges = relations
    .filter(r => r.type === '叠压' || r.type === '打破')
    .map(r => ({ from: r.fromUnitId, to: r.toUnitId }));

  const inDegree = new Map<string, number>();
  nodeIds.forEach(n => inDegree.set(n, 0));

  const adjList = new Map<string, string[]>();
  nodeIds.forEach(n => adjList.set(n, []));

  edges.forEach(e => {
    if (nodeIds.includes(e.from) && nodeIds.includes(e.to)) {
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
      adjList.get(e.from)?.push(e.to);
    }
  });

  const queue: { id: string; level: number }[] = [];
  const levels = new Map<string, number>();

  nodeIds.forEach(id => {
    if (inDegree.get(id) === 0) queue.push({ id, level: 0 });
  });

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    levels.set(id, level);

    const neighbors = adjList.get(id) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push({ id: neighbor, level: level + 1 });
      }
    }
  }

  return [...nodeIds].sort((a, b) => {
    const la = levels.get(a) ?? Infinity;
    const lb = levels.get(b) ?? Infinity;
    if (la !== lb) return lb - la;
    const ua = units.find(u => u.id === a);
    const ub = units.find(u => u.id === b);
    return (ua?.code || '').localeCompare(ub?.code || '', 'zh-CN');
  });
};

export interface UnitArtifactStats {
  unitId: string;
  unitCode: string;
  unitName: string;
  artifacts: Artifact[];
  categoryCounts: Record<ArtifactCategory, number>;
  subtypeCounts: Map<string, number>;
  total: number;
}

export const computeUnitStats = (
  units: StratigraphicUnit[],
  artifacts: Artifact[],
  subtypes: ArtifactSubtype[]
): Map<string, UnitArtifactStats> => {
  const result = new Map<string, UnitArtifactStats>();

  const initCategoryCounts = (): Record<ArtifactCategory, number> => {
    const obj = {} as Record<ArtifactCategory, number>;
    ARTIFACT_CATEGORIES.forEach(c => obj[c] = 0);
    return obj;
  };

  units.forEach(u => {
    result.set(u.id, {
      unitId: u.id,
      unitCode: u.code,
      unitName: u.name,
      artifacts: [],
      categoryCounts: initCategoryCounts(),
      subtypeCounts: new Map(),
      total: 0,
    });
  });

  const getSubtypeById = (id?: string) => subtypes.find(s => s.id === id);

  artifacts.forEach(a => {
    if (!a.unitId) return;
    let stats = result.get(a.unitId);
    if (!stats) {
      const u = units.find(u => u.id === a.unitId);
      if (!u) return;
      stats = {
        unitId: u.id,
        unitCode: u.code,
        unitName: u.name,
        artifacts: [],
        categoryCounts: initCategoryCounts(),
        subtypeCounts: new Map(),
        total: 0,
      };
      result.set(u.id, stats);
    }
    stats.artifacts.push(a);
    stats.total++;
    const subtype = getSubtypeById(a.subtypeId);
    if (subtype) {
      stats.categoryCounts[subtype.category]++;
      const cur = stats.subtypeCounts.get(subtype.id) || 0;
      stats.subtypeCounts.set(subtype.id, cur + 1);
    }
  });

  return result;
};

export const computePeriodStats = (
  periods: Period[],
  units: StratigraphicUnit[],
  artifacts: Artifact[],
  subtypes: ArtifactSubtype[],
  unitToPeriod: Map<string, string>
): Map<string, {
  periodId: string;
  periodName: string;
  categoryCounts: Record<ArtifactCategory, number>;
  subtypeCounts: Map<string, number>;
  total: number;
}> => {
  const result = new Map();

  const initCategoryCounts = (): Record<ArtifactCategory, number> => {
    const obj = {} as Record<ArtifactCategory, number>;
    ARTIFACT_CATEGORIES.forEach(c => obj[c] = 0);
    return obj;
  };

  periods.forEach(p => {
    result.set(p.id, {
      periodId: p.id,
      periodName: p.name,
      categoryCounts: initCategoryCounts(),
      subtypeCounts: new Map(),
      total: 0,
    });
  });

  const getSubtypeById = (id?: string) => subtypes.find(s => s.id === id);

  artifacts.forEach(a => {
    const periodId = a.periodId || (a.unitId ? unitToPeriod.get(a.unitId) : undefined);
    if (!periodId) return;
    let stats = result.get(periodId);
    if (!stats) {
      const p = periods.find(pp => pp.id === periodId);
      if (!p) return;
      stats = {
        periodId: p.id,
        periodName: p.name,
        categoryCounts: initCategoryCounts(),
        subtypeCounts: new Map(),
        total: 0,
      };
      result.set(p.id, stats);
    }
    stats.total++;
    const subtype = getSubtypeById(a.subtypeId);
    if (subtype) {
      stats.categoryCounts[subtype.category]++;
      const cur = stats.subtypeCounts.get(subtype.id) || 0;
      stats.subtypeCounts.set(subtype.id, cur + 1);
    }
  });

  return result;
};

export const exportStatsToCSV = (
  unitIdsInOrder: string[],
  units: StratigraphicUnit[],
  allSubtypes: ArtifactSubtype[],
  unitStatsMap: Map<string, UnitArtifactStats>
): string => {
  const escapeCSV = (val: string | number) => {
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const sortedSubtypes = [...allSubtypes].sort((a, b) => {
    const catCmp = ARTIFACT_CATEGORIES.indexOf(a.category) - ARTIFACT_CATEGORIES.indexOf(b.category);
    if (catCmp !== 0) return catCmp;
    return a.name.localeCompare(b.name, 'zh-CN');
  });

  const headers = ['地层单位', '单位名称', '合计', ...sortedSubtypes.map(s => `${s.category}-${s.name}`)];

  const rows = unitIdsInOrder.map(unitId => {
    const unit = units.find(u => u.id === unitId);
    const stats = unitStatsMap.get(unitId);
    const row: (string | number)[] = [
      unit?.code || '-',
      unit?.name || '-',
      stats?.total || 0,
    ];
    sortedSubtypes.forEach(s => {
      row.push(stats?.subtypeCounts.get(s.id) || 0);
    });
    return row;
  });

  return [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
};

export const downloadCSV = (content: string, filename: string) => {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const formatDate = (d: Date | number | string): string => {
  const date = typeof d === 'string' ? new Date(d) : new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayDate = (): string => formatDate(new Date());

export const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToHours = (minutes: number): number => {
  return Math.round((minutes / 60) * 100) / 100;
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}分钟`;
  if (mins === 0) return `${hours}小时`;
  return `${hours}小时${mins}分钟`;
};

export const calculateSlotDuration = (slot: TimeSlot): number => {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  return Math.max(0, end - start);
};

export const mergeOverlappingSlots = (slots: TimeSlot[]): TimeSlot[] => {
  if (slots.length === 0) return [];
  const intervals = slots
    .map(s => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime), id: s.id }))
    .filter(i => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push({ start: interval.start, end: interval.end });
    } else {
      const last = merged[merged.length - 1];
      if (interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        merged.push({ start: interval.start, end: interval.end });
      }
    }
  }

  return merged.map((m, idx) => ({
    id: `merged-${idx}`,
    startTime: `${String(Math.floor(m.start / 60)).padStart(2, '0')}:${String(m.start % 60).padStart(2, '0')}`,
    endTime: `${String(Math.floor(m.end / 60)).padStart(2, '0')}:${String(m.end % 60).padStart(2, '0')}`,
  }));
};

export const calculateTotalDuration = (slots: TimeSlot[]): number => {
  const merged = mergeOverlappingSlots(slots);
  return merged.reduce((total, slot) => total + calculateSlotDuration(slot), 0);
};

export interface PersonWorkHours {
  personId: string;
  totalMinutes: number;
  dailyMinutes: Record<string, number>;
}

export const calculatePersonWorkHours = (
  personId: string,
  logs: ExcavationLog[],
  startDate?: string,
  endDate?: string
): PersonWorkHours => {
  const result: PersonWorkHours = {
    personId,
    totalMinutes: 0,
    dailyMinutes: {},
  };

  const relevantLogs = logs.filter(log => {
    if (!log.participantIds.includes(personId)) return false;
    if (startDate && log.date < startDate) return false;
    if (endDate && log.date > endDate) return false;
    return true;
  });

  const dailySlots: Record<string, TimeSlot[]> = {};
  for (const log of relevantLogs) {
    if (!dailySlots[log.date]) dailySlots[log.date] = [];
    dailySlots[log.date].push(...log.timeSlots);
  }

  for (const [date, slots] of Object.entries(dailySlots)) {
    const mins = calculateTotalDuration(slots);
    result.dailyMinutes[date] = mins;
    result.totalMinutes += mins;
  }

  return result;
};

export const getDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export const WEATHER_ICONS: Record<WeatherType, { emoji: string; label: string }> = {
  '晴': { emoji: '☀️', label: '晴' },
  '多云': { emoji: '⛅', label: '多云' },
  '阴': { emoji: '☁️', label: '阴' },
  '小雨': { emoji: '🌦️', label: '小雨' },
  '中雨': { emoji: '🌧️', label: '中雨' },
  '大雨': { emoji: '⛈️', label: '大雨' },
  '雪': { emoji: '❄️', label: '雪' },
  '雾': { emoji: '🌫️', label: '雾' },
  '大风': { emoji: '💨', label: '大风' },
};

export const WEATHER_OPTIONS: WeatherType[] = ['晴', '多云', '阴', '小雨', '中雨', '大雨', '雪', '雾', '大风'];

export const isSameDay = (ts1: number, ts2: number): boolean => {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

export const timestampToDateString = (ts: number): string => formatDate(new Date(ts));

export const findLogsByDate = (logs: ExcavationLog[], date: string): ExcavationLog[] => {
  return logs.filter(l => l.date === date);
};

export const PERIOD_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

const pointInPolygon = (px: number, py: number, polygon: { x: number; y: number }[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const pointInRect = (px: number, py: number, xMin: number, yMin: number, xMax: number, yMax: number): boolean => {
  return px >= xMin && px <= xMax && py >= yMin && py <= yMax;
};

const lineIntersectsRect = (
  x1: number, y1: number, x2: number, y2: number,
  xMin: number, yMin: number, xMax: number, yMax: number
): boolean => {
  if (x1 >= xMin && x1 <= xMax && y1 >= yMin && y1 <= yMax) return true;
  if (x2 >= xMin && x2 <= xMax && y2 >= yMin && y2 <= yMax) return true;

  const dx = x2 - x1;
  const dy = y2 - y1;

  const edges: [number, number, number, number][] = [
    [xMin, yMin, xMax, yMin],
    [xMax, yMin, xMax, yMax],
    [xMax, yMax, xMin, yMax],
    [xMin, yMax, xMin, yMin],
  ];

  for (const [ex1, ey1, ex2, ey2] of edges) {
    const denom = dx * (ey2 - ey1) - dy * (ex2 - ex1);
    if (Math.abs(denom) < 1e-10) continue;
    const t = ((ex1 - x1) * (ey2 - ey1) - (ey1 - y1) * (ex2 - ex1)) / denom;
    const u = ((ex1 - x1) * dy - (ey1 - y1) * dx) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }

  return false;
};

export const polygonIntersectsRect = (
  polygon: { x: number; y: number }[],
  xMin: number, yMin: number, xMax: number, yMax: number
): boolean => {
  for (const v of polygon) {
    if (pointInRect(v.x, v.y, xMin, yMin, xMax, yMax)) return true;
  }

  if (pointInPolygon(xMin, yMin, polygon)) return true;
  if (pointInPolygon(xMax, yMin, polygon)) return true;
  if (pointInPolygon(xMax, yMax, polygon)) return true;
  if (pointInPolygon(xMin, yMax, polygon)) return true;

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    if (lineIntersectsRect(polygon[i].x, polygon[i].y, polygon[j].x, polygon[j].y, xMin, yMin, xMax, yMax)) {
      return true;
    }
  }

  return false;
};

export const computeCoveredCells = (
  polygon: { x: number; y: number }[],
  cells: { id: string; xMin: number; yMin: number; xMax: number; yMax: number }[]
): string[] => {
  return cells
    .filter((cell) => polygonIntersectsRect(polygon, cell.xMin, cell.yMin, cell.xMax, cell.yMax))
    .map((cell) => cell.id);
};

export const polygonsIntersect = (
  polyA: { x: number; y: number }[],
  polyB: { x: number; y: number }[]
): boolean => {
  for (const v of polyA) {
    if (pointInPolygon(v.x, v.y, polyB)) return true;
  }
  for (const v of polyB) {
    if (pointInPolygon(v.x, v.y, polyA)) return true;
  }

  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];
      if (segmentsIntersect(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) return true;
    }
  }

  return false;
};

const segmentsIntersect = (
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean => {
  const d1 = direction(x3, y3, x4, y4, x1, y1);
  const d2 = direction(x3, y3, x4, y4, x2, y2);
  const d3 = direction(x1, y1, x2, y2, x3, y3);
  const d4 = direction(x1, y1, x2, y2, x4, y4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (Math.abs(d1) < 1e-10 && onSegment(x3, y3, x4, y4, x1, y1)) return true;
  if (Math.abs(d2) < 1e-10 && onSegment(x3, y3, x4, y4, x2, y2)) return true;
  if (Math.abs(d3) < 1e-10 && onSegment(x1, y1, x2, y2, x3, y3)) return true;
  if (Math.abs(d4) < 1e-10 && onSegment(x1, y1, x2, y2, x4, y4)) return true;

  return false;
};

const direction = (xi: number, yi: number, xj: number, yj: number, xk: number, yk: number): number => {
  return (xk - xi) * (yj - yi) - (yk - yi) * (xj - xi);
};

const onSegment = (xi: number, yi: number, xj: number, yj: number, xk: number, yk: number): boolean => {
  return Math.min(xi, xj) <= xk && xk <= Math.max(xi, xj) &&
         Math.min(yi, yj) <= yk && yk <= Math.max(yi, yj);
};

export const FEATURE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '灰坑', label: '灰坑 (H)' },
  { value: '房址', label: '房址 (F)' },
  { value: '墓葬', label: '墓葬 (M)' },
  { value: '灶', label: '灶 (Z)' },
  { value: '柱洞', label: '柱洞 (D)' },
  { value: '沟', label: '沟 (G)' },
  { value: '其他', label: '其他' },
];

export const FEATURE_TYPE_PREFIX: Record<string, string> = {
  '灰坑': 'H',
  '房址': 'F',
  '墓葬': 'M',
  '灶': 'Z',
  '柱洞': 'D',
  '沟': 'G',
  '其他': 'Q',
};

export const generateFeatureNumber = (featureType: string, existingFeatures: { featureNumber: string; featureType: string }[]): string => {
  const prefix = FEATURE_TYPE_PREFIX[featureType] || 'Q';
  const existingNums = existingFeatures
    .filter((f) => f.featureType === featureType)
    .map((f) => {
      const numStr = f.featureNumber.replace(prefix, '');
      return parseInt(numStr, 10) || 0;
    });
  const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
  return `${prefix}${maxNum + 1}`;
};
