import {
  CalibrationCurve,
  CalibrationAnchor,
  CalibratedSampleDate,
  UnitChronology,
  ChronologyInversion,
  ChronologyModel,
  Sample,
  StratigraphicUnit,
  StratigraphicRelation,
} from '../types';

export const DEFAULT_CALIBRATION_CURVE: CalibrationCurve = {
  id: 'simplified-intcal20',
  name: '简化 IntCal20 校正曲线',
  description: '基于 IntCal20 选取的代表性锚点，锚点之间线性插值',
  anchors: [
    { bp: 0, calBP: 0 },
    { bp: 100, calBP: 95 },
    { bp: 200, calBP: 210 },
    { bp: 500, calBP: 530 },
    { bp: 1000, calBP: 970 },
    { bp: 1500, calBP: 1510 },
    { bp: 2000, calBP: 1990 },
    { bp: 2500, calBP: 2490 },
    { bp: 3000, calBP: 3150 },
    { bp: 3500, calBP: 3800 },
    { bp: 4000, calBP: 4420 },
    { bp: 4500, calBP: 5050 },
    { bp: 5000, calBP: 5730 },
    { bp: 5500, calBP: 6290 },
    { bp: 6000, calBP: 6820 },
    { bp: 6500, calBP: 7430 },
    { bp: 7000, calBP: 7820 },
    { bp: 7500, calBP: 8290 },
    { bp: 8000, calBP: 8800 },
    { bp: 8500, calBP: 9420 },
    { bp: 9000, calBP: 10020 },
    { bp: 9500, calBP: 10750 },
    { bp: 10000, calBP: 11450 },
    { bp: 12000, calBP: 13800 },
    { bp: 14000, calBP: 16600 },
    { bp: 16000, calBP: 19000 },
    { bp: 20000, calBP: 23900 },
    { bp: 25000, calBP: 29500 },
    { bp: 30000, calBP: 34400 },
    { bp: 40000, calBP: 44000 },
    { bp: 50000, calBP: 53500 },
  ],
};

export function bpToCalendarString(bp: number): string {
  const year = 1950 - Math.round(bp);
  if (year > 0) {
    return `公元 ${year} 年`;
  } else if (year === 0) {
    return '公元元年';
  } else {
    return `公元前 ${Math.abs(year)} 年`;
  }
}

export function linearInterpolateCalBP(
  curve: CalibrationCurve,
  bp: number
): number {
  const anchors = [...curve.anchors].sort((a, b) => a.bp - b.bp);

  if (bp <= anchors[0].bp) return anchors[0].calBP;
  if (bp >= anchors[anchors.length - 1].bp)
    return anchors[anchors.length - 1].calBP;

  for (let i = 0; i < anchors.length - 1; i++) {
    const a0 = anchors[i];
    const a1 = anchors[i + 1];
    if (bp >= a0.bp && bp <= a1.bp) {
      const t = (bp - a0.bp) / (a1.bp - a0.bp);
      return a0.calBP + t * (a1.calBP - a0.calBP);
    }
  }
  return bp;
}

function gaussianPDF(x: number, mean: number, sigma: number): number {
  return (
    Math.exp(-((x - mean) ** 2) / (2 * sigma ** 2)) /
    (sigma * Math.sqrt(2 * Math.PI))
  );
}

