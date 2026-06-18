import { useAppStore } from '../store/useAppStore';
import TrenchSelector from './TrenchSelector';

type ViewType = 'grid' | 'stratigraphy' | 'units' | 'matrix' | 'artifacts' | 'samples' | 'profile';

interface HeaderProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const viewNames: Record<ViewType, string> = {
  grid: '方格网视图',
  stratigraphy: '地层记录',
  units: '地层单位',
  matrix: 'Harris矩阵',
  artifacts: '遗物登记',
  samples: '样品采集与送检',
  profile: '剖面图',
};

export default function Header({ currentView }: HeaderProps) {
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const trenches = useAppStore((state) => state.trenches);
  const selectedTrench = trenches.find((t) => t.id === selectedTrenchId);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-earth-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800">考古发掘方格网记录系统</h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">当前视图:</span>
        <span className="text-sm font-medium text-earth-700">{viewNames[currentView]}</span>
        {selectedTrench && (
          <div className="border-l border-gray-200 pl-4 ml-2">
            <TrenchSelector />
          </div>
        )}
      </div>
    </header>
  );
}
