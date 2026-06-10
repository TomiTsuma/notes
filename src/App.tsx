import { useEffect, useState } from 'react';
import './App.css';
import Sidebar from './components/Layout/Sidebar';
import DocumentHeader from './components/Layout/DocumentHeader';
import DocumentViewer from './components/Canvas/DocumentViewer';
import RightPanel from './components/Layout/RightPanel';
import { useAppStore } from './store/appStore';

// Dynamic Workspace Views
import HomeDashboard from './components/Dashboard/HomeDashboard';
import ProjectsSection from './components/Projects/ProjectsSection';
import KanbanBoard from './components/Kanban/KanbanBoard';
import CalendarView from './components/Calendar/CalendarView';
import ToolPalette from './components/UI/ToolPalette';
import ThemeToggle from './components/UI/ThemeToggle';

function App() {
  const { showRightPanel, activeView, currentBackground, theme, rotateBackground } = useAppStore();
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    const updateLayout = () => {
      const narrow = window.innerWidth <= 1000;
      setShowSidebar(!narrow);
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (activeView !== 'home') return;
    const interval = setInterval(() => rotateBackground(), 8000);
    return () => clearInterval(interval);
  }, [activeView, rotateBackground]);

  const renderActiveView = () => {
    switch (activeView) {
      case 'home':
        return <HomeDashboard />;
      case 'projects':
        return <ProjectsSection />;
      case 'kanban':
        return <KanbanBoard />;
      case 'calendar':
        return <CalendarView />;
      case 'canvas':
      default:
        return (
          <div className="canvas-container" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <DocumentViewer />
            <ToolPalette />
          </div>
        );
    }
  };

  return (
    <div className={`app-container ${showSidebar ? 'has-sidebar' : 'no-sidebar'} ${theme}`} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background layer */}
      <div className="app-backdrop" style={{ backgroundImage: `url(${currentBackground})` }} />
      <div className="app-backdrop-blur" />

      {showSidebar && <Sidebar />}

      <div className="main-content" style={{ zIndex: 2, backgroundColor: 'transparent', position: 'relative' }}>
        <DocumentHeader
          showSidebar={showSidebar}
          onToggleSidebar={() => setShowSidebar(prev => !prev)}
          showToolbar={false}
          onToggleToolbar={() => {}}
        >
          <ThemeToggle />
        </DocumentHeader>

        {renderActiveView()}
      </div>

      {showRightPanel && <RightPanel />}

      {!showSidebar && (
        <button className="sidebar-toggle glass-card btn-animate" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSidebar(true)} title="Open sidebar">
          ☰
        </button>
      )}
    </div>
  );
}

export default App;