export function calibrateRadiocarbon(
  rawBP: number,
  rawError: number,
  curve: CalibrationCurve = DEFAULT_CALIBRATION_CURVE
): CalibratedSampleDate {
  const minBP = Math.max(0, rawBP - 2 * rawError);
  const maxBP = rawBP + 2 * rawError;
  const step = Math.max(1, Math.ceil(rawError / 10));
  const samples: { bp: number; calBP: number; probability: number }[] = [];

  for (let bp = minBP; bp <= maxBP; bp += step) {
    const calBP = linearInterpolateCalBP(curve, bp);
    const prob = gaussianPDF(bp, rawBP, rawError);
    samples.push({ bp, calBP, probability: prob });
  }

  const totalProb = samples.reduce((sum, s) => sum + s.probability, 0);
  if (totalProb > 0) {
    samples.forEach((s) => (s.probability /= totalProb));
  }

  const calBPSamples = samples.map((s) => s.calBP);
  const minCalBP = Math.min(...calBPSamples);
  const maxCalBP = Math.max(...calBPSamples);
  const calStep = Math.max(1, Math.ceil((maxCalBP - minCalBP) / 200));

  const calHistogram: Map<number, number> = new Map();
  for (let cal = Math.floor(minCalBP); cal <= Math.ceil(maxCalBP); cal += calStep) {
    calHistogram.set(cal, 0);
  }

  samples.forEach((s) => {
    const bucket =
      Math.floor((s.calBP - minCalBP) / calStep) * calStep + minCalBP;
    const clamped = Math.max(minCalBP, Math.min(maxCalBP, bucket));
    calHistogram.set(clamped, (calHistogram.get(clamped) || 0) + s.probability);
  });

  const sortedCal = Array.from(calHistogram.entries())
    .sort((a, b) => b[1] - a[1]);

  let peakCalBP = rawBP;
  let maxP = -1;
  calHistogram.forEach((p, cal) => {
    if (p > maxP) {
      maxP = p;
      peakCalBP = cal;
    }
  });

  const cumulative68 = findConfidenceInterval(sortedCal, calHistogram, 0.6827);
  const cumulative95 = findConfidenceInterval(sortedCal, calHistogram, 0.9545);

  return {
    pointEstimateBP: peakCalBP,
    pointEstimateCal: bpToCalendarString(peakCalBP),
    confidence68: {
      lowerBP: cumulative68.lower,
      upperBP: cumulative68.upper,
      lowerCal: bpToCalendarString(cumulative68.lower),
      upperCal: bpToCalendarString(cumulative68.upper),
    },
    confidence95: {
      lowerBP: cumulative95.lower,
      upperBP: cumulative95.upper,
      lowerCal: bpToCalendarString(cumulative95.lower),
      upperCal: bpToCalendarString(cumulative95.upper),
    },
    probabilityDistribution: samples,
    rawBP,
    rawError,
  };
}

function findConfidenceInterval(
  sortedByProb: [number, number][],
  histogram: Map<number, number>,
  targetProb: number
): { lower: number; upper: number } {
  let accumulated = 0;
  const selected: number[] = [];
  for (const [cal] of sortedByProb) {
    if (accumulated >= targetProb) break;
    const p = histogram.get(cal) || 0;
    selected.push(cal);
    accumulated += p;
  }
  if (selected.length === 0) {
    const all = Array.from(histogram.keys()).sort((a, b) => a - b);
    return { lower: all[0] || 0, upper: all[all.length - 1] || 0 };
  }
  selected.sort((a, b) => a - b);
  return { lower: selected[0], upper: selected[selected.length - 1] };
}

export function buildUnitChronology(
  unit: StratigraphicUnit,
  samples: Sample[],
  curve: CalibrationCurve = DEFAULT_CALIBRATION_CURVE,
  harrisLevel: number = 0
): UnitChronology | null {
  const unitSamples = samples.filter(
    (s) =>
      s.unitId === unit.id &&
      s.type === '碳十四测年' &&
      s.status === '结果回填' &&
      s.result &&
      typeof s.result.values.bpValue === 'number' &&
      typeof s.result.values.errorRange === 'number'
  );

  if (unitSamples.length === 0) return null;

  const sampleDetails = unitSamples.map((sample) => {
    const bpValue = sample.result!.values.bpValue;
    const errorRange = sample.result!.values.errorRange;
    const calibrated = calibrateRadiocarbon(bpValue, errorRange, curve);
    const weight = 1 / (errorRange * errorRange);
    return {
      sampleId: sample.id,
      sampleNumber: sample.sampleNumber,
      rawBP: bpValue,
      rawError: errorRange,
      calibrated,
      weight,
    };
  });

  const totalWeight = sampleDetails.reduce((sum, d) => sum + d.weight, 0);
  const weightedMeanBP =
    sampleDetails.reduce(
      (sum, d) => sum + d.weight * d.calibrated.pointEstimateBP,
      0
    ) / totalWeight;

  const weightedVariance =
    sampleDetails.reduce(
      (sum, d) =>
        sum +
        d.weight *
          (d.calibrated.pointEstimateBP - weightedMeanBP) ** 2,
      0
    ) / totalWeight;
  const weightedError = Math.sqrt(weightedVariance);

  const allLower95 = Math.min(
    ...sampleDetails.map((d) => d.calibrated.confidence95.lowerBP)
  );
  const allUpper95 = Math.max(
    ...sampleDetails.map((d) => d.calibrated.confidence95.upperBP)
  );
  const allLower68 = Math.min(
    ...sampleDetails.map((d) => d.calibrated.confidence68.lowerBP)
  );
  const allUpper68 = Math.max(
    ...sampleDetails.map((d) => d.calibrated.confidence68.upperBP)
  );

  return {
    unitId: unit.id,
    unitCode: unit.code,
    unitName: unit.name,
    unitColor: unit.color,
    sampleIds: unitSamples.map((s) => s.id),
    sampleCount: unitSamples.length,
    weightedMeanBP: weightedMeanBP,
    weightedMeanCal: bpToCalendarString(weightedMeanBP),
    weightedError,
    combinedConfidence68: {
      lowerBP: allLower68,
      upperBP: allUpper68,
      lowerCal: bpToCalendarString(allLower68),
      upperCal: bpToCalendarString(allUpper68),
    },
    combinedConfidence95: {
      lowerBP: allLower95,
      upperBP: allUpper95,
      lowerCal: bpToCalendarString(allLower95),
      upperCal: bpToCalendarString(allUpper95),
    },
    sampleDetails,
    harrisLevel,
    isAnomaly: false,
  };
}

