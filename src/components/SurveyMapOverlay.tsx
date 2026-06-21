import { useState, useMemo, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ControlPoint, IDWResult, ContourLine } from '../types';
import {
  CONTROL_POINT_TYPE_COLORS,
  CONTROL_POINT_TYPE_ICONS,
  getLabelPoints,
} from '../utils/survey';
import { formatDate } from '../utils';

interface SurveyMapOverlayProps {
  trenchId: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  pixelWidth: number;
  pixelHeight: number;
  queryMode?: boolean;
  onQueryElevation?: (x: number, y: number) => void;
  queryResult?: IDWResult | null;
  queryPosition?: { x: number; y: number } | null;
}

export default function SurveyMapOverlay({
  trenchId,
  xMin,
  yMin,
  xMax,
  yMax,
  pixelWidth,
  pixelHeight,
  queryMode = false,
  onQueryElevation,
  queryResult,
  queryPosition,
}: SurveyMapOverlayProps) {
  const controlPoints = useAppStore((state) => state.controlPoints);
  const showControlPointsOnMap = useAppStore((state) => state.showControlPointsOnMap);
  const contourConfig = useAppStore((state) => state.contourConfig);
  const generateContoursForTrench = useAppStore((state) => state.generateContoursForTrench);
  const setSelectedControlPoint = useAppStore((state) => state.setSelectedControlPoint);
  const selectedControlPointId = useAppStore((state) => state.selectedControlPointId);
  const getControlPointById = useAppStore((state) => state.getControlPointById);

  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const points = useMemo(
    () => controlPoints.filter((cp) => cp.trenchId === trenchId),
    [controlPoints, trenchId]
  );

  const contours = useMemo(() => {
    if (!contourConfig.visible) return [];
    return generateContoursForTrench(trenchId, contourConfig.interval);
  }, [trenchId, contourConfig.visible, contourConfig.interval, generateContoursForTrench]);

  const xRange = xMax - xMin;
  const yRange = yMax - yMin;

  const toPixelX = (x: number): number => {
    return ((x - xMin) / xRange) * pixelWidth;
  };

  const toPixelY = (y: number): number => {
    return pixelHeight - ((y - yMin) / yRange) * pixelHeight;
  };

  const toMapX = (px: number): number => {
    return xMin + (px / pixelWidth) * xRange;
  };

  const toMapY = (py: number): number => {
    return yMax - (py / pixelHeight) * yRange;
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!queryMode || !onQueryElevation || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const mapX = toMapX(px);
    const mapY = toMapY(py);

    onQueryElevation(mapX, mapY);
  };

  const handlePointClick = (e: React.MouseEvent, pointId: string) => {
    e.stopPropagation();
    setSelectedControlPoint(pointId);
  };

  const selectedPoint = selectedControlPointId
    ? getControlPointById(selectedControlPointId)
    : null;

  const contourPaths = useMemo(() => {
    return contours.map((contour, idx) => {
      if (contour.points.length < 2) return null;
      const pathData = contour.points
        .map((p, i) => {
          const px = toPixelX(p.x);
          const py = toPixelY(p.y);
          return `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`;
        })
        .join(' ');

      return {
        key: `contour-${idx}`,
        pathData,
        elevation: contour.elevation,
        labels: contourConfig.showLabels
          ? getLabelPoints(contour.points, 100)
          : [],
      };
    }).filter(Boolean) as {
      key: string;
      pathData: string;
      elevation: number;
      labels: { x: number; y: number; angle: number }[];
    }[];
  }, [contours, contourConfig.showLabels, toPixelX, toPixelY]);

  return (
    <g>
      {contourConfig.visible && (
        <g className="contour-layer">
          {contourPaths.map((contour) => (
            <g key={contour.key}>
              <path
                d={contour.pathData}
                fill="none"
                stroke="#92400e"
                strokeWidth={1.5}
                strokeOpacity={0.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {contourConfig.showLabels &&
                contour.labels.map((label, idx) => (
                  <g
                    key={idx}
                    transform={`translate(${toPixelX(label.x)}, ${toPixelY(label.y)}) rotate(${label.angle})`}
                  >
                    <rect
                      x={-18}
                      y={-7}
                      width={36}
                      height={14}
                      fill="white"
                      fillOpacity={0.9}
                      rx={2}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[10px] fill-earth-700 font-medium"
                    >
                      {contour.elevation.toFixed(1)}
                    </text>
                  </g>
                ))}
            </g>
          ))}
        </g>
      )}

      {showControlPointsOnMap && (
        <g className="control-points-layer">
          {points.map((point) => {
            const px = toPixelX(point.x);
            const py = toPixelY(point.y);
            const isHovered = hoveredPointId === point.id;
            const isSelected = selectedControlPointId === point.id;
            const color = CONTROL_POINT_TYPE_COLORS[point.type];

            return (
              <g
                key={point.id}
                transform={`translate(${px}, ${py})`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPointId(point.id)}
                onMouseLeave={() => setHoveredPointId(null)}
                onClick={(e) => handlePointClick(e, point.id)}
              >
                {(isHovered || isSelected) && (
                  <circle
                    r={16}
                    fill={color}
                    fillOpacity={0.2}
                    stroke={color}
                    strokeWidth={2}
                  />
                )}
                <circle r={10} fill="white" stroke={color} strokeWidth={2} />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={12}
                  fill={color}
                >
                  {CONTROL_POINT_TYPE_ICONS[point.type]}
                </text>

                {isHovered && (
                  <g transform="translate(14, -14)">
                    <rect
                      x={0}
                      y={0}
                      width={120}
                      height={50}
                      fill="white"
                      stroke="#e5e7eb"
                      strokeWidth={1}
                      rx={4}
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                    />
                    <text x={8} y={16} className="text-xs font-medium fill-gray-800">
                      {point.code}
                    </text>
                    <text x={8} y={30} className="text-[10px] fill-gray-500">
                      标高: {point.z.toFixed(3)}m
                    </text>
                    <text x={8} y={42} className="text-[10px] fill-gray-400">
                      {point.type}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      )}

      {queryPosition && queryResult && (
        <g className="click-result-layer">
          <circle
            cx={toPixelX(queryPosition.x)}
            cy={toPixelY(queryPosition.y)}
            r={6}
            fill="#3b82f6"
            fillOpacity={0.3}
            stroke="#3b82f6"
            strokeWidth={2}
          />
          <g
            transform={`translate(${toPixelX(queryPosition.x) + 10}, ${toPixelY(queryPosition.y) - 10})`}
          >
            <rect
              x={0}
              y={0}
              width={180}
              height={100 + queryResult.pointsUsed.length * 18}
              fill="white"
              stroke="#e5e7eb"
              strokeWidth={1}
              rx={4}
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
            />
            <text x={8} y={16} className="text-xs font-semibold fill-gray-800">
              推算标高
            </text>
            <text x={8} y={32} className="text-sm font-bold fill-earth-600">
              {queryResult.elevation.toFixed(3)} m
            </text>
            {!queryResult.sufficientAccuracy && (
              <text x={8} y={48} className="text-[10px] fill-amber-600">
                ⚠️ {queryResult.warning}
              </text>
            )}
            <text x={8} y={queryResult.sufficientAccuracy ? 48 : 62} className="text-[10px] fill-gray-400">
              参与计算的控制点:
            </text>
            {queryResult.pointsUsed.map((item, idx) => (
              <g key={idx}>
                <text
                  x={12}
                  y={(queryResult.sufficientAccuracy ? 60 : 74) + idx * 18}
                  className="text-[10px] fill-gray-600"
                >
                  {item.point.code}
                </text>
                <text
                  x={70}
                  y={(queryResult.sufficientAccuracy ? 60 : 74) + idx * 18}
                  className="text-[10px] fill-gray-500"
                >
                  {item.distance.toFixed(1)}m
                </text>
                <text
                  x={120}
                  y={(queryResult.sufficientAccuracy ? 60 : 74) + idx * 18}
                  className="text-[10px] fill-gray-400"
                >
                  权重 {(item.weight * 100).toFixed(1)}%
                </text>
              </g>
            ))}
            {queryResult.pointsUsed.length === 0 && (
              <text x={12} y={queryResult.sufficientAccuracy ? 60 : 74} className="text-[10px] fill-gray-400">
                无
              </text>
            )}
          </g>
        </g>
      )}
    </g>
  );
}

export { SurveyMapOverlay };
