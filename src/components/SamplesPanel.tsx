import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSampleStore } from '../store/useSampleStore';
import {
  SampleType,
  SampleStatus,
  SampleResult,
  SAMPLE_STATUS_ORDER,
} from '../types';

const SAMPLE_TYPES: SampleType[] = ['碳十四测年', '孢粉', '土壤', '浮选', '其他'];

const STATUS_COLORS: Record<SampleStatus, string> = {
  '采集': 'bg-gray-100 text-gray-700',
  '登记': 'bg-blue-100 text-blue-700',
  '送检': 'bg-yellow-100 text-yellow-700',
  '检测中': 'bg-orange-100 text-orange-700',
  '结果回填': 'bg-green-100 text-green-700',
  '归档': 'bg-purple-100 text-purple-700',
};

const RESULT_FIELDS: Record<SampleType, { label: string; key: string }[]> = {
  '碳十四测年': [
    { label: 'BP年代值', key: 'bpValue' },
    { label: '误差范围', key: 'errorRange' },
  ],
  '孢粉': [
    { label: '孢粉浓度', key: 'pollenConcentration' },
    { label: '孢粉种类数', key: 'pollenTypes' },
  ],
  '土壤': [
    { label: 'pH值', key: 'phValue' },
    { label: '有机质含量(%)', key: 'organicContent' },
  ],
  '浮选': [
    { label: '植物种子数', key: 'seedCount' },
    { label: '炭化物重量(g)', key: 'charcoalWeight' },
  ],
  '其他': [
    { label: '数值1', key: 'value1' },
    { label: '数值2', key: 'value2' },
  ],
};

type ModalMode = 'add' | 'advance' | 'batch' | 'result' | null;

