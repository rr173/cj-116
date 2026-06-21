import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { usePermission } from '../hooks/usePermission';
import { ControlPointType, ElevationAnomaly } from '../types';
import {
  CONTROL_POINT_TYPE_COLORS,
  CONTROL_POINT_TYPE_ICONS,
  parseControlPointImport,
  ControlPointImportRow,
  MIN_CONTOUR_INTERVAL,
  MAX_CONTOUR_INTERVAL,
  DEFAULT_CONTOUR_INTERVAL,
} from '../utils/survey';
import { formatDate } from '../utils';

type TabType = 'list' | 'import' | 'anomaly' | 'contour';

export default function ControlPointsPanel() {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const controlPoints = useAppStore((state) => state.controlPoints);
  const addControlPoint = useAppStore((state) => state.addControlPoint);
  const updateControlPoint = useAppStore((state) => state.updateControlPoint);
  const deleteControlPoint = useAppStore((state) => state.deleteControlPoint);
  const getControlPointsByTrench = useAppStore((state) => state.getControlPointsByTrench);
  const batchImportControlPoints = useAppStore((state) => state.batchImportControlPoints);
  const getElevationAnomalies = useAppStore((state) => state.getElevationAnomalies);
  const contourConfig = useAppStore((state) => state.contourConfig);
  const setContourConfig = useAppStore((state) => state.setContourConfig);
  const setSelectedCell = useAppStore((state) => state.setSelectedCell);
  const getCellById = useAppStore((state) => state.getCellById);

  const { can } = usePermission();

  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    x: '',
    y: '',
    z: '',
    type: '加密点' as ControlPointType,
    measuredBy: '',
  });
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<ControlPointImportRow[] | null>(null);
  const [importDefaultType, setImportDefaultType] = useState<ControlPointType>('加密点');
  const [importMeasuredBy, setImportMeasuredBy] = useState('');
  const [importResult, setImportResult] = useState<{ success: number; failed: ControlPointImportRow[] } | null>(null);

  const points = useMemo(
    () => (selectedTrenchId ? getControlPointsByTrench(selectedTrenchId) : []),
    [selectedTrenchId, getControlPointsByTrench, controlPoints]
  );

  const anomalies = useMemo(
    () => (selectedTrenchId ? getElevationAnomalies(selectedTrenchId) : []),
    [selectedTrenchId, getElevationAnomalies]
  );

  const pointTypeOptions: { value: ControlPointType; label: string }[] = [
    { value: '基准点', label: '基准点' },
    { value: '加密点', label: '加密点' },
    { value: '临时点', label: '临时点' },
  ];

  const handleAdd = () => {
    setEditingPoint(null);
    setFormData({
      code: '',
      x: '',
      y: '',
      z: '',
      type: '加密点',
      measuredBy: '',
    });
    setShowAddModal(true);
  };

  const handleEdit = (pointId: string) => {
    const point = points.find((p) => p.id === pointId);
    if (!point) return;
    setEditingPoint(pointId);
    setFormData({
      code: point.code,
      x: point.x.toString(),
      y: point.y.toString(),
      z: point.z.toString(),
      type: point.type,
      measuredBy: point.measuredBy,
    });
    setShowAddModal(true);
  };

  const handleDelete = (pointId: string) => {
    const point = points.find((p) => p.id === pointId);
    if (!point) return;
    if (!confirm(`确定要删除控制点 "${point.code}" 吗？`)) return;
    try {
      deleteControlPoint(pointId);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSubmit = () => {
    if (!selectedTrenchId) return;

    const x = parseFloat(formData.x);
    const y = parseFloat(formData.y);
    const z = parseFloat(formData.z);

    if (!formData.code.trim()) {
      alert('请输入控制点编号');
      return;
    }
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      alert('请输入有效的坐标值');
      return;
    }

    try {
      if (editingPoint) {
        updateControlPoint(editingPoint, {
          code: formData.code.trim(),
          x: Math.round(x * 1000) / 1000,
          y: Math.round(y * 1000) / 1000,
          z: Math.round(z * 1000) / 1000,
          type: formData.type,
          measuredBy: formData.measuredBy.trim(),
        });
      } else {
        const result = addControlPoint({
          trenchId: selectedTrenchId,
          code: formData.code.trim(),
          x: Math.round(x * 1000) / 1000,
          y: Math.round(y * 1000) / 1000,
          z: Math.round(z * 1000) / 1000,
          type: formData.type,
          measuredAt: Date.now(),
          measuredBy: formData.measuredBy.trim(),
        });
        if (!result) {
          alert('控制点编号已存在');
          return;
        }
      }
      setShowAddModal(false);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePreviewImport = () => {
    if (!importText.trim()) {
      alert('请输入要导入的数据');
      return;
    }
    const rows = parseControlPointImport(importText);
    setImportPreview(rows);
    setImportResult(null);
  };

  const handleImport = () => {
    if (!selectedTrenchId) return;
    if (!importText.trim()) {
      alert('请输入要导入的数据');
      return;
    }

    const result = batchImportControlPoints(
      selectedTrenchId,
      importText,
      importDefaultType,
      importMeasuredBy || '未知'
    );
    setImportResult(result);
    setImportPreview(null);

    if (result.success > 0) {
      setImportText('');
    }
  };

  const handleJumpToCell = (cellId: string) => {
    setSelectedCell(cellId);
  };

  const handleContourIntervalChange = (value: number) => {
    if (value >= MIN_CONTOUR_INTERVAL && value <= MAX_CONTOUR_INTERVAL) {
      setContourConfig({ interval: Math.round(value * 10) / 10 });
    }
  };

  const stats = useMemo(() => {
    return {
      total: points.length,
      benchmark: points.filter((p) => p.type === '基准点').length,
      dense: points.filter((p) => p.type === '加密点').length,
      temporary: points.filter((p) => p.type === '临时点').length,
    };
  }, [points]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">测量控制点管理</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {stats.total} 个控制点 · 基准点 {stats.benchmark} · 加密点 {stats.dense} · 临时点 {stats.temporary}
          </p>
        </div>
        {can('controlPoint:create') && (
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-earth-600 text-white text-sm font-medium rounded-lg hover:bg-earth-700 transition-colors"
          >
            + 添加控制点
          </button>
        )}
      </div>

      <div className="flex border-b border-gray-200 mb-4">
        {[
          { id: 'list', label: '控制点列表' },
          { id: 'import', label: '批量导入' },
          { id: 'anomaly', label: `标高校验 ${anomalies.length > 0 ? `(${anomalies.length})` : ''}` },
          { id: 'contour', label: '等高线设置' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-earth-600 text-earth-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {activeTab === 'list' && (
          <div className="h-full overflow-auto">
            {points.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                暂无控制点数据
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">类型</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">编号</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">X (m)</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Y (m)</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">标高Z (m)</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">测量人</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">测量时间</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {points.map((point) => (
                    <tr key={point.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: CONTROL_POINT_TYPE_COLORS[point.type] + '20',
                            color: CONTROL_POINT_TYPE_COLORS[point.type],
                          }}
                        >
                          <span>{CONTROL_POINT_TYPE_ICONS[point.type]}</span>
                          {point.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{point.code}</td>
                      <td className="px-4 py-3 text-right text-gray-600 font-mono">
                        {point.x.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 font-mono">
                        {point.y.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 font-mono">
                        {point.z.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{point.measuredBy || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(point.measuredAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {can('controlPoint:edit') && (
                          <button
                            onClick={() => handleEdit(point.id)}
                            className="text-earth-600 hover:text-earth-700 mx-1"
                          >
                            编辑
                          </button>
                        )}
                        {can('controlPoint:delete') && point.type !== '基准点' && (
                          <button
                            onClick={() => handleDelete(point.id)}
                            className="text-red-500 hover:text-red-600 mx-1"
                          >
                            删除
                          </button>
                        )}
                        {point.type === '基准点' && (
                          <span className="text-gray-400 text-xs">不可删除</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'import' && (
          <div className="p-4 h-full overflow-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  导入数据（每行格式：编号,X,Y,Z）
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setImportPreview(null);
                    setImportResult(null);
                  }}
                  placeholder="CP01,100.500,200.300,15.230&#10;CP02,105.000,205.000,14.850&#10;BM-A,0,0,100.000"
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    默认点位类型
                  </label>
                  <select
                    value={importDefaultType}
                    onChange={(e) => setImportDefaultType(e.target.value as ControlPointType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
                  >
                    {pointTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    测量人
                  </label>
                  <input
                    type="text"
                    value={importMeasuredBy}
                    onChange={(e) => setImportMeasuredBy(e.target.value)}
                    placeholder="请输入测量人姓名"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePreviewImport}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  预览校验
                </button>
                {can('controlPoint:create') && (
                  <button
                    onClick={handleImport}
                    className="px-4 py-2 bg-earth-600 text-white text-sm font-medium rounded-lg hover:bg-earth-700 transition-colors"
                  >
                    确认导入
                  </button>
                )}
              </div>

              {importResult && (
                <div className={`p-4 rounded-lg ${importResult.failed.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <p className="font-medium text-gray-800">
                    导入完成：成功 {importResult.success} 个，失败 {importResult.failed.length} 个
                  </p>
                  {importResult.failed.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-red-600">
                            <th className="py-1 pr-4">行号</th>
                            <th className="py-1 pr-4">内容</th>
                            <th className="py-1">错误原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.failed.map((row, idx) => (
                            <tr key={idx} className="text-red-500">
                              <td className="py-1 pr-4">{row.rowIndex}</td>
                              <td className="py-1 pr-4 font-mono text-xs">
                                {row.code}, {row.x}, {row.y}, {row.z}
                              </td>
                              <td className="py-1">{row.errors.join('; ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {importPreview && !importResult && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                    预览结果：共 {importPreview.length} 行，
                    有效 {importPreview.filter((r) => r.valid).length} 行，
                    无效 {importPreview.filter((r) => !r.valid).length} 行
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">行号</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">编号</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">X</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Y</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Z</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">状态</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importPreview.map((row, idx) => (
                          <tr key={idx} className={!row.valid ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2 text-gray-500">{row.rowIndex}</td>
                            <td className={`px-3 py-2 font-medium ${row.valid ? 'text-gray-800' : 'text-red-600'}`}>
                              {row.code}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono ${row.valid ? 'text-gray-600' : 'text-red-600'}`}>
                              {row.x}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono ${row.valid ? 'text-gray-600' : 'text-red-600'}`}>
                              {row.y}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono ${row.valid ? 'text-gray-600' : 'text-red-600'}`}>
                              {row.z}
                            </td>
                            <td className="px-3 py-2">
                              {row.valid ? (
                                <span className="text-green-600 text-xs">✓ 有效</span>
                              ) : (
                                <span className="text-red-500 text-xs" title={row.errors.join('; ')}>
                                  ✗ {row.errors.join('; ')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'anomaly' && (
          <div className="p-4 h-full overflow-auto">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <p className="font-medium mb-1">标高校验规则</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>顶面标高超过插值标高 +0.5m 标记为异常</li>
                <li>底面标高低于插值标高 -5m 标记为异常</li>
                <li>基于方格中心点的 IDW 插值结果进行校验</li>
              </ul>
            </div>

            {anomalies.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                ✓ 未发现标高异常的地层记录
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  共发现 <span className="font-medium text-red-600">{anomalies.length}</span> 条标高异常记录
                </p>
                <div className="space-y-2">
                  {anomalies.map((anomaly) => (
                    <div
                      key={anomaly.stratigraphyId}
                      className="p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                      onClick={() => handleJumpToCell(anomaly.cellId)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-medium rounded">
                            标高异常
                          </span>
                          <span className="font-medium text-gray-800">
                            {anomaly.cellCode} 第{anomaly.layerNumber}层
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">点击跳转到方格</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">顶面标高: </span>
                          <span className={`font-mono font-medium ${anomaly.anomalyType === 'top_high' || anomaly.anomalyType === 'both' ? 'text-red-600' : 'text-gray-700'}`}>
                            {anomaly.topElevation.toFixed(3)}m
                            {(anomaly.anomalyType === 'top_high' || anomaly.anomalyType === 'both') && (
                              <span className="text-xs ml-1">(+{anomaly.topDeviation.toFixed(3)})</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">底面标高: </span>
                          <span className={`font-mono font-medium ${anomaly.anomalyType === 'bottom_low' || anomaly.anomalyType === 'both' ? 'text-red-600' : 'text-gray-700'}`}>
                            {anomaly.bottomElevation.toFixed(3)}m
                            {(anomaly.anomalyType === 'bottom_low' || anomaly.anomalyType === 'both') && (
                              <span className="text-xs ml-1">({anomaly.bottomDeviation.toFixed(3)})</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">插值标高: </span>
                          <span className="font-mono text-gray-700">
                            {anomaly.interpolatedElevation.toFixed(3)}m
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contour' && (
          <div className="p-4 h-full overflow-auto">
            <div className="space-y-6 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  等高距: {contourConfig.interval.toFixed(1)} 米
                </label>
                <input
                  type="range"
                  min={MIN_CONTOUR_INTERVAL}
                  max={MAX_CONTOUR_INTERVAL}
                  step={0.1}
                  value={contourConfig.interval}
                  onChange={(e) => handleContourIntervalChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{MIN_CONTOUR_INTERVAL}m</span>
                  <span>{DEFAULT_CONTOUR_INTERVAL}m (默认)</span>
                  <span>{MAX_CONTOUR_INTERVAL}m</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">显示等高线标注</span>
                <button
                  onClick={() => setContourConfig({ showLabels: !contourConfig.showLabels })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    contourConfig.showLabels ? 'bg-earth-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      contourConfig.showLabels ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">地图上显示控制点</span>
                <button
                  onClick={() => {
                    const show = useAppStore.getState().showControlPointsOnMap;
                    useAppStore.getState().setShowControlPointsOnMap(!show);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useAppStore.getState().showControlPointsOnMap ? 'bg-earth-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useAppStore.getState().showControlPointsOnMap ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">图例</h4>
                <div className="space-y-2">
                  {pointTypeOptions.map((type) => (
                    <div key={type.value} className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs"
                        style={{ backgroundColor: CONTROL_POINT_TYPE_COLORS[type.value] }}
                      >
                        {CONTROL_POINT_TYPE_ICONS[type.value]}
                      </span>
                      <span className="text-sm text-gray-600">{type.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <div className="w-4 h-0.5 bg-earth-600" />
                    <span className="text-sm text-gray-600">等高线</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">说明</h4>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                  <li>等高线使用 IDW 反距离加权插值生成</li>
                  <li>采样网格间距为等高距的 1/5</li>
                  <li>使用 Marching Squares 算法提取等值线</li>
                  <li>控制点不足 3 个时无法生成等高线</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingPoint ? '编辑控制点' : '添加控制点'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    编号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="如 CP01、BM-A"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    点位类型
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as ControlPointType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
                  >
                    {pointTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    X (m) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.x}
                    onChange={(e) => setFormData({ ...formData, x: e.target.value })}
                    placeholder="0.000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Y (m) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.y}
                    onChange={(e) => setFormData({ ...formData, y: e.target.value })}
                    placeholder="0.000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    标高Z (m) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.z}
                    onChange={(e) => setFormData({ ...formData, z: e.target.value })}
                    placeholder="0.000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  测量人
                </label>
                <input
                  type="text"
                  value={formData.measuredBy}
                  onChange={(e) => setFormData({ ...formData, measuredBy: e.target.value })}
                  placeholder="请输入测量人姓名"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-earth-500 focus:border-earth-500"
                />
              </div>

              {editingPoint && formData.type === '基准点' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                  ⚠️ 基准点坐标不可修改
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-earth-600 text-white text-sm font-medium rounded-lg hover:bg-earth-700 transition-colors"
              >
                {editingPoint ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
