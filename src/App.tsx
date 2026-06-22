import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import GridView from './components/GridView';
import StratigraphyPanel from './components/StratigraphyPanel';
import UnitsPanel from './components/UnitsPanel';
import HarrisMatrixView from './components/HarrisMatrixView';
import ArtifactsPanel from './components/ArtifactsPanel';
import ProfileView from './components/ProfileView';
import ProfileVectorEditor from './components/ProfileVectorEditor';
import WelcomeScreen from './components/WelcomeScreen';
import SamplesPanel from './components/SamplesPanel';
import PersonnelPanel from './components/PersonnelPanel';
import ExcavationLogsPanel from './components/ExcavationLogsPanel';
import WorkHoursPanel from './components/WorkHoursPanel';
import TimelinePanel from './components/TimelinePanel';
import LoginPage from './components/LoginPage';
import UserManagementPanel from './components/UserManagementPanel';
import OperationLogsPanel from './components/OperationLogsPanel';
import FeatureDrawingPanel from './components/FeatureDrawingPanel';
import ControlPointsPanel from './components/ControlPointsPanel';
import SnapshotPanel from './components/SnapshotPanel';
import SpatialAnalysisPanel from './components/SpatialAnalysisPanel';
import ChronologyPanel from './components/ChronologyPanel';
import { useAppStore } from './store/useAppStore';
import { useAuthStore } from './store/useAuthStore';
import { ViewType } from './types';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('grid');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const selectedTrenchId = useAppStore((state) => state.selectedTrenchId);
  const selectedCellId = useAppStore((state) => state.selectedCellId);
  const trenches = useAppStore((state) => state.trenches);

  const checkSession = useAuthStore((state) => state.checkSession);
  const updateLastActive = useAuthStore((state) => state.updateLastActive);
  const initDefaultAdmin = useAuthStore((state) => state.initDefaultAdmin);

  useEffect(() => {
    const init = async () => {
      await initDefaultAdmin();
      const valid = checkSession();
      setIsAuthenticated(valid);
      setIsLoading(false);
    };
    init();
  }, [checkSession, initDefaultAdmin]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleActivity = () => {
      updateLastActive();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'click'];
    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, updateLastActive]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-earth-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

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
      case 'profileEditor':
        return <ProfileVectorEditor />;
      case 'personnel':
        return <PersonnelPanel />;
      case 'logs':
        return <ExcavationLogsPanel />;
      case 'workhours':
        return <WorkHoursPanel />;
      case 'timeline':
        return <TimelinePanel />;
      case 'users':
        return <UserManagementPanel />;
      case 'operationLogs':
        return <OperationLogsPanel />;
      case 'features':
        return <FeatureDrawingPanel />;
      case 'controlPoints':
        return <ControlPointsPanel />;
      case 'snapshots':
        return <SnapshotPanel />;
      case 'spatialAnalysis':
        return <SpatialAnalysisPanel />;
      case 'chronology':
        return <ChronologyPanel />;
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
