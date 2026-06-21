import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  ProfileEditorTool,
  ProfileBezierPoint,
  BoundaryType,
  ProfileIntersection,
} from '../types';
import {
  generateBezierPath,
  getElevationReferences,
  getCellBoundaryPositions,
  generateFillPath,
  exportProfileToSVG,
  downloadSVG,
  evaluateBezierAt,
} from '../utils/profile';
import ProfileListPanel from './ProfileListPanel';

const MARGIN = { top: 60, right: 60, bottom: 60, left: 80 };

export default function ProfileVectorEditor() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const trench = useAppStore((state) =>
    state.trenches.find((t) => t.id === selectedTrenchId)
  );
  const cells = useAppStore((state) =>
    state.cells.filter((c) => c.trenchId === selectedTrenchId)
  );
  const stratigraphies = useAppStore((state) =>
    state.stratigraphies.filter((s) => s.trenchId === selectedTrenchId)
  );
  const units = useAppStore((state) =>
    state.units.filter((u) => u.trenchId === selectedTrenchId)
  );
  const features = useAppStore((state) =>
    state.features.filter((f) => f.trenchId === selectedTrenchId)
  );
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const profile = useAppStore((state) =>
    state.profiles.find((p) => p.id === selectedProfileId)
  );

  const addBoundaryLine = useAppStore((state) => state.addBoundaryLine);
  const updateBoundaryLine = useAppStore((state) => state.updateBoundaryLine);
  const deleteBoundaryLine = useAppStore((state) => state.deleteBoundaryLine);
  const addCutLine = useAppStore((state) => state.addCutLine);
  const updateCutLine = useAppStore((state) => state.updateCutLine);
  const deleteCutLine = useAppStore((state) => state.deleteCutLine);
  const addAnnotation = useAppStore((state) => state.addAnnotation);
  const updateAnnotation = useAppStore((state) => state.updateAnnotation);
  const deleteAnnotation = useAppStore((state) => state.deleteAnnotation);
  const getProfileIntersections = useAppStore((state) => state.getProfileIntersections);
  const alignBoundaryAtIntersection = useAppStore((state) => state.alignBoundaryAtIntersection);

  const [currentTool, setCurrentTool] = useState<ProfileEditorTool>('select');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementType, setSelectedElementType] = useState<'boundary' | 'cut' | 'annotation' | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<ProfileBezierPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [boundaryType, setBoundaryType] = useState<BoundaryType>('top');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>('');
  const [showCutModal, setShowCutModal] = useState(false);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [annotationFontSize, setAnnotationFontSize] = useState(12);
  const [annotationRotation, setAnnotationRotation] = useState(0);
  const [pendingAnnotationPos, setPendingAnnotationPos] = useState<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const [showIntersectionPanel, setShowIntersectionPanel] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null);
  const [controlPointsVisible, setControlPointsVisible] = useState(true);

  useEffect(() => {
    if (containerRef.current) {
      const updateSize = () => {
        if (containerRef.current && profile) {
          setDimensions({
            width: Math.max(profile.width, containerRef.current.clientWidth - 320),
            height: Math.max(profile.height, containerRef.current.clientHeight - 100),
          });
        }
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, [profile]);

  const plotWidth = dimensions.width - MARGIN.left - MARGIN.right;
  const plotHeight = dimensions.height - MARGIN.top - MARGIN.bottom;

  const xScale = useCallback(
    (x: number) => {
      if (!profile) return 0;
      return MARGIN.left + (x / profile.totalLength) * plotWidth;
    },
    [profile, plotWidth]
  );

  const yScale = useCallback(
    (y: number) => {
      if (!profile) return 0;
      return (
        MARGIN.top +
        plotHeight -
        ((y - profile.minElevation) / (profile.maxElevation - profile.minElevation)) * plotHeight
      );
    },
    [profile, plotHeight]
  );

  const inverseXScale = useCallback(
    (screenX: number) => {
      if (!profile) return 0;
      return ((screenX - MARGIN.left) / plotWidth) * profile.totalLength;
    },
    [profile, plotWidth]
  );

  const inverseYScale = useCallback(
    (screenY: number) => {
      if (!profile) return 0;
      return (
        ((MARGIN.top + plotHeight - screenY) / plotHeight) *
          (profile.maxElevation - profile.minElevation) +
        profile.minElevation
      );
    },
    [profile, plotHeight]
  );

  const transformPoints = useCallback(
    (points: ProfileBezierPoint[]): ProfileBezierPoint[] =>
      points.map((p) => ({
        ...p,
        x: xScale(p.x),
        y: yScale(p.y),
        cp1x: p.cp1x !== undefined ? xScale(p.cp1x) : undefined,
        cp1y: p.cp1y !== undefined ? yScale(p.cp1y) : undefined,
        cp2x: p.cp2x !== undefined ? xScale(p.cp2x) : undefined,
        cp2y: p.cp2y !== undefined ? yScale(p.cp2y) : undefined,
      })),
    [xScale, yScale]
  );

  const elevationReferences = useMemo(() => {
    if (!profile || !trench) return [];
    return getElevationReferences(profile, cells, stratigraphies, trench.cellSize);
  }, [profile, cells, stratigraphies, trench]);

  const cellBoundaryPositions = useMemo(() => {
    if (!profile || !trench) return [];
    return getCellBoundaryPositions(profile, trench.cellSize);
  }, [profile, trench]);

  const intersections = useMemo(() => {
    if (!selectedTrenchId) return [];
    return getProfileIntersections(selectedTrenchId);
  }, [selectedTrenchId, getProfileIntersections]);

  const currentProfileIntersections = useMemo(() => {
    if (!selectedProfileId) return [];
    return intersections.filter(
      (i) => i.profileIdA === selectedProfileId || i.profileIdB === selectedProfileId
    );
  }, [intersections, selectedProfileId]);

  const handleSVGClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !profile) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;

    if (currentTool === 'pan') return;

    if (currentTool === 'boundary' || currentTool === 'cut') {
      const dataX = inverseXScale(x);
      const dataY = inverseYScale(y);

      if (!isDrawing) {
        setIsDrawing(true);
        setDrawingPoints([{ x: dataX, y: dataY }]);
      } else {
        setDrawingPoints((prev) => [
          ...prev,
          {
            x: dataX,
            y: dataY,
            cp1x: prev[prev.length - 1].x + (dataX - prev[prev.length - 1].x) / 3,
            cp1y: prev[prev.length - 1].y + (dataY - prev[prev.length - 1].y) / 3,
            cp2x: prev[prev.length - 1].x + (dataX - prev[prev.length - 1].x) * 2 / 3,
            cp2y: prev[prev.length - 1].y + (dataY - prev[prev.length - 1].y) * 2 / 3,
          },
        ]);
      }
    } else if (currentTool === 'annotation') {
      const dataX = inverseXScale(x);
      const dataY = inverseYScale(y);
      setPendingAnnotationPos({ x: dataX, y: dataY });
      setAnnotationText('');
      setAnnotationFontSize(12);
      setAnnotationRotation(0);
      setShowAnnotationModal(true);
    } else if (currentTool === 'select') {
      setSelectedElementId(null);
      setSelectedElementType(null);
      setEditingPointIndex(null);
    }
  };

  const handleSVGDblClick = () => {
    if (!isDrawing || !profile) return;

    if (drawingPoints.length >= 2) {
      if (currentTool === 'boundary') {
        if (!selectedUnitId) {
          alert('请先选择地层单位');
          return;
        }
        const unit = units.find((u) => u.id === selectedUnitId);
        addBoundaryLine({
          profileId: profile.id,
          trenchId: profile.trenchId,
          unitId: selectedUnitId,
          type: boundaryType,
          points: drawingPoints,
          strokeColor: unit?.color || '#333',
          strokeWidth: 2,
          visible: true,
          locked: false,
        });
      } else if (currentTool === 'cut') {
        setShowCutModal(true);
      }
    }

    setIsDrawing(false);
    setDrawingPoints([]);
  };

  const handleCutModalConfirm = () => {
    if (!profile || !selectedFeatureId) return;

    const feature = features.find((f) => f.id === selectedFeatureId);
    addCutLine({
      profileId: profile.id,
      trenchId: profile.trenchId,
      featureId: selectedFeatureId,
      featureNumber: feature?.featureNumber || '',
      points: drawingPoints,
      strokeColor: '#dc2626',
      strokeWidth: 1.5,
      dashArray: '8,4',
      visible: true,
    });

    setShowCutModal(false);
    setSelectedFeatureId('');
    setDrawingPoints([]);
  };

  const handleAnnotationModalConfirm = () => {
    if (!profile || !pendingAnnotationPos || !annotationText.trim()) return;

    addAnnotation({
      profileId: profile.id,
      trenchId: profile.trenchId,
      text: annotationText.trim(),
      x: pendingAnnotationPos.x,
      y: pendingAnnotationPos.y,
      fontSize: annotationFontSize,
      rotation: annotationRotation,
      color: '#333',
      visible: true,
    });

    setShowAnnotationModal(false);
    setPendingAnnotationPos(null);
    setAnnotationText('');
  };

  const handleElementClick = (
    e: React.MouseEvent,
    elementId: string,
    elementType: 'boundary' | 'cut' | 'annotation',
    pointIndex?: number
  ) => {
    e.stopPropagation();
    if (currentTool !== 'select') return;

    setSelectedElementId(elementId);
    setSelectedElementType(elementType);

    if (pointIndex !== undefined) {
      setEditingPointIndex(pointIndex);
    }
  };

  const handlePointDrag = (
    e: React.MouseEvent,
    lineId: string,
    lineType: 'boundary' | 'cut',
    pointIndex: number
  ) => {
    e.stopPropagation();
    if (currentTool !== 'select' || selectedElementId !== lineId) return;

    if (!svgRef.current || !profile) return;

    const handleMove = (moveEvent: MouseEvent) => {
      const rect = svgRef.current!.getBoundingClientRect();
      const x = (moveEvent.clientX - rect.left - panOffset.x) / zoom;
      const y = (moveEvent.clientY - rect.top - panOffset.y) / zoom;

      const dataX = inverseXScale(x);
      const dataY = inverseYScale(y);

      if (lineType === 'boundary') {
        const line = profile.boundaryLines.find((l) => l.id === lineId);
        if (line && pointIndex < line.points.length) {
          const newPoints = [...line.points];
          newPoints[pointIndex] = {
            ...newPoints[pointIndex],
            x: dataX,
            y: dataY,
          };
          if (pointIndex > 0) {
            const prev = newPoints[pointIndex - 1];
            newPoints[pointIndex - 1] = {
              ...prev,
              cp2x: prev.x + (dataX - prev.x) / 3,
              cp2y: prev.y + (dataY - prev.y) / 3,
            };
          }
          if (pointIndex < newPoints.length - 1) {
            const next = newPoints[pointIndex + 1];
            newPoints[pointIndex] = {
              ...newPoints[pointIndex],
              cp1x: newPoints[pointIndex].x + (next.x - newPoints[pointIndex].x) / 3,
              cp1y: newPoints[pointIndex].y + (next.y - newPoints[pointIndex].y) / 3,
            };
          }
          updateBoundaryLine(lineId, { points: newPoints });
        }
      } else if (lineType === 'cut') {
        const line = profile.cutLines.find((l) => l.id === lineId);
        if (line && pointIndex < line.points.length) {
          const newPoints = [...line.points];
          newPoints[pointIndex] = {
            ...newPoints[pointIndex],
            x: dataX,
            y: dataY,
          };
          updateCutLine(lineId, { points: newPoints });
        }
      }
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const handleAnnotationDrag = (e: React.MouseEvent, annotationId: string) => {
    e.stopPropagation();
    if (currentTool !== 'select' || selectedElementId !== annotationId) return;
    if (!svgRef.current || !profile) return;

    const handleMove = (moveEvent: MouseEvent) => {
      const rect = svgRef.current!.getBoundingClientRect();
      const x = (moveEvent.clientX - rect.left - panOffset.x) / zoom;
      const y = (moveEvent.clientY - rect.top - panOffset.y) / zoom;

      const dataX = inverseXScale(x);
      const dataY = inverseYScale(y);

      updateAnnotation(annotationId, { x: dataX, y: dataY });
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (currentTool === 'pan' && e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.5, Math.min(3, z * delta)));
  };

  const handleDeleteSelected = () => {
    if (!selectedElementId) return;

    if (selectedElementType === 'boundary') {
      deleteBoundaryLine(selectedElementId);
    } else if (selectedElementType === 'cut') {
      deleteCutLine(selectedElementId);
    } else if (selectedElementType === 'annotation') {
      deleteAnnotation(selectedElementId);
    }

    setSelectedElementId(null);
    setSelectedElementType(null);
  };

  const handleExportSVG = () => {
    if (!profile || !trench) return;
    const svgContent = exportProfileToSVG(
      profile,
      cells,
      units,
      features,
      trench.cellSize,
      1200,
      800
    );
    downloadSVG(svgContent, `${profile.name}.svg`);
  };

  const handleAlignIntersection = (intersection: ProfileIntersection) => {
    if (!selectedProfileId || !intersection.unitId) return;
    alignBoundaryAtIntersection(intersection.id, selectedProfileId, intersection.unitId);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDrawing) {
          setIsDrawing(false);
          setDrawingPoints([]);
        } else {
          setCurrentTool('select');
          setSelectedElementId(null);
          setSelectedElementType(null);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId && !showAnnotationModal && !showCutModal) {
          handleDeleteSelected();
        }
      } else if (e.key === 'v' || e.key === 'V') {
        setCurrentTool('select');
      } else if (e.key === 'b' || e.key === 'B') {
        setCurrentTool('boundary');
      } else if (e.key === 'c' || e.key === 'C') {
        setCurrentTool('cut');
      } else if (e.key === 't' || e.key === 'T') {
        setCurrentTool('annotation');
      } else if (e.key === 'h' || e.key === 'H') {
        setCurrentTool('pan');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, selectedElementType, isDrawing, showAnnotationModal, showCutModal]);

  const getCellCode = (cellId: string) => cells.find((c) => c.id === cellId)?.code || '';

  const renderGrid = () => {
    if (!profile) return null;

    const elements: JSX.Element[] = [];

    const elevRange = profile.maxElevation - profile.minElevation;
    const tickInterval = elevRange <= 5 ? 0.5 : elevRange <= 10 ? 1 : 2;

    for (
      let e = Math.ceil(profile.minElevation / tickInterval) * tickInterval;
      e <= profile.maxElevation;
      e += tickInterval
    ) {
      const y = yScale(e);
      elements.push(
        <line
          key={`h-${e}`}
          x1={MARGIN.left}
          y1={y}
          x2={MARGIN.left + plotWidth}
          y2={y}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      );
      elements.push(
        <text
          key={`ht-${e}`}
          x={MARGIN.left - 10}
          y={y + 4}
          textAnchor="end"
          fontSize={10}
          fill="#666"
        >
          {e.toFixed(1)}m
        </text>
      );
    }

    cellBoundaryPositions.forEach((pos, i) => {
      const x = xScale(pos);
      elements.push(
        <line
          key={`v-${i}`}
          x1={x}
          y1={MARGIN.top}
          x2={x}
          y2={MARGIN.top + plotHeight}
          stroke="#9ca3af"
          strokeWidth={1}
          strokeDasharray="4,2"
        />
      );
      if (i < profile.cellIds.length) {
        const midX = xScale(pos + (profile.totalLength / profile.cellIds.length) / 2);
        elements.push(
          <text
            key={`vt-${i}`}
            x={midX}
            y={MARGIN.top + plotHeight + 20}
            textAnchor="middle"
            fontSize={10}
            fill="#666"
          >
            {getCellCode(profile.cellIds[i])}
          </text>
        );
      }
    });

    elements.push(
      <line
        key="axis-left"
        x1={MARGIN.left}
        y1={MARGIN.top}
        x2={MARGIN.left}
        y2={MARGIN.top + plotHeight}
        stroke="#333"
        strokeWidth={1.5}
      />
    );
    elements.push(
      <line
        key="axis-bottom"
        x1={MARGIN.left}
        y1={MARGIN.top + plotHeight}
        x2={MARGIN.left + plotWidth}
        y2={MARGIN.top + plotHeight}
        stroke="#333"
        strokeWidth={1.5}
      />
    );

    elements.push(
      <text
        key="y-label"
        x={25}
        y={MARGIN.top + plotHeight / 2}
        textAnchor="middle"
        fontSize={12}
        fill="#666"
        transform={`rotate(-90 25 ${MARGIN.top + plotHeight / 2})`}
      >
        标高 (m)
      </text>
    );
    elements.push(
      <text
        key="x-label"
        x={MARGIN.left + plotWidth / 2}
        y={MARGIN.top + plotHeight + 45}
        textAnchor="middle"
        fontSize={12}
        fill="#666"
      >
        水平距离 (m)
      </text>
    );

    return elements;
  };

  const renderReferencePoints = () => {
    if (!profile) return null;

    return elevationReferences.map((ref, i) => {
      const x = xScale(ref.distance);
      const yTop = yScale(ref.topElevation);
      const yBottom = yScale(ref.bottomElevation);
      const unit = units.find((u) => u.id === ref.unitId);

      return (
        <g key={`ref-${i}`}>
          <circle
            cx={x}
            cy={yTop}
            r={4}
            fill={unit?.color || '#666'}
            stroke="#fff"
            strokeWidth={1}
            opacity={0.8}
          >
            <title>
              {getCellCode(ref.cellId)} 第{ref.layerNumber}层 顶: {ref.topElevation.toFixed(2)}m
            </title>
          </circle>
          <circle
            cx={x}
            cy={yBottom}
            r={4}
            fill={unit?.color || '#666'}
            stroke="#fff"
            strokeWidth={1}
            opacity={0.5}
          >
            <title>
              {getCellCode(ref.cellId)} 第{ref.layerNumber}层 底: {ref.bottomElevation.toFixed(2)}m
            </title>
          </circle>
        </g>
      );
    });
  };

  const renderFills = () => {
    if (!profile) return null;

    const unitIds = new Set(profile.boundaryLines.map((l) => l.unitId));
    const elements: JSX.Element[] = [];

    unitIds.forEach((unitId) => {
      const topLine = profile.boundaryLines.find(
        (l) => l.unitId === unitId && l.type === 'top' && l.visible
      );
      const bottomLine = profile.boundaryLines.find(
        (l) => l.unitId === unitId && l.type === 'bottom' && l.visible
      );
      const unit = units.find((u) => u.id === unitId);

      if (topLine && bottomLine && unit) {
        const fillPath = generateFillPath(
          { ...topLine, points: transformPoints(topLine.points) },
          { ...bottomLine, points: transformPoints(bottomLine.points) }
        );
        elements.push(
          <path
            key={`fill-${unitId}`}
            d={fillPath}
            fill={unit.color}
            fillOpacity={0.5}
            stroke="none"
            style={{ pointerEvents: 'none' }}
          />
        );
      }
    });

    return elements;
  };

  const renderBoundaryLines = () => {
    if (!profile) return null;

    return profile.boundaryLines
      .filter((l) => l.visible)
      .map((line) => {
        const path = generateBezierPath(transformPoints(line.points));
        const isSelected = selectedElementId === line.id;
        const unit = units.find((u) => u.id === line.unitId);

        return (
          <g key={line.id}>
            <path
              d={path}
              fill="none"
              stroke={isSelected ? '#f59e0b' : line.strokeColor}
              strokeWidth={isSelected ? 3 : line.strokeWidth}
              strokeLinecap="round"
              style={{ cursor: currentTool === 'select' ? 'pointer' : 'default' }}
              onClick={(e) => handleElementClick(e, line.id, 'boundary')}
            >
              <title>
                {unit?.code || ''} {line.type === 'top' ? '顶面' : '底面'}线
              </title>
            </path>
            {isSelected && controlPointsVisible &&
              line.points.map((point, idx) => {
                const tx = xScale(point.x);
                const ty = yScale(point.y);
                return (
                  <g key={`${line.id}-pt-${idx}`}>
                    {point.cp1x !== undefined && point.cp1y !== undefined && (
                      <line
                        x1={tx}
                        y1={ty}
                        x2={xScale(point.cp1x)}
                        y2={yScale(point.cp1y)}
                        stroke="#999"
                        strokeWidth={1}
                        strokeDasharray="2,2"
                      />
                    )}
                    {point.cp2x !== undefined && point.cp2y !== undefined && (
                      <line
                        x1={tx}
                        y1={ty}
                        x2={xScale(point.cp2x)}
                        y2={yScale(point.cp2y)}
                        stroke="#999"
                        strokeWidth={1}
                        strokeDasharray="2,2"
                      />
                    )}
                    <circle
                      cx={tx}
                      cy={ty}
                      r={editingPointIndex === idx ? 8 : 6}
                      fill="#fff"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      style={{ cursor: 'move' }}
                      onMouseDown={(e) => handlePointDrag(e, line.id, 'boundary', idx)}
                      onClick={(e) => handleElementClick(e, line.id, 'boundary', idx)}
                    />
                  </g>
                );
              })}
          </g>
        );
      });
  };

  const renderCutLines = () => {
    if (!profile) return null;

    return profile.cutLines
      .filter((l) => l.visible)
      .map((line) => {
        const path = generateBezierPath(transformPoints(line.points));
        const isSelected = selectedElementId === line.id;
        const feature = features.find((f) => f.id === line.featureId);
        const midIdx = Math.floor(line.points.length / 2);
        const midPoint = line.points[midIdx];
        const labelX = midPoint ? xScale(midPoint.x) : 0;
        const labelY = midPoint ? yScale(midPoint.y) - 10 : 0;

        return (
          <g key={line.id}>
            <path
              d={path}
              fill="none"
              stroke={isSelected ? '#f59e0b' : line.strokeColor}
              strokeWidth={isSelected ? 2.5 : line.strokeWidth}
              strokeDasharray={line.dashArray}
              style={{ cursor: currentTool === 'select' ? 'pointer' : 'default' }}
              onClick={(e) => handleElementClick(e, line.id, 'cut')}
            >
              <title>打破线: {feature?.featureNumber || line.featureNumber}</title>
            </path>
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fontSize={11}
              fill={line.strokeColor}
              fontWeight="bold"
            >
              {feature?.featureNumber || line.featureNumber}
            </text>
            {isSelected && controlPointsVisible &&
              line.points.map((point, idx) => {
                const tx = xScale(point.x);
                const ty = yScale(point.y);
                return (
                  <circle
                    key={`${line.id}-pt-${idx}`}
                    cx={tx}
                    cy={ty}
                    r={5}
                    fill="#fff"
                    stroke={line.strokeColor}
                    strokeWidth={2}
                    style={{ cursor: 'move' }}
                    onMouseDown={(e) => handlePointDrag(e, line.id, 'cut', idx)}
                    onClick={(e) => handleElementClick(e, line.id, 'cut', idx)}
                  />
                );
              })}
          </g>
        );
      });
  };

  const renderAnnotations = () => {
    if (!profile) return null;

    return profile.annotations
      .filter((a) => a.visible)
      .map((ann) => {
        const x = xScale(ann.x);
        const y = yScale(ann.y);
        const isSelected = selectedElementId === ann.id;

        return (
          <g
            key={ann.id}
            transform={`rotate(${ann.rotation} ${x} ${y})`}
            style={{ cursor: currentTool === 'select' ? 'move' : 'default' }}
            onMouseDown={(e) => handleAnnotationDrag(e, ann.id)}
            onClick={(e) => handleElementClick(e, ann.id, 'annotation')}
          >
            {isSelected && (
              <rect
                x={x - 30}
                y={y - ann.fontSize}
                width={60}
                height={ann.fontSize + 10}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
            )}
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={ann.fontSize}
              fill={ann.color}
            >
              {ann.text}
            </text>
          </g>
        );
      });
  };

  const renderDrawingPath = () => {
    if (!isDrawing || drawingPoints.length === 0) return null;

    const path = generateBezierPath(transformPoints(drawingPoints));
    const color = currentTool === 'boundary' ? '#2563eb' : '#dc2626';

    return (
      <g>
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={currentTool === 'cut' ? '8,4' : 'none'}
          opacity={0.7}
        />
        {drawingPoints.map((p, i) => (
          <circle
            key={i}
            cx={xScale(p.x)}
            cy={yScale(p.y)}
            r={4}
            fill="#fff"
            stroke={color}
            strokeWidth={2}
          />
        ))}
      </g>
    );
  };

  const renderIntersectionIndicators = () => {
    if (!profile || !selectedProfileId) return null;

    return currentProfileIntersections.map((intersection) => {
      const isProfileA = intersection.profileIdA === selectedProfileId;
      const distance = isProfileA ? intersection.distanceA : intersection.distanceB;
      const x = xScale(distance);
      const elevation = isProfileA ? intersection.elevationA : intersection.elevationB;
      const y = elevation !== undefined ? yScale(elevation) : MARGIN.top + plotHeight / 2;
      const unit = units.find((u) => u.id === intersection.unitId);

      return (
        <g key={intersection.id}>
          <circle
            cx={x}
            cy={y}
            r={8}
            fill={intersection.aligned ? '#22c55e' : '#ef4444'}
            stroke="#fff"
            strokeWidth={2}
            opacity={0.9}
          >
            <title>
              {intersection.aligned ? '标高一致' : `标高不一致，偏差${intersection.deviation.toFixed(3)}m`}
              {'\n'}
              单位: {unit?.code || intersection.unitId}
            </title>
          </circle>
          {!intersection.aligned && (
            <g>
              <line
                x1={x - 12}
                y1={y - 12}
                x2={x + 12}
                y2={y + 12}
                stroke="#ef4444"
                strokeWidth={2}
              />
              <line
                x1={x + 12}
                y1={y - 12}
                x2={x - 12}
                y2={y + 12}
                stroke="#ef4444"
                strokeWidth={2}
              />
            </g>
          )}
        </g>
      );
    });
  };

  const toolButtons = [
    { id: 'select' as ProfileEditorTool, label: '选择 (V)', icon: '↖' },
    { id: 'boundary' as ProfileEditorTool, label: '地层界面 (B)', icon: '〰' },
    { id: 'cut' as ProfileEditorTool, label: '打破线 (C)', icon: '╌' },
    { id: 'annotation' as ProfileEditorTool, label: '文字注记 (T)', icon: 'T' },
    { id: 'pan' as ProfileEditorTool, label: '平移 (H)', icon: '✋' },
  ];

  if (!profile) {
    return (
      <div className="h-full flex">
        <div className="w-64 border-r border-gray-200 bg-white">
          <ProfileListPanel />
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>请从左侧列表选择一个剖面，或创建新剖面</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">剖面矢量编辑器</h2>
          <p className="text-sm text-gray-500 mt-1">
            {profile.name} - {profile.cellIds.length}个方格，总长{profile.totalLength.toFixed(1)}m
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIntersectionPanel(!showIntersectionPanel)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showIntersectionPanel
                ? 'bg-earth-100 text-earth-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            交叉点对齐 ({currentProfileIntersections.filter((i) => !i.aligned).length})
          </button>
          <button
            onClick={handleExportSVG}
            className="px-3 py-2 bg-earth-600 text-white text-sm rounded-lg hover:bg-earth-700 transition-colors"
          >
            导出 SVG
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
          <ProfileListPanel />
        </div>

        <div className="flex-1 flex flex-col">
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {toolButtons.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setCurrentTool(tool.id)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    currentTool === tool.id
                      ? 'bg-white shadow text-earth-700'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  title={tool.label}
                >
                  <span className="mr-1">{tool.icon}</span>
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-gray-300 mx-2" />

            {currentTool === 'boundary' && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                >
                  <option value="">选择地层单位</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} - {u.name}
                    </option>
                  ))}
                </select>
                <select
                  value={boundaryType}
                  onChange={(e) => setBoundaryType(e.target.value as BoundaryType)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                >
                  <option value="top">顶面</option>
                  <option value="bottom">底面</option>
                </select>
              </div>
            )}

            {isDrawing && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  已添加 {drawingPoints.length} 个点，双击完成
                </span>
                <button
                  onClick={() => {
                    setIsDrawing(false);
                    setDrawingPoints([]);
                  }}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            )}

            {selectedElementId && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  已选择 {selectedElementType === 'boundary' ? '界面线' : selectedElementType === 'cut' ? '打破线' : '注记'}
                </span>
                <button
                  onClick={handleDeleteSelected}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  删除
                </button>
              </div>
            )}

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                −
              </button>
              <span className="text-sm text-gray-600 w-16 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                +
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                重置
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div
              ref={containerRef}
              className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto"
            >
              <svg
                ref={svgRef}
                width={dimensions.width}
                height={dimensions.height}
                style={{
                  cursor: currentTool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair',
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                }}
                onClick={handleSVGClick}
                onDoubleClick={handleSVGDblClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                <rect width={dimensions.width} height={dimensions.height} fill="#fafafa" />

                {renderGrid()}
                {renderFills()}
                {renderReferencePoints()}
                {renderBoundaryLines()}
                {renderCutLines()}
                {renderAnnotations()}
                {renderDrawingPath()}
                {renderIntersectionIndicators()}
              </svg>
            </div>

            {showIntersectionPanel && (
              <div className="w-72 border-l border-gray-200 bg-white flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h3 className="font-medium text-gray-700">交叉点对齐</h3>
                  <button
                    onClick={() => setShowIntersectionPanel(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-3">
                  {currentProfileIntersections.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      暂无交叉点
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentProfileIntersections.map((intersection) => {
                        const otherProfileId =
                          intersection.profileIdA === selectedProfileId
                            ? intersection.profileIdB
                            : intersection.profileIdA;
                        const otherProfile = useAppStore
                          .getState()
                          .profiles.find((p) => p.id === otherProfileId);
                        const isProfileA = intersection.profileIdA === selectedProfileId;
                        const myElev = isProfileA ? intersection.elevationA : intersection.elevationB;
                        const otherElev = isProfileA ? intersection.elevationB : intersection.elevationA;
                        const unit = units.find((u) => u.id === intersection.unitId);
                        const cell = cells.find((c) => c.id === intersection.cellId);

                        return (
                          <div
                            key={intersection.id}
                            className={`p-3 rounded-lg border ${
                              intersection.aligned
                                ? 'border-green-200 bg-green-50'
                                : 'border-red-200 bg-red-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`text-sm font-medium ${
                                  intersection.aligned ? 'text-green-700' : 'text-red-700'
                                }`}
                              >
                                {intersection.aligned ? '✓ 已对齐' : '✗ 不一致'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {cell?.code || intersection.cellId}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div>
                                <span className="text-gray-500">地层单位：</span>
                                <span className="font-medium">
                                  {unit?.code || intersection.unitId}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">交叉剖面：</span>
                                <span>{otherProfile?.name || otherProfileId}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">我方标高：</span>
                                <span>{myElev?.toFixed(3)}m</span>
                              </div>
                              <div>
                                <span className="text-gray-500">对方标高：</span>
                                <span>{otherElev?.toFixed(3)}m</span>
                              </div>
                              <div>
                                <span className="text-gray-500">偏差：</span>
                                <span
                                  className={intersection.aligned ? 'text-green-600' : 'text-red-600'}
                                >
                                  {intersection.deviation.toFixed(3)}m
                                </span>
                              </div>
                            </div>
                            {!intersection.aligned && (
                              <button
                                onClick={() => handleAlignIntersection(intersection)}
                                className="mt-2 w-full px-3 py-1.5 bg-earth-600 text-white text-xs rounded hover:bg-earth-700 transition-colors"
                              >
                                以我方为准对齐
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <span className="font-medium text-gray-700">快捷键：</span>
            V-选择 | B-界面线 | C-打破线 | T-文字 | H-平移 | Delete-删除 | Esc-取消
            {isDrawing && <span className="ml-4 text-earth-600">单击添加点，双击完成绘制</span>}
          </div>
        </div>

        <div className="w-56 border-l border-gray-200 bg-white flex flex-col">
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
                        style={{ backgroundColor: unit.color, opacity: 0.6 }}
                      />
                      <span className="text-xs text-gray-600">
                        {unit.code} - {unit.name}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-400">暂无地层单位</div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">标高参考点</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500 border border-white" style={{ opacity: 0.8 }} />
                  <span className="text-gray-600">顶层标高</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500 border border-white" style={{ opacity: 0.5 }} />
                  <span className="text-gray-600">底层标高</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">交叉点状态</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 border border-white" />
                  <span className="text-gray-600">标高一致</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500 border border-white flex items-center justify-center">
                    <span className="text-white text-[8px]">✕</span>
                  </div>
                  <span className="text-gray-600">标高不一致</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">操作提示</h4>
              <div className="text-xs text-gray-500 space-y-1">
                <p>• 选择「界面线」工具绘制地层顶底面</p>
                <p>• 选择「打破线」工具绘制遗迹打破边界</p>
                <p>• 选择「文字注记」添加标注</p>
                <p>• 选择工具后可拖拽控制点调整曲线</p>
                <p>• 滚轮缩放，按住H平移视图</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">关联遗迹要素</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择打破的遗迹 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedFeatureId}
                onChange={(e) => setSelectedFeatureId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
              >
                <option value="">请选择</option>
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.featureNumber} - {f.featureType}
                  </option>
                ))}
              </select>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCutModal(false);
                  setSelectedFeatureId('');
                  setDrawingPoints([]);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCutModalConfirm}
                disabled={!selectedFeatureId}
                className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {showAnnotationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">添加文字注记</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  注记内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={annotationText}
                  onChange={(e) => setAnnotationText(e.target.value)}
                  placeholder="输入注记内容..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    字号
                  </label>
                  <input
                    type="number"
                    value={annotationFontSize}
                    onChange={(e) => setAnnotationFontSize(parseInt(e.target.value) || 12)}
                    min={8}
                    max={48}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    旋转角度
                  </label>
                  <input
                    type="number"
                    value={annotationRotation}
                    onChange={(e) => setAnnotationRotation(parseInt(e.target.value) || 0)}
                    min={-180}
                    max={180}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAnnotationModal(false);
                  setPendingAnnotationPos(null);
                  setAnnotationText('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAnnotationModalConfirm}
                disabled={!annotationText.trim()}
                className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
