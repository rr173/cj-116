import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../store/useAppStore';
import { StratigraphicUnit, StratigraphicRelation } from '../types';

interface NodePosition {
  id: string;
  x: number;
  y: number;
}

export default function HarrisMatrixView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const units = useAppStore((state) =>
    state.units.filter((u) => u.trenchId === selectedTrenchId)
  );
  const relations = useAppStore((state) =>
    state.relations.filter((r) => r.trenchId === selectedTrenchId)
  );

  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(
    new Map()
  );
  const [hasCycle, setHasCycle] = useState(false);
  const [cycleNodes, setCycleNodes] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const detectCycle = useCallback(
    (unitIds: string[], rels: StratigraphicRelation[]): boolean => {
      const visited = new Set<string>();
      const recStack = new Set<string>();
      const cyclePath: string[] = [];

      const adjList = new Map<string, string[]>();
      unitIds.forEach((id) => adjList.set(id, []));
      rels.forEach((r) => {
        const neighbors = adjList.get(r.fromUnitId);
        if (neighbors) neighbors.push(r.toUnitId);
      });

      const dfs = (node: string): boolean => {
        visited.add(node);
        recStack.add(node);
        cyclePath.push(node);

        const neighbors = adjList.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true;
          } else if (recStack.has(neighbor)) {
            const cycleStart = cyclePath.indexOf(neighbor);
            setCycleNodes(cyclePath.slice(cycleStart));
            return true;
          }
        }

        cyclePath.pop();
        recStack.delete(node);
        return false;
      };

      for (const unitId of unitIds) {
        if (!visited.has(unitId)) {
          if (dfs(unitId)) return true;
        }
      }

      return false;
    },
    []
  );

  const topologicalLevels = useCallback(
    (unitIds: string[], rels: StratigraphicRelation[]): Map<string, number> => {
      const inDegree = new Map<string, number>();
      unitIds.forEach((id) => inDegree.set(id, 0));

      const adjList = new Map<string, string[]>();
      unitIds.forEach((id) => adjList.set(id, []));
      rels.forEach((r) => {
        inDegree.set(r.toUnitId, (inDegree.get(r.toUnitId) || 0) + 1);
        adjList.get(r.fromUnitId)?.push(r.toUnitId);
      });

      const levels = new Map<string, number>();
      const queue: { id: string; level: number }[] = [];

      unitIds.forEach((id) => {
        if (inDegree.get(id) === 0) queue.push({ id, level: 0 });
      });

      while (queue.length > 0) {
        const { id, level } = queue.shift()!;
        levels.set(id, level);

        const neighbors = adjList.get(id) || [];
        neighbors.forEach((n) => {
          const newDegree = (inDegree.get(n) || 1) - 1;
          inDegree.set(n, newDegree);
          if (newDegree === 0) {
            queue.push({ id: n, level: level + 1 });
          }
        });
      }

      if (levels.size < unitIds.length) {
        let maxLevel = 0;
        levels.forEach((l) => (maxLevel = Math.max(maxLevel, l)));
        unitIds.forEach((id) => {
          if (!levels.has(id)) {
            levels.set(id, maxLevel + 1);
          }
        });
      }

      return levels;
    },
    []
  );

  const layoutNodes = useCallback(() => {
    if (units.length === 0) return;

    const levels = topologicalLevels(
      units.map((u) => u.id),
      relations
    );

    const levelGroups = new Map<number, string[]>();
    units.forEach((u) => {
      const level = levels.get(u.id) || 0;
      if (!levelGroups.has(level)) levelGroups.set(level, []);
      levelGroups.get(level)!.push(u.id);
    });

    const maxLevel = Math.max(...levelGroups.keys(), 0);
    const levelHeight = 100;
    const nodeWidth = 120;
    const nodeHeight = 60;
    const hGap = 40;

    const newPositions = new Map<string, { x: number; y: number }>();

    levelGroups.forEach((nodeIds, level) => {
      const totalWidth =
        nodeIds.length * nodeWidth + (nodeIds.length - 1) * hGap;
      const startX = (dimensions.width - totalWidth) / 2;

      nodeIds.forEach((id, idx) => {
        newPositions.set(id, {
          x: startX + idx * (nodeWidth + hGap) + nodeWidth / 2,
          y: 50 + level * (levelHeight + nodeHeight) + nodeHeight / 2,
        });
      });
    });

    setNodePositions(newPositions);
  }, [units, relations, dimensions, topologicalLevels]);

  useEffect(() => {
    if (containerRef.current) {
      const updateSize = () => {
        if (containerRef.current) {
          setDimensions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, []);

  useEffect(() => {
    const cycle = detectCycle(
      units.map((u) => u.id),
      relations
    );
    setHasCycle(cycle);
  }, [units, relations, detectCycle]);

  useEffect(() => {
    layoutNodes();
  }, [layoutNodes]);

  useEffect(() => {
    if (!svgRef.current || units.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#94a3b8');

    defs
      .append('marker')
      .attr('id', 'arrowhead-cut')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#ef4444');

    const g = svg.append('g');

    const edges = g.append('g').attr('class', 'edges');
    relations.forEach((rel) => {
      const fromPos = nodePositions.get(rel.fromUnitId);
      const toPos = nodePositions.get(rel.toUnitId);
      if (!fromPos || !toPos) return;

      const isCut = rel.type === '打破' || rel.type === '被打破';
      const isCycle = hasCycle && 
        cycleNodes.includes(rel.fromUnitId) && 
        cycleNodes.includes(rel.toUnitId);

      const midY = (fromPos.y + toPos.y) / 2;

      const pathData = `M ${fromPos.x} ${fromPos.y + 30} C ${fromPos.x} ${midY}, ${toPos.x} ${midY}, ${toPos.x} ${toPos.y - 30}`;

      edges
        .append('path')
        .attr('d', pathData)
        .attr('fill', 'none')
        .attr('stroke', isCycle ? '#ef4444' : isCut ? '#ef4444' : '#94a3b8')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', isCut ? '8,4' : 'none')
        .attr('marker-end', `url(#${isCut ? 'arrowhead-cut' : 'arrowhead'})`);
    });

    const nodes = g.append('g').attr('class', 'nodes');
    units.forEach((unit) => {
      const pos = nodePositions.get(unit.id);
      if (!pos) return;

      const isInCycle = hasCycle && cycleNodes.includes(unit.id);

      const nodeGroup = nodes
        .append('g')
        .attr('transform', `translate(${pos.x - 60}, ${pos.y - 30})`)
        .style('cursor', 'move')
        .call(
          d3
            .drag<SVGGElement, unknown>()
            .on('start', function (event) {
              d3.select(this).raise();
            })
            .on('drag', function (event) {
              const currentPos = nodePositions.get(unit.id) || { x: 0, y: 0 };
              const newX = currentPos.x + event.dx;
              const newY = currentPos.y + event.dy;

              d3.select(this).attr(
                'transform',
                `translate(${newX - 60}, ${newY - 30})`
              );

              setNodePositions((prev) => {
                const next = new Map(prev);
                next.set(unit.id, { x: newX, y: newY });
                return next;
              });

              updateEdges();
            })
        );

      nodeGroup
        .append('rect')
        .attr('width', 120)
        .attr('height', 60)
        .attr('rx', 8)
        .attr('fill', isInCycle ? '#fef2f2' : '#ffffff')
        .attr('stroke', isInCycle ? '#ef4444' : unit.color)
        .attr('stroke-width', isInCycle ? 3 : 2)
        .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

      nodeGroup
        .append('rect')
        .attr('width', 120)
        .attr('height', 8)
        .attr('rx', 0)
        .attr('fill', unit.color);

      nodeGroup
        .append('text')
        .attr('x', 60)
        .attr('y', 32)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', isInCycle ? '#dc2626' : '#1f2937')
        .text(unit.code);

      nodeGroup
        .append('text')
        .attr('x', 60)
        .attr('y', 50)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#6b7280')
        .text(unit.name);
    });

    function updateEdges() {
      const edgePaths = svg.selectAll('.edges path');
      edgePaths.each(function (_, i) {
        const rel = relations[i];
        const fromPos = nodePositions.get(rel.fromUnitId);
        const toPos = nodePositions.get(rel.toUnitId);
        if (!fromPos || !toPos) return;

        const midY = (fromPos.y + toPos.y) / 2;
        const pathData = `M ${fromPos.x} ${fromPos.y + 30} C ${fromPos.x} ${midY}, ${toPos.x} ${midY}, ${toPos.x} ${toPos.y - 30}`;

        d3.select(this).attr('d', pathData);
      });
    }
  }, [units, relations, nodePositions, hasCycle, cycleNodes]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Harris 矩阵图</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {units.length} 个地层单位，{relations.length} 条关系
          </p>
        </div>
        <div className="flex items-center gap-4">
          {hasCycle && (
            <div className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              检测到循环关系！
            </div>
          )}
          <button
            onClick={layoutNodes}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重新布局
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
        <div
          ref={containerRef}
          className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full h-full"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-700">图例</h3>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">关系类型</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-0.5 bg-gray-400 relative">
                    <div className="absolute right-0 -top-1.5">
                      <svg width="10" height="10" viewBox="-0 -5 10 10">
                        <path d="M 0,-5 L 10,0 L 0,5" fill="#94a3b8" />
                      </svg>
                    </div>
                  </div>
                  <span className="text-sm text-gray-600">叠压关系</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-0.5 bg-red-500 relative" style={{ background: 'repeating-linear-gradient(90deg, #ef4444, #ef4444 6px, transparent 6px, transparent 10px)' }}>
                    <div className="absolute right-0 -top-1.5">
                      <svg width="10" height="10" viewBox="-0 -5 10 10">
                        <path d="M 0,-5 L 10,0 L 0,5" fill="#ef4444" />
                      </svg>
                    </div>
                  </div>
                  <span className="text-sm text-gray-600">打破关系</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">地层单位</h4>
              <div className="space-y-2 max-h-64 overflow-auto">
                {units.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: unit.color }}
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        {unit.code}
                      </div>
                      <div className="text-xs text-gray-500">{unit.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">操作说明</h4>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• 拖拽节点可调整位置</li>
                <li>• 点击"重新布局"自动排列</li>
                <li>• 红色虚线表示打破关系</li>
                <li>• 红色边框表示存在循环</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
