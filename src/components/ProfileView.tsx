import { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../store/useAppStore';
import { SOIL_COLORS } from '../utils';
import { GridCell, Stratigraphy } from '../types';

export default function ProfileView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const cells = useAppStore((state) =>
    state.cells.filter((c) => c.trenchId === selectedTrenchId)
  );
  const stratigraphies = useAppStore((state) =>
    state.stratigraphies.filter((s) => s.trenchId === selectedTrenchId)
  );
  const units = useAppStore((state) =>
    state.units.filter((u) => u.trenchId === selectedTrenchId)
  );
  const relations = useAppStore((state) =>
    state.relations.filter((r) => r.trenchId === selectedTrenchId)
  );

  const [startCellId, setStartCellId] = useState<string>('');
  const [endCellId, setEndCellId] = useState<string>('');
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

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

  const profileCells = useMemo(() => {
    if (!startCellId || !endCellId) return [];

    const startCell = cells.find((c) => c.id === startCellId);
    const endCell = cells.find((c) => c.id === endCellId);

    if (!startCell || !endCell) return [];

    if (direction === 'horizontal') {
      const row = startCell.row;
      const minCol = Math.min(startCell.col, endCell.col);
      const maxCol = Math.max(startCell.col, endCell.col);

      return cells
        .filter((c) => c.row === row && c.col >= minCol && c.col <= maxCol)
        .sort((a, b) => a.col - b.col);
    } else {
      const col = startCell.col;
      const minRow = Math.min(startCell.row, endCell.row);
      const maxRow = Math.max(startCell.row, endCell.row);

      return cells
        .filter((c) => c.col === col && c.row >= minRow && c.row <= maxRow)
        .sort((a, b) => b.row - a.row);
    }
  }, [startCellId, endCellId, direction, cells]);

  const profileData = useMemo(() => {
    if (profileCells.length === 0) return null;

    const cellStrats: { cell: GridCell; strats: Stratigraphy[] }[] = [];
    let minElev = Infinity;
    let maxElev = -Infinity;

    profileCells.forEach((cell) => {
      const strats = stratigraphies
        .filter((s) => s.cellId === cell.id)
        .sort((a, b) => b.topElevation - a.topElevation);

      cellStrats.push({ cell, strats });

      strats.forEach((s) => {
        if (s.topElevation > maxElev) maxElev = s.topElevation;
        if (s.bottomElevation < minElev) minElev = s.bottomElevation;
      });
    });

    if (minElev === Infinity) {
      minElev = 0;
      maxElev = 5;
    }

    return { cellStrats, minElev: minElev - 0.5, maxElev: maxElev + 0.5 };
  }, [profileCells, stratigraphies]);

  useEffect(() => {
    if (!svgRef.current || !profileData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { cellStrats, minElev, maxElev } = profileData;
    const margin = { top: 40, right: 40, bottom: 40, left: 60 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleLinear()
      .domain([0, cellStrats.length])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([minElev, maxElev])
      .range([height, 0]);

    const yAxis = d3.axisLeft(yScale).ticks(10).tickFormat((d) => d + 'm');
    g.append('g').call(yAxis);

    const xAxis = d3.axisBottom(xScale).tickFormat((d, i) => {
      if (i < cellStrats.length) {
        return cellStrats[i].cell.code.replace(/^T\d+/, '');
      }
      return '';
    });
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    const cellWidth = width / cellStrats.length;

    cellStrats.forEach(({ cell, strats }, cellIdx) => {
      const x = xScale(cellIdx) + cellWidth * 0.1;
      const w = cellWidth * 0.8;

      strats.forEach((strat, stratIdx) => {
        const yTop = yScale(strat.topElevation);
        const yBottom = yScale(strat.bottomElevation);
        const stratHeight = yBottom - yTop;

        const hasCutRelation = relations.some(
          (r) =>
            (r.fromUnitId === strat.unitId || r.toUnitId === strat.unitId) &&
            (r.type === '打破' || r.type === '被打破')
        );

        const unit = units.find((u) => u.id === strat.unitId);
        const fillColor = unit ? unit.color : SOIL_COLORS[strat.soilType] || '#ccc';

        g.append('rect')
          .attr('x', x)
          .attr('y', yTop)
          .attr('width', w)
          .attr('height', stratHeight)
          .attr('fill', fillColor)
          .attr('fill-opacity', 0.7)
          .attr('stroke', '#333')
          .attr('stroke-width', hasCutRelation ? 2 : 1)
          .attr('stroke-dasharray', hasCutRelation ? '4,2' : 'none')
          .append('title')
          .text(
            `${cell.code} - 第${strat.layerNumber}层\n${strat.soilType} · ${strat.munsellColor}\n顶: ${strat.topElevation.toFixed(2)}m\n底: ${strat.bottomElevation.toFixed(2)}m\n厚: ${(strat.topElevation - strat.bottomElevation).toFixed(2)}m`
          );

        if (stratHeight > 20) {
          g.append('text')
            .attr('x', x + w / 2)
            .attr('y', yTop + stratHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '11px')
            .attr('fill', '#333')
            .attr('font-weight', 'bold')
            .text(strat.layerNumber);
        }
      });

      g.append('text')
        .attr('x', x + w / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#666');
    });

    g.append('text')
      .attr('x', -30)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('transform', `rotate(-90, -30, ${height / 2})`)
      .attr('font-size', '12px')
      .attr('fill', '#666')
      .text('标高 (m)');

    if (profileCells.length > 0) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 50)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#666')
        .text(
          direction === 'horizontal'
            ? `${profileCells[0].code} → ${profileCells[profileCells.length - 1].code} (横向剖面)`
            : `${profileCells[0].code} → ${profileCells[profileCells.length - 1].code} (纵向剖面)`
        );
    }
  }, [profileData, dimensions, direction, profileCells, units, relations]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">地层剖面图</h2>
          <p className="text-sm text-gray-500 mt-1">
            选择起止方格生成剖面示意图
          </p>
        </div>
      </div>

      <div className="mb-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              方向
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setDirection('horizontal')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  direction === 'horizontal'
                    ? 'bg-earth-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                横向 (东西向)
              </button>
              <button
                onClick={() => setDirection('vertical')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  direction === 'vertical'
                    ? 'bg-earth-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                纵向 (南北向)
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              起点方格
            </label>
            <select
              value={startCellId}
              onChange={(e) => setStartCellId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            >
              <option value="">请选择</option>
              {cells
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              终点方格
            </label>
            <select
              value={endCellId}
              onChange={(e) => setEndCellId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
            >
              <option value="">请选择</option>
              {cells
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
            </select>
          </div>
          <div className="text-sm text-gray-500">
            共 {profileCells.length} 个方格
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
        <div
          ref={containerRef}
          className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-4"
        >
          {profileData ? (
            <svg
              ref={svgRef}
              width={dimensions.width - 32}
              height={dimensions.height - 32}
              className="w-full h-full"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              请选择起止方格生成剖面图
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-700">图例</h3>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">地层颜色</h4>
              <div className="space-y-1.5">
                {units.length > 0 ? (
                  units.map((unit) => (
                    <div key={unit.id} className="flex items-center gap-2">
                      <div
                        className="w-6 h-4 rounded border border-gray-300"
                        style={{ backgroundColor: unit.color, opacity: 0.7 }}
                      />
                      <span className="text-xs text-gray-600">
                        {unit.code} - {unit.name}
                      </span>
                    </div>
                  ))
                ) : (
                  Object.entries(SOIL_COLORS).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div
                        className="w-6 h-4 rounded border border-gray-300"
                        style={{ backgroundColor: color, opacity: 0.7 }}
                      />
                      <span className="text-xs text-gray-600">{type}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">边界类型</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-0.5 bg-gray-600" />
                  <span className="text-xs text-gray-600">正常层位边界</span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-0.5"
                    style={{
                      background:
                        'repeating-linear-gradient(90deg, #333, #333 4px, transparent 4px, transparent 6px)',
                    }}
                  />
                  <span className="text-xs text-gray-600">打破关系边界</span>
                </div>
              </div>
            </div>

            {profileCells.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">剖面方格</h4>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {profileCells.map((cell) => {
                    const strats = stratigraphies.filter(
                      (s) => s.cellId === cell.id
                    );
                    return (
                      <div
                        key={cell.id}
                        className="flex items-center justify-between p-1.5 bg-gray-50 rounded text-xs"
                      >
                        <span className="font-medium text-gray-700">{cell.code}</span>
                        <span className="text-gray-500">{strats.length} 层</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