export function topologicalSortHarris(
  unitIds: string[],
  relations: StratigraphicRelation[]
): { sorted: string[]; levels: Map<string, number> } {
  const inDegree = new Map<string, number>();
  unitIds.forEach((id) => inDegree.set(id, 0));

  const adjList = new Map<string, string[]>();
  unitIds.forEach((id) => adjList.set(id, []));

  relations.forEach((r) => {
    if (r.type === '叠压' || r.type === '打破') {
      if (inDegree.has(r.toUnitId)) {
        inDegree.set(r.toUnitId, (inDegree.get(r.toUnitId) || 0) + 1);
      }
      adjList.get(r.fromUnitId)?.push(r.toUnitId);
    } else if (r.type === '被打破') {
      if (inDegree.has(r.fromUnitId)) {
        inDegree.set(r.fromUnitId, (inDegree.get(r.fromUnitId) || 0) + 1);
      }
      adjList.get(r.toUnitId)?.push(r.fromUnitId);
    }
  });

  const levels = new Map<string, number>();
  const queue: { id: string; level: number }[] = [];

  unitIds.forEach((id) => {
    if (inDegree.get(id) === 0) queue.push({ id, level: 0 });
  });

  const sorted: string[] = [];
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    sorted.push(id);
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

  let maxLevel = 0;
  levels.forEach((l) => (maxLevel = Math.max(maxLevel, l)));
  unitIds.forEach((id) => {
    if (!levels.has(id)) {
      levels.set(id, maxLevel + 1);
      sorted.push(id);
    }
  });

  return { sorted, levels };
}

export function detectChronologyInversions(
  units: UnitChronology[],
  relations: StratigraphicRelation[]
): ChronologyInversion[] {
  const inversions: ChronologyInversion[] = [];
  const unitMap = new Map(units.map((u) => [u.unitId, u]));

  const earlierPairs = new Set<string>();

  relations.forEach((r) => {
    let earlierId: string | undefined;
    let laterId: string | undefined;
    if (r.type === '叠压' || r.type === '打破') {
      laterId = r.fromUnitId;
      earlierId = r.toUnitId;
    } else if (r.type === '被打破') {
      earlierId = r.fromUnitId;
      laterId = r.toUnitId;
    }
    if (earlierId && laterId && earlierId !== laterId) {
      earlierPairs.add(`${earlierId}|${laterId}`);
    }
  });

  earlierPairs.forEach((pair) => {
    const [earlierId, laterId] = pair.split('|');
    const earlier = unitMap.get(earlierId);
    const later = unitMap.get(laterId);
    if (!earlier || !later) return;

    const overlap =
      Math.min(earlier.combinedConfidence95.upperBP, later.combinedConfidence95.upperBP) -
      Math.max(earlier.combinedConfidence95.lowerBP, later.combinedConfidence95.lowerBP);

    if (later.weightedMeanBP > earlier.weightedMeanBP) {
      inversions.push({
        earlierUnitId: earlierId,
        earlierUnitCode: earlier.unitCode,
        earlierMeanBP: earlier.weightedMeanBP,
        earlier95Lower: earlier.combinedConfidence95.lowerBP,
        earlier95Upper: earlier.combinedConfidence95.upperBP,
        laterUnitId: laterId,
        laterUnitCode: later.unitCode,
        laterMeanBP: later.weightedMeanBP,
        later95Lower: later.combinedConfidence95.lowerBP,
        later95Upper: later.combinedConfidence95.upperBP,
        overlapYears: Math.max(0, overlap),
        gapYears: overlap < 0 ? -overlap : 0,
      });
    }
  });

  return inversions;
}

