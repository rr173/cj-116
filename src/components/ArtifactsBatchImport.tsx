import { useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ValidatedImportRow, parseImportData, validateImportRows } from '../utils';

const EXAMPLE_DATA = `出土方格编号,出土层号,类型,材质,尺寸描述,照片编号,平面X,平面Y,标高Z
T0101N1E1,1,陶片,泥质陶,5×3×2cm,PH001,0.50,0.50,1.20
T0101N1E2,2,石器,石器,8×4×3cm,PH002,1.50,0.50,0.80
`;

interface Props {
  onClose: () => void;
}

export default function ArtifactsBatchImport({ onClose }: Props) {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const cells = useAppStore((state) =>
    state.cells.filter((c) => c.trenchId === selectedTrenchId)
  );
  const stratigraphies = useAppStore((state) =>
    state.stratigraphies.filter((s) => s.trenchId === selectedTrenchId)
  );
  const artifacts = useAppStore((state) =>
    state.artifacts.filter((a) => a.trenchId === selectedTrenchId)
  );
  const addArtifact = useAppStore((state) => state.addArtifact);

  const [inputText, setInputText] = useState('');
  const [validatedRows, setValidatedRows] = useState<ValidatedImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'done'>('input');
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setInputText(text);
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    setParseError(null);
    const result = parseImportData(inputText);
    if (result.error) {
      setParseError(result.error);
      return;
    }
    if (result.rows.length === 0) {
      setParseError('没有解析到有效数据行');
      return;
    }
    const validated = validateImportRows(result.rows, cells, stratigraphies);
    setValidatedRows(validated);
    setStep('preview');
  };

  const handleImport = () => {
    let count = 0;
    let nextNum = artifacts.length + 1;
    validatedRows.forEach((row) => {
      if (!row.valid) return;
      addArtifact({
        trenchId: selectedTrenchId!,
        cellId: row.cellId!,
        stratigraphyId: row.stratigraphyId,
        unitId: row.unitId,
        catalogNumber: `WP${nextNum}`,
        type: row.type.trim(),
        material: row.material.trim(),
        description: '',
        dimensions: row.dimensions.trim(),
        photoNumber: row.photoNumber.trim(),
        x: row.xNum!,
        y: row.yNum!,
        z: row.zNum!,
      });
      nextNum++;
      count++;
    });
    setImportedCount(count);
    setStep('done');
  };

  const successCount = validatedRows.filter(r => r.valid).length;
  const failCount = validatedRows.filter(r => !r.valid).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">批量导入遗物</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {step === 'input' && (
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              上传CSV/Excel文件，或直接粘贴表格数据（支持从Excel复制粘贴）。
            </p>
            <p className="text-xs text-gray-500">
              必需列：出土方格编号、出土层号、类型、材质、尺寸描述、照片编号、平面X、平面Y、标高Z
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              上传文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => setInputText(EXAMPLE_DATA)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              填入示例
            </button>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="粘贴表格数据..."
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-earth-500 focus:border-earth-500 outline-none font-mono text-sm"
          />
          {parseError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {parseError}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleParse}
              disabled={!inputText.trim()}
              className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              解析预览
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="p-6 space-y-4 overflow-y-auto flex-1 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">共 {validatedRows.length} 条记录</span>
              <span className="text-green-600">成功 {successCount} 条</span>
              <span className="text-red-600">失败 {failCount} 条</span>
            </div>
            <button
              onClick={() => setStep('input')}
              className="text-earth-600 hover:text-earth-700 text-sm"
            >
              ← 返回修改
            </button>
          </div>
          <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">行号</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">方格编号</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">层号</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">类型</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">材质</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">坐标</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {validatedRows.map((row, idx) => (
                  <tr key={idx} className={row.valid ? '' : 'bg-red-50'}>
                    <td className="px-3 py-2 text-gray-500">{row.rowIndex}</td>
                    <td className="px-3 py-2">{row.cellCode || '-'}</td>
                    <td className="px-3 py-2">{row.layerNumber || '-'}</td>
                    <td className="px-3 py-2">{row.type}</td>
                    <td className="px-3 py-2">{row.material}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      ({row.x}, {row.y}, {row.z})
                    </td>
                    <td className="px-3 py-2">
                      {row.valid ? (
                        <span className="text-green-600">✓ 有效</span>
                      ) : (
                        <div className="text-red-600">
                          <div>✗ 无效</div>
                          <ul className="text-xs mt-1 space-y-0.5">
                            {row.errors.map((err, i) => (
                              <li key={i}>· {err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={successCount === 0}
              className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              导入 {successCount} 条有效记录
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="p-6 space-y-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800">导入完成</h3>
          <p className="text-gray-600">
            成功导入 <span className="text-green-600 font-semibold">{importedCount}</span> 件遗物
            {failCount > 0 && (
              <>，失败 <span className="text-red-600 font-semibold">{failCount}</span> 件</>
            )}
          </p>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setInputText('');
                setValidatedRows([]);
                setStep('input');
                setImportedCount(0);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              继续导入
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors"
            >
              完成
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
