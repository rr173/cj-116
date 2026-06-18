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