export default function SamplesPanel() {
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

  const samples = useSampleStore((state) =>
    state.samples.filter((s) => s.trenchId === selectedTrenchId)
  );
  const batches = useSampleStore((state) => state.batches);
  const addSample = useSampleStore((state) => state.addSample);
  const deleteSample = useSampleStore((state) => state.deleteSample);
  const advanceStatus = useSampleStore((state) => state.advanceStatus);
  const fillResult = useSampleStore((state) => state.fillResult);
  const createBatch = useSampleStore((state) => state.createBatch);
  const getOverdueSamples = useSampleStore((state) => state.getOverdueSamples);
  const getStatisticsByUnit = useSampleStore((state) => state.getStatisticsByUnit);
  const getStatisticsByType = useSampleStore((state) => state.getStatisticsByType);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterUnit, setFilterUnit] = useState<string>('');
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const [operator, setOperator] = useState('');

  const [addForm, setAddForm] = useState({
    cellId: '',
    stratigraphyId: '',
    unitId: '',
    type: '碳十四测年' as SampleType,
    collector: '',
    collectedAt: new Date().toISOString().slice(0, 16),
  });

  const [advanceForm, setAdvanceForm] = useState({
    laboratory: '',
    expectedReturnDate: '',
  });

  const [batchForm, setBatchForm] = useState({
    laboratory: '',
    sentDate: new Date().toISOString().slice(0, 10),
    expectedReturnDate: '',
  });

  const [resultForm, setResultForm] = useState({
    description: '',
    values: {} as Record<string, number>,
  });

  const overdueSamples = getOverdueSamples();
  const overdueIds = new Set(overdueSamples.map((s) => s.id));

  const statsByUnit = selectedTrenchId ? getStatisticsByUnit(selectedTrenchId) : new Map();
  const statsByType = selectedTrenchId ? getStatisticsByType(selectedTrenchId) : new Map();

  const filteredSamples = useMemo(() => {
    let result = [...samples];
    if (filterType) result = result.filter((s) => s.type === filterType);
    if (filterStatus) result = result.filter((s) => s.status === filterStatus);
    if (filterUnit) result = result.filter((s) => s.unitId === filterUnit);
    return result.sort((a, b) => a.sampleNumber.localeCompare(b.sampleNumber));
  }, [samples, filterType, filterStatus, filterUnit]);

  const registeredSamples = useMemo(
    () => samples.filter((s) => s.status === '登记'),
    [samples]
  );

  const getCellCode = (cellId: string) =>
    cells.find((c) => c.id === cellId)?.code || '-';

  const getUnitCode = (unitId?: string) => {
    if (!unitId) return '-';
    return units.find((u) => u.id === unitId)?.code || '-';
  };

  const getUnitColor = (unitId?: string) => {
    if (!unitId) return '#9ca3af';
    return units.find((u) => u.id === unitId)?.color || '#9ca3af';
  };

  const getNextStatusLabel = (status: SampleStatus): string | null => {
    const idx = SAMPLE_STATUS_ORDER.indexOf(status);
    if (idx < 0 || idx >= SAMPLE_STATUS_ORDER.length - 1) return null;
    return SAMPLE_STATUS_ORDER[idx + 1];
  };

  const handleOpenAdd = () => {
    setAddForm({
      cellId: cells[0]?.id || '',
      stratigraphyId: '',
      unitId: '',
      type: '碳十四测年',
      collector: '',
      collectedAt: new Date().toISOString().slice(0, 16),
    });
    setModalMode('add');
  };

  const handleCellChange = (cellId: string) => {
    const cellStrats = stratigraphies.filter((s) => s.cellId === cellId);
    setAddForm({
      ...addForm,
      cellId,
      stratigraphyId: cellStrats[0]?.id || '',
      unitId: cellStrats[0]?.unitId || '',
    });
  };

  const handleStratChange = (stratId: string) => {
    const strat = stratigraphies.find((s) => s.id === stratId);
    setAddForm({
      ...addForm,
      stratigraphyId: stratId,
      unitId: strat?.unitId || '',
    });
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrenchId || !addForm.collector) return;
    addSample({
      ...addForm,
      trenchId: selectedTrenchId,
      unitId: addForm.unitId || undefined,
      collectedAt: new Date(addForm.collectedAt).getTime(),
    });
    setModalMode(null);
  };

  const handleOpenAdvance = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    setAdvanceForm({ laboratory: '', expectedReturnDate: '' });
    setOperator('');
    setModalMode('advance');
  };

  const handleSubmitAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSampleId || !operator) return;
    const sample = samples.find((s) => s.id === selectedSampleId);
    if (!sample) return;
    const nextStatus = getNextStatusLabel(sample.status);
    const extra =
      nextStatus === '送检'
        ? { laboratory: advanceForm.laboratory, expectedReturnDate: advanceForm.expectedReturnDate }
        : undefined;
    advanceStatus(selectedSampleId, operator, extra);
    setModalMode(null);
    setSelectedSampleId(null);
  };

  const handleOpenBatch = () => {
    setSelectedForBatch(new Set());
    setBatchForm({
      laboratory: '',
      sentDate: new Date().toISOString().slice(0, 10),
      expectedReturnDate: '',
    });
    setModalMode('batch');
  };

  const handleToggleBatchSelect = (id: string) => {
    setSelectedForBatch((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmitBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedForBatch.size === 0 || !batchForm.laboratory || !batchForm.expectedReturnDate) return;
    const result = createBatch({
      laboratory: batchForm.laboratory,
      sampleIds: Array.from(selectedForBatch),
      sentDate: batchForm.sentDate,
      expectedReturnDate: batchForm.expectedReturnDate,
    });
    if (result) {
      setModalMode(null);
      setSelectedForBatch(new Set());
    }
  };

  const handleOpenResult = (sampleId: string) => {
    const sample = samples.find((s) => s.id === sampleId);
    if (!sample) return;
    setSelectedSampleId(sampleId);
    setResultForm({
      description: sample.result?.description || '',
      values: sample.result?.values || {},
    });
    setOperator('');
    setModalMode('result');
  };

  const handleSubmitResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSampleId || !operator) return;
    const result: SampleResult = {
      description: resultForm.description,
      values: resultForm.values,
    };
    fillResult(selectedSampleId, result, operator);
    setModalMode(null);
    setSelectedSampleId(null);
  };

  const handleResultValueChange = (key: string, value: string) => {
    setResultForm({
      ...resultForm,
      values: { ...resultForm.values, [key]: parseFloat(value) || 0 },
    });
  };

  const selectedSample = selectedSampleId
    ? samples.find((s) => s.id === selectedSampleId)
    : null;

  const resultFields = selectedSample
    ? RESULT_FIELDS[selectedSample.type]
    : RESULT_FIELDS['其他'];

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">样品采集与送检流转</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {samples.length} 个样品
            {overdueSamples.length > 0 && (
              <span className="ml-3 text-red-600 font-medium">
                {overdueSamples.length} 个超期
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
          >
            <option value="">全部类型</option>
            {SAMPLE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
          >
            <option value="">全部状态</option>
            {SAMPLE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
          >
            <option value="">全部地层单位</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} - {u.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleOpenBatch}
            disabled={registeredSamples.length === 0}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            批量送检
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            采集样品
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
        <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-700">样品列表</h3>
          </div>
          <div className="flex-1 overflow-auto">
            {filteredSamples.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                暂无样品记录
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">编号</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">类型</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">状态</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">方格</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">地层单位</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">采集人</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">实验室</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSamples.map((sample) => (
                    <tr
                      key={sample.id}
                      className={`hover:bg-gray-50 ${overdueIds.has(sample.id) ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {sample.sampleNumber}
                        {overdueIds.has(sample.id) && (
                          <span className="ml-1 text-xs text-red-600">超期</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{sample.type}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[sample.status]}`}>
                          {sample.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {getCellCode(sample.cellId)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 text-xs text-white rounded-full"
                          style={{ backgroundColor: getUnitColor(sample.unitId) }}
                        >
                          {getUnitCode(sample.unitId)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{sample.collector}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {sample.laboratory || '-'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {sample.status !== '归档' && getNextStatusLabel(sample.status) && (
                          <button
                            onClick={() => handleOpenAdvance(sample.id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            {getNextStatusLabel(sample.status)}
                          </button>
                        )}
                        {(sample.status === '检测中' || sample.status === '结果回填') && (
                          <button
                            onClick={() => handleOpenResult(sample.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            回填
                          </button>
                        )}
                        {sample.status === '采集' && (
                          <button
                            onClick={() => {
                              if (confirm('确定删除该样品吗？')) deleteSample(sample.id);
                            }}
                            className="text-red-500 hover:text-red-600"
                          >
                            删除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4 overflow-auto">
          {overdueSamples.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-red-200 bg-red-50">
                <h3 className="font-medium text-red-700">超期预警</h3>
              </div>
              <div className="p-4 space-y-2">
                {overdueSamples.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-800 font-medium">{s.sampleNumber}</span>
                    <span className="text-red-600 text-xs">
                      应于 {s.expectedReturnDate} 返回
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-700">按地层单位统计</h3>
            </div>
            <div className="p-4 space-y-3">
              {Array.from(statsByUnit.entries()).map(([unitId, data]) => {
                const unit = units.find((u) => u.id === unitId);
                return (
                  <div key={unitId}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: unit?.color || '#9ca3af' }}
                        />
                        <span className="text-gray-600">
                          {unit ? unit.code : '未分类'}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800">{data.count} 个</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {SAMPLE_STATUS_ORDER.map((status) => {
                        const count = data.statusDist.get(status) || 0;
                        return count > 0 ? (
                          <span
                            key={status}
                            className={`px-1.5 py-0.5 text-xs rounded ${STATUS_COLORS[status]}`}
                          >
                            {status}:{count}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                );
              })}
              {statsByUnit.size === 0 && (
                <p className="text-sm text-gray-400 text-center">暂无数据</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-700">按类型统计</h3>
            </div>
            <div className="p-4 space-y-2">
              {Array.from(statsByType.entries()).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{type}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{data.total} 个</span>
                    {data.total > 0 && (
                      <span className="text-xs text-gray-500">
                        (已出结果 {data.hasResult}/{data.total} ={' '}
                        {Math.round((data.hasResult / data.total) * 100)}%)
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {statsByType.size === 0 && (
                <p className="text-sm text-gray-400 text-center">暂无数据</p>
              )}
            </div>
          </div>

          {batches.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-medium text-gray-700">送检批次</h3>
              </div>
              <div className="p-4 space-y-3">
                {batches.map((batch) => {
                  const batchSamples = samples.filter((s) =>
                    batch.sampleIds.includes(s.id)
                  );
                  const allArchived = batchSamples.length > 0 &&
                    batchSamples.every((s) => s.status === '归档');
                  return (
                    <div key={batch.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-800 text-sm">
                          {batch.batchNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            allArchived
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {allArchived ? '已归档' : '进行中'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {batch.laboratory} · {batch.sentDate}
                      </div>
                      <div className="text-xs text-gray-500">
                        预计返回: {batch.expectedReturnDate} · {batch.sampleIds.length} 个样品
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {modalMode === 'add' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">采集样品</h3>
              <button
                onClick={() => setModalMode(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">样品类型</label>
                  <select
                    value={addForm.type}
                    onChange={(e) => setAddForm({ ...addForm, type: e.target.value as SampleType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    {SAMPLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">采集人</label>
                  <input
                    type="text"
                    value={addForm.collector}
                    onChange={(e) => setAddForm({ ...addForm, collector: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">采集方格</label>
                  <select
                    value={addForm.cellId}
                    onChange={(e) => handleCellChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  >
                    <option value="">请选择</option>
                    {cells.map((c) => (
                      <option key={c.id} value={c.id}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">采集层位</label>
                  <select
                    value={addForm.stratigraphyId}
                    onChange={(e) => handleStratChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  >
                    <option value="">请选择</option>
                    {stratigraphies
                      .filter((s) => s.cellId === addForm.cellId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          第{s.layerNumber}层 ({s.soilType})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">地层单位</label>
                  <select
                    value={addForm.unitId}
                    onChange={(e) => setAddForm({ ...addForm, unitId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  >
                    <option value="">未分类</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">采集时间</label>
                <input
                  type="datetime-local"
                  value={addForm.collectedAt}
                  onChange={(e) => setAddForm({ ...addForm, collectedAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors"
                >
                  采集
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMode === 'advance' && selectedSample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                状态流转: {selectedSample.sampleNumber}
              </h3>
            </div>
            <form onSubmit={handleSubmitAdvance} className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm ${STATUS_COLORS[selectedSample.status]}`}>
                  {selectedSample.status}
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className={`px-3 py-1 rounded-full text-sm ${STATUS_COLORS[getNextStatusLabel(selectedSample.status) as SampleStatus]}`}>
                  {getNextStatusLabel(selectedSample.status)}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">操作人</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  required
                />
              </div>

              {getNextStatusLabel(selectedSample.status) === '送检' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">送检实验室</label>
                    <input
                      type="text"
                      value={advanceForm.laboratory}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, laboratory: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">预计返回日期</label>
                    <input
                      type="date"
                      value={advanceForm.expectedReturnDate}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, expectedReturnDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalMode(null); setSelectedSampleId(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors"
                >
                  确认流转
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMode === 'batch' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">批量送检</h3>
              <button
                onClick={() => setModalMode(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmitBatch} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">送检实验室</label>
                  <input
                    type="text"
                    value={batchForm.laboratory}
                    onChange={(e) => setBatchForm({ ...batchForm, laboratory: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">送检日期</label>
                  <input
                    type="date"
                    value={batchForm.sentDate}
                    onChange={(e) => setBatchForm({ ...batchForm, sentDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">预计返回日期</label>
                <input
                  type="date"
                  value={batchForm.expectedReturnDate}
                  onChange={(e) => setBatchForm({ ...batchForm, expectedReturnDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择已登记样品 (已选 {selectedForBatch.size} 个)
                </label>
                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                  {registeredSamples.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">暂无已登记样品</div>
                  ) : (
                    registeredSamples.map((s) => (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0 ${
                          selectedForBatch.has(s.id) ? 'bg-earth-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedForBatch.has(s.id)}
                          onChange={() => handleToggleBatchSelect(s.id)}
                          className="rounded border-gray-300 text-earth-600 focus:ring-earth-500"
                        />
                        <span className="text-sm font-medium text-gray-800">{s.sampleNumber}</span>
                        <span className="text-sm text-gray-500">{s.type}</span>
                        <span className="text-xs text-gray-400">{getCellCode(s.cellId)}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={selectedForBatch.size === 0}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  确认送检 ({selectedForBatch.size} 个)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMode === 'result' && selectedSample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                结果回填: {selectedSample.sampleNumber}
              </h3>
              <button
                onClick={() => { setModalMode(null); setSelectedSampleId(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmitResult} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">操作人</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  required
                />
              </div>

              {resultFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={resultForm.values[field.key] ?? ''}
                    onChange={(e) => handleResultValueChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">文字描述</label>
                <textarea
                  value={resultForm.description}
                  onChange={(e) => setResultForm({ ...resultForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none"
                  rows={3}
                  placeholder="检测结果文字描述..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalMode(null); setSelectedSampleId(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  确认回填
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
