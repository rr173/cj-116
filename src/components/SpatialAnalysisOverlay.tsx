import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  getHeatmapColor,
  getClusterColor,
} from '../utils/spatialAnalysis';
import { DensityGridCell } from '../types';

interface SpatialAnalysisOverlayProps {
  trenchId: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  pixelWidth: number;
  pixelHeight: number;
  onMapClick?: (x: number, y: number) => void;
  clickMode?: 'none' | 'buffer' | 'nearest';
}

export default function SpatialAnalysisOverlay({
  trenchId,
  xMin,
  yMin,
  xMax,
  yMax,
  pixelWidth,
  pixelHeight,
  onMapClick,
  clickMode = 'none',
}: SpatialAnalysisOverlayProps) {
  const densityHeatmapConfig = useAppStore((state) => state.densityHeatmapConfig);
  const bufferQueryConfig = useAppStore((state) => state.bufferQueryConfig);
  const nearestNeighborConfig = useAppStore((state) => state.nearestNeighborConfig);
  const clusterConfig = useAppStore((state) => state.clusterConfig);

  const getDensityGrid = useAppStore((state) => state.getDensityGrid);
  const getBufferQueryResult = useAppStore((state) => state.getBufferQueryResult);
  const getNearestNeighbors = useAppStore((state) => state.getNearestNeighbors);
  const getArtifactClusters = useAppStore((state) => state.getArtifactClusters);
  const artifacts = useAppStore((state) => state.artifacts);
  const getArtifactById = useAppStore((state) =>
    (id: string) => state.artifacts.find((a) => a.id === id)
  );

  const [hoveredGridCell, setHoveredGridCell] = useState<DensityGridCell | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);

  const hoveredCellArtifacts = useMemo(() => {
    if (!hoveredGridCell || hoveredGridCell.count === 0) return [];
    const idSet = new Set(hoveredGridCell.artifactIds);
    return artifacts.filter((a) => idSet.has(a.id));
  }, [hoveredGridCell, artifacts]);

  const xRange = xMax - xMin;
  const yRange = yMax - yMin;

  const toPixelX = (x: number): number => ((x - xMin) / xRange) * pixelWidth;
  const toPixelY = (y: number): number => pixelHeight - ((y - yMin) / yRange) * pixelHeight;

  const densityGrid = useMemo(() => {
    if (!densityHeatmapConfig.visible) return [];
    return getDensityGrid(trenchId);
  }, [densityHeatmapConfig.visible, trenchId, getDensityGrid]);

  const maxDensity = useMemo(() => {
    if (densityGrid.length === 0) return 0;
    return Math.max(...densityGrid.map((c) => c.count));
  }, [densityGrid]);

  const bufferResult = useMemo(() => {
    if (!bufferQueryConfig.active) return null;
    return getBufferQueryResult(trenchId);
  }, [bufferQueryConfig.active, trenchId, getBufferQueryResult]);

  const nearestResult = useMemo(() => {
    if (!nearestNeighborConfig.active) return null;
    return getNearestNeighbors(trenchId);
  }, [nearestNeighborConfig.active, trenchId, getNearestNeighbors]);

  const clusters = useMemo(() => {
    if (!clusterConfig.visible) return [];
    return getArtifactClusters(trenchId);
  }, [clusterConfig.visible, trenchId, getArtifactClusters]);

  const handleSvgClick = (e: React.MouseEvent<SVGRectElement>) => {
    if (clickMode === 'none' || !onMapClick) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const mapX = xMin + (px / pixelWidth) * xRange;
    const mapY = yMax - (py / pixelHeight) * yRange;

    onMapClick(mapX, mapY);
  };

  const bufferPolygonPath = useMemo(() => {
    if (!bufferResult || bufferResult.bufferPolygon.length < 3) return '';
    return bufferResult.bufferPolygon
      .map((p, i) => {
        const px = toPixelX(p.x);
        const py = toPixelY(p.y);
        return `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`;
      })
      .join(' ') + ' Z';
  }, [bufferResult, toPixelX, toPixelY]);

  const targetArtifact = nearestResult
    ? getArtifactById(nearestResult.artifactId)
    : null;

  return (
    <g className="spatial-analysis-layer">
      {densityHeatmapConfig.visible && densityGrid.length > 0 && (
        <g className="density-heatmap-layer">
          {densityGrid.map((cell) => {
            const px = toPixelX(cell.xMin);
            const py = toPixelY(cell.yMax);
            const pw = toPixelX(cell.xMax) - px;
            const ph = toPixelY(cell.yMin) - py;
            const color = getHeatmapColor(cell.count, maxDensity);

            return (
              <rect
                key={`${cell.gridX}-${cell.gridY}`}
                x={px}
                y={py}
                width={pw}
                height={ph}
                fill={color}
                stroke="none"
                onMouseEnter={() => setHoveredGridCell(cell)}
                onMouseLeave={() => setHoveredGridCell(null)}
                style={{ cursor: cell.count > 0 ? 'pointer' : 'default' }}
              />
            );
          })}
        </g>
      )}

      {clusterConfig.visible && clusters.length > 0 && (
        <g className="cluster-layer">
          {clusters.map((cluster, idx) => {
            const color = getClusterColor(idx);
            const pathData = cluster.convexHull.length >= 3
              ? cluster.convexHull
                  .map((p, i) => {
                    const px = toPixelX(p.x);
                    const py = toPixelY(p.y);
                    return `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`;
                  })
                  .join(' ') + ' Z'
              : '';

            const isHovered = hoveredClusterId === cluster.id;

            return (
              <g
                key={cluster.id}
                onMouseEnter={() => setHoveredClusterId(cluster.id)}
                onMouseLeave={() => setHoveredClusterId(null)}
                style={{ cursor: 'pointer' }}
              >
                {pathData && (
                  <path
                    d={pathData}
                    fill={color}
                    fillOpacity={isHovered ? 0.35 : 0.2}
                    stroke={color}
                    strokeWidth={isHovered ? 2.5 : 2}
                    strokeDasharray="5,3"
                  />
                )}
                <g transform={`translate(${toPixelX(cluster.centroid.x)}, ${toPixelY(cluster.centroid.y)})`}>
                  <rect
                    x={-30}
                    y={-12}
                    width={60}
                    height={24}
                    rx={4}
                    fill="white"
                    stroke={color}
                    strokeWidth={2}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-xs font-bold"
                    fill={color}
                  >
                    C{idx + 1} · {cluster.members.length}件
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      )}

      {bufferResult && bufferResult.bufferPolygon.length >= 3 && (
        <g className="buffer-query-layer">
          <path
            d={bufferPolygonPath}
            fill="#3B82F6"
            fillOpacity={0.15}
            stroke="#3B82F6"
            strokeWidth={2}
            strokeDasharray="8,4"
          />
          {bufferResult.artifacts.map((artifact) => (
            <circle
              key={artifact.id}
              cx={toPixelX(artifact.x)}
              cy={toPixelY(artifact.y)}
              r={6}
              fill="#3B82F6"
              fillOpacity={0.8}
              stroke="white"
              strokeWidth={1.5}
            />
          ))}
        </g>
      )}

      {nearestResult && targetArtifact && (
        <g className="nearest-neighbor-layer">
          {nearestResult.neighbors.map((item) => (
        <line
          key={item.artifact.id}
          x1={toPixelX(targetArtifact.x)}
          y1={toPixelY(targetArtifact.y)}
          x2={toPixelX(item.artifact.x)}
          y2={toPixelY(item.artifact.y)}
          stroke="#8B5CF6"
          strokeWidth={1.5}
          strokeDasharray="4,2"
        />
      ))}

      <circle
        cx={toPixelX(targetArtifact.x)}
        cy={toPixelY(targetArtifact.y)}
        r={8}
        fill="#8B5CF6"
        stroke="white"
        strokeWidth={2}
      />

      {nearestResult.neighbors.map((item, idx) => (
        <g key={item.artifact.id}>
          <circle
            cx={toPixelX(item.artifact.x)}
            cy={toPixelY(item.artifact.y)}
            r={5}
            fill="#A78BFA"
            stroke="white"
            strokeWidth={1.5}
          />
          <text
            x={toPixelX(item.artifact.x) + 8}
            y={toPixelY(item.artifact.y) - 8}
            className="text-[10px] font-medium fill-purple-700"
          >
            {idx + 1}. {item.distance.toFixed(3)}m
          </text>
        </g>
      ))}
    </g>
  )}

      {hoveredGridCell && hoveredGridCell.count > 0 && (
        <g
          className="tooltip-layer"
          style={{ pointerEvents: 'none' }}
          transform={`translate(${toPixelX(hoveredGridCell.xMax) + 10}, ${toPixelY(hoveredGridCell.yMax) - 10})`}
        >
          <rect
            x={0}
            y={0}
            width={180}
            height={Math.min(150, 28 + hoveredCellArtifacts.length * 18)}
            rx={4}
            fill="white"
            stroke="#e5e7eb"
            strokeWidth={1}
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
          />
          <text x={8} y={18} className="text-xs font-medium fill-gray-800">
            遗物: {hoveredGridCell.count} 件
          </text>
          <line x1={8} y1={26} x2={172} y2={26} stroke="#e5e7eb" strokeWidth={1} />
          {hoveredCellArtifacts.slice(0, 6).map((artifact, idx) => (
            <text
              key={artifact.id}
              x={10}
              y={42 + idx * 18}
              className="text-[10px] fill-gray-600"
            >
              • {artifact.catalogNumber} ({artifact.type})
            </text>
          ))}
          {hoveredCellArtifacts.length > 6 && (
            <text
              x={10}
              y={42 + 6 * 18}
              className="text-[10px] fill-gray-400"
            >
              ...还有 {hoveredCellArtifacts.length - 6} 件
            </text>
          )}
        </g>
      )}

      {clickMode !== 'none' && (
        <rect
          x={0}
          y={0}
          width={pixelWidth}
          height={pixelHeight}
          fill="transparent"
          style={{ cursor: 'crosshair' }}
          onClick={handleSvgClick}
        />
      )}
    </g>
  );
}
