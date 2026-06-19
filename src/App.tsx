import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import GridView from './components/GridView';
import StratigraphyPanel from './components/StratigraphyPanel';
import UnitsPanel from './components/UnitsPanel';
import HarrisMatrixView from './components/HarrisMatrixView';
import ArtifactsPanel from './components/ArtifactsPanel';
import ProfileView from './components/ProfileView';
import WelcomeScreen from './components/WelcomeScreen';
import SamplesPanel from './components/SamplesPanel';
import PersonnelPanel from './components/PersonnelPanel';
import ExcavationLogsPanel from './components/ExcavationLogsPanel';
import WorkHoursPanel from './components/WorkHoursPanel';
import TimelinePanel from './components/TimelinePanel';
import { useAppStore } from './store/useAppStore';

type ViewType = 'grid' | 'stratigraphy' | 'units' | 'matrix' | 'artifacts' | 'samples' | 'profile' | 'personnel' | 'logs' | 'workhours' | 'timeline';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('grid');
  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const selectedCellId = useAppStore((state) => state.selectedCellId);
  const trenches = useAppStore((state) => state.trenches);

  const hasTrenches = trenches.length > 0;

  if (!hasTrenches) {
    return <WelcomeScreen />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'grid':
        return <GridView />;
      case 'stratigraphy':
        return selectedCellId ? <StratigraphyPanel /> : <GridView />;
      case 'units':
        return <UnitsPanel />;
      case 'matrix':
        return <HarrisMatrixView />;
      case 'artifacts':
        return <ArtifactsPanel />;
      case 'samples':
        return <SamplesPanel />;
      case 'profile':
        return <ProfileView />;
      case 'personnel':
        return <PersonnelPanel />;
      case 'logs':
        return <ExcavationLogsPanel />;
      case 'workhours':
        return <WorkHoursPanel />;
      case 'timeline':
        return <TimelinePanel />;
      default:
        return <GridView />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        <main className="flex-1 overflow-auto p-4">{renderContent()}</main>
      </div>
    </div>
  );
}

export default App;