export function buildChronologyModel(
  trenchId: string,
  units: StratigraphicUnit[],
  samples: Sample[],
  relations: StratigraphicRelation[],
  curve: CalibrationCurve = DEFAULT_CALIBRATION_CURVE
): ChronologyModel {
  const trenchUnits = units.filter((u) => u.trenchId === trenchId);
  const trenchSamples = samples.filter((s) => s.trenchId === trenchId);
  const trenchRelations = relations.filter((r) => r.trenchId === trenchId);

  const trenchUnitIds = trenchUnits.map((u) => u.id);
  const { sorted, levels } = topologicalSortHarris(trenchUnitIds, trenchRelations);

  const unitChronologies: UnitChronology[] = [];
  trenchUnits.forEach((unit) => {
    const chron = buildUnitChronology(
      unit,
      trenchSamples,
      curve,
      levels.get(unit.id) || 0
    );
    if (chron) unitChronologies.push(chron);
  });

  const inversions = detectChronologyInversions(unitChronologies, trenchRelations);
  const anomalyUnitIds = new Set<string>();
  inversions.forEach((inv) => {
    anomalyUnitIds.add(inv.earlierUnitId);
    anomalyUnitIds.add(inv.laterUnitId);
  });

  unitChronologies.forEach((u) => {
    u.isAnomaly = anomalyUnitIds.has(u.unitId);
  });

  const chronologyUnitIds = new Set(unitChronologies.map((u) => u.unitId));
  const filteredSorted = sorted.filter((id) => chronologyUnitIds.has(id));

  return {
    trenchId,
    generatedAt: Date.now(),
    calibrationCurveId: curve.id,
    units: unitChronologies,
    sortedUnitIds: filteredSorted,
    inversions,
  };
}

export function exportChronologyJSON(model: ChronologyModel): string {
  const exportObj = {
    metadata: {
      trenchId: model.trenchId,
      generatedAt: new Date(model.generatedAt).toISOString(),
      calibrationCurveId: model.calibrationCurveId,
    },
    units: model.units.map((u) => ({
      unitId: u.unitId,
      unitCode: u.unitCode,
      unitName: u.unitName,
      sampleCount: u.sampleCount,
      harrisLevel: u.harrisLevel,
      isAnomaly: u.isAnomaly,
      weightedMean: {
        calBP: Math.round(u.weightedMeanBP),
        calendar: u.weightedMeanCal,
        error: Math.round(u.weightedError),
      },
      confidence68: {
        lowerCalBP: u.combinedConfidence68.lowerBP,
        upperCalBP: u.combinedConfidence68.upperBP,
        lowerCalendar: u.combinedConfidence68.lowerCal,
        upperCalendar: u.combinedConfidence68.upperCal,
      },
      confidence95: {
        lowerCalBP: u.combinedConfidence95.lowerBP,
        upperCalBP: u.combinedConfidence95.upperBP,
        lowerCalendar: u.combinedConfidence95.lowerCal,
        upperCalendar: u.combinedConfidence95.upperCal,
      },
      samples: u.sampleDetails.map((d) => ({
        sampleId: d.sampleId,
        sampleNumber: d.sampleNumber,
        rawBP: d.rawBP,
        rawError: d.rawError,
        calibratedBP: Math.round(d.calibrated.pointEstimateBP),
        calibratedCalendar: d.calibrated.pointEstimateCal,
        weight: d.weight,
      })),
    })),
    sortedUnitIds: model.sortedUnitIds,
    inversions: model.inversions.map((inv) => ({
      earlierUnit: {
        id: inv.earlierUnitId,
        code: inv.earlierUnitCode,
        meanCalBP: Math.round(inv.earlierMeanBP),
        range95CalBP: [inv.earlier95Lower, inv.earlier95Upper],
      },
      laterUnit: {
        id: inv.laterUnitId,
        code: inv.laterUnitCode,
        meanCalBP: Math.round(inv.laterMeanBP),
        range95CalBP: [inv.later95Lower, inv.later95Upper],
      },
      overlapYears: Math.round(inv.overlapYears),
      gapYears: Math.round(inv.gapYears),
      severity: inv.gapYears > 200 ? '严重' : inv.gapYears > 0 ? '警告' : '轻微',
    })),
  };
  return JSON.stringify(exportObj, null, 2);
}
