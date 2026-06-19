import { v4 as uuidv4 } from 'uuid';
import { GridCell, Trench, Stratigraphy, StratigraphicUnit, StratigraphicRelation, Artifact, RelationType } from '../types';

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
        
        if (row.layerNumber.trim()) {
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
  stratigraphies: Stratigraphy[]
): string => {
  const headers = [
    '标本编号', '类型', '材质', '尺寸描述', '照片编号',
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

  const escapeCSV = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = artifacts.map(a => [
    a.catalogNumber,
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
  ]);

  return [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
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
