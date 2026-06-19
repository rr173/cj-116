import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Sample,
  SampleType,
  SampleStatus,
  SampleResult,
  InspectionBatch,
  StatusChangeLog,
  SAMPLE_STATUS_ORDER,
  SAMPLE_TYPE_PREFIX,
} from '../types';
import { generateId } from '../utils';

interface SampleState {
  samples: Sample[];
  batches: InspectionBatch[];

  addSample: (data: Omit<Sample, 'id' | 'sampleNumber' | 'status' | 'statusHistory' | 'createdAt'>) => Sample;
  updateSample: (id: string, data: Partial<Sample>) => void;
  deleteSample: (id: string) => void;

  advanceStatus: (id: string, operator: string, extra?: { laboratory?: string; expectedReturnDate?: string }) => boolean;
  fillResult: (id: string, result: SampleResult, operator: string) => boolean;

  createBatch: (data: { laboratory: string; sampleIds: string[]; sentDate: string; expectedReturnDate: string }) => InspectionBatch | null;

  getSamplesByTrench: (trenchId: string) => Sample[];
  getSamplesByCell: (cellId: string) => Sample[];
  getSamplesByUnit: (unitId: string) => Sample[];
  getOverdueSamples: () => Sample[];
  getStatisticsByUnit: (trenchId: string) => Map<string, { count: number; statusDist: Map<SampleStatus, number> }>;
  getStatisticsByType: (trenchId: string) => Map<SampleType, { total: number; hasResult: number }>;
  getNextSampleNumber: (type: SampleType) => string;
  getNextBatchNumber: () => string;
}

export const useSampleStore = create<SampleState>()(
  persist(
    (set, get) => ({
      samples: [],
      batches: [],

      getNextSampleNumber: (type: SampleType) => {
        const prefix = SAMPLE_TYPE_PREFIX[type];
        const existing = get().samples.filter((s) => s.type === type);
        let maxNum = 0;
        existing.forEach((s) => {
          const numPart = s.sampleNumber.replace(prefix + '-', '');
          const num = parseInt(numPart, 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        });
        return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
      },

      getNextBatchNumber: () => {
        const count = get().batches.length;
        return `BATCH-${String(count + 1).padStart(3, '0')}`;
      },

      addSample: (data) => {
        const sampleNumber = get().getNextSampleNumber(data.type);
        const now = Date.now();
        const sample: Sample = {
          ...data,
          id: generateId(),
          sampleNumber,
          status: '采集',
          statusHistory: [{
            from: '采集' as SampleStatus,
            to: '采集' as SampleStatus,
            operator: data.collector,
            timestamp: now,
          }],
          createdAt: now,
        };
        set((state) => ({
          samples: [...state.samples, sample],
        }));
        return sample;
      },

      updateSample: (id, data) => {
        const sample = get().samples.find((s) => s.id === id);
        if (!sample) return;
        if (sample.status === '检测中') {
          const allowedKeys = ['status', 'statusHistory', 'result', 'laboratory', 'expectedReturnDate', 'batchId'];
          const filtered: Partial<Sample> = {};
          for (const key of allowedKeys as (keyof Sample)[]) {
            if (key in data) {
              (filtered as any)[key] = (data as any)[key];
            }
          }
          set((state) => ({
            samples: state.samples.map((s) =>
              s.id === id ? { ...s, ...filtered } : s
            ),
          }));
        } else {
          set((state) => ({
            samples: state.samples.map((s) =>
              s.id === id ? { ...s, ...data } : s
            ),
          }));
        }
      },

      deleteSample: (id) => {
        set((state) => ({
          samples: state.samples.filter((s) => s.id !== id),
          batches: state.batches.map((b) => ({
            ...b,
            sampleIds: b.sampleIds.filter((sid) => sid !== id),
          })),
        }));
      },

      advanceStatus: (id, operator, extra) => {
        const sample = get().samples.find((s) => s.id === id);
        if (!sample) return false;

        const currentIndex = SAMPLE_STATUS_ORDER.indexOf(sample.status);
        if (currentIndex >= SAMPLE_STATUS_ORDER.length - 1) return false;

        const nextStatus = SAMPLE_STATUS_ORDER[currentIndex + 1];

        if (nextStatus === '送检') {
          if (!extra?.laboratory || !extra.laboratory.trim()) return false;
          if (!extra?.expectedReturnDate || !extra.expectedReturnDate.trim()) return false;
        }

        const log: StatusChangeLog = {
          from: sample.status,
          to: nextStatus,
          operator,
          timestamp: Date.now(),
        };

        const updates: Partial<Sample> = {
          status: nextStatus,
          statusHistory: [...sample.statusHistory, log],
        };

        if (nextStatus === '送检') {
          updates.laboratory = extra!.laboratory!.trim();
          updates.expectedReturnDate = extra!.expectedReturnDate!.trim();
        }

        set((state) => ({
          samples: state.samples.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
        return true;
      },

      fillResult: (id, result, operator) => {
        const sample = get().samples.find((s) => s.id === id);
        if (!sample) return false;
        if (sample.status !== '检测中' && sample.status !== '结果回填') return false;

        const log: StatusChangeLog = {
          from: sample.status,
          to: '结果回填' as SampleStatus,
          operator,
          timestamp: Date.now(),
        };

        set((state) => ({
          samples: state.samples.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: '结果回填' as SampleStatus,
                  result,
                  statusHistory: [...s.statusHistory, log],
                }
              : s
          ),
        }));
        return true;
      },

      createBatch: (data) => {
        const { laboratory, sampleIds, sentDate, expectedReturnDate } = data;

        if (!laboratory.trim()) return null;
        if (!expectedReturnDate.trim()) return null;
        if (sampleIds.length === 0) return null;

        for (const sid of sampleIds) {
          const sample = get().samples.find((s) => s.id === sid);
          if (!sample) return null;
          if (sample.status !== '登记') return null;
        }

        const openBatches = get().batches.filter((b) => {
          return b.sampleIds.some((sid) => {
            const s = get().samples.find((ss) => ss.id === sid);
            return s && s.status !== '归档';
          });
        });

        for (const sid of sampleIds) {
          for (const batch of openBatches) {
            if (batch.sampleIds.includes(sid)) return null;
          }
        }

        const batchNumber = get().getNextBatchNumber();
        const batch: InspectionBatch = {
          id: generateId(),
          batchNumber,
          laboratory,
          sampleIds,
          sentDate,
          expectedReturnDate,
          createdAt: Date.now(),
        };

        const updatedSamples = get().samples.map((s) => {
          if (!sampleIds.includes(s.id)) return s;
          const log: StatusChangeLog = {
            from: s.status,
            to: '送检' as SampleStatus,
            operator: '批量送检',
            timestamp: Date.now(),
          };
          return {
            ...s,
            status: '送检' as SampleStatus,
            laboratory,
            expectedReturnDate,
            batchId: batch.id,
            statusHistory: [...s.statusHistory, log],
          };
        });

        set((state) => ({
          batches: [...state.batches, batch],
          samples: updatedSamples,
        }));
        return batch;
      },

      getSamplesByTrench: (trenchId) => {
        return get().samples.filter((s) => s.trenchId === trenchId);
      },

      getSamplesByCell: (cellId) => {
        return get().samples.filter((s) => s.cellId === cellId);
      },

      getSamplesByUnit: (unitId) => {
        return get().samples.filter((s) => s.unitId === unitId);
      },

      getOverdueSamples: () => {
        const now = new Date();
        return get().samples.filter((s) => {
          if (s.status !== '检测中') return false;
          if (!s.expectedReturnDate) return false;
          return new Date(s.expectedReturnDate) < now;
        });
      },

      getStatisticsByUnit: (trenchId) => {
        const trenchSamples = get().samples.filter((s) => s.trenchId === trenchId);
        const stats = new Map<string, { count: number; statusDist: Map<SampleStatus, number> }>();
        trenchSamples.forEach((s) => {
          const key = s.unitId || '未分类';
          if (!stats.has(key)) {
            const dist = new Map<SampleStatus, number>();
            SAMPLE_STATUS_ORDER.forEach((st) => dist.set(st, 0));
            stats.set(key, { count: 0, statusDist: dist });
          }
          const entry = stats.get(key)!;
          entry.count++;
          entry.statusDist.set(s.status, (entry.statusDist.get(s.status) || 0) + 1);
        });
        return stats;
      },

      getStatisticsByType: (trenchId) => {
        const trenchSamples = get().samples.filter((s) => s.trenchId === trenchId);
        const stats = new Map<SampleType, { total: number; hasResult: number }>();
        trenchSamples.forEach((s) => {
          if (!stats.has(s.type)) {
            stats.set(s.type, { total: 0, hasResult: 0 });
          }
          const entry = stats.get(s.type)!;
          entry.total++;
          if (s.result) entry.hasResult++;
        });
        return stats;
      },
    }),
    {
      name: 'archaeology-sample-storage',
    }
  )
);
