import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './App.css';
import Sidebar from './components/Layout/Sidebar';
import DocumentHeader from './components/Layout/DocumentHeader';
import Toolbar from './components/Layout/Toolbar';
import DocumentViewer from './components/Canvas/DocumentViewer';
import RightPanel from './components/Layout/RightPanel';
import { useAppStore } from './store/appStore';

// Dynamic Workspace Views
import HomeDashboard from './components/Dashboard/HomeDashboard';
import ProjectsSection from './components/Projects/ProjectsSection';
import KanbanBoard from './components/Kanban/KanbanBoard';
import CalendarView from './components/Calendar/CalendarView';
import ToolPalette from './components/UI/ToolPalette';

function App() {
  const { activeTool, addTextElement, activeDocumentId, showRightPanel, activeView, currentBackground } = useAppStore();
  const [showSidebar, setShowSidebar] = useState(true);
  const [showToolbar, setShowToolbar] = useState(true);

  useEffect(() => {
    const updateLayout = () => {
      const narrow = window.innerWidth <= 1000;
      setShowSidebar(!narrow);
      setShowToolbar(!narrow);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((activeTool === 'text' || activeTool === 'sticky') && activeDocumentId && activeView === 'canvas') {
      const rect = e.currentTarget.getBoundingClientRect();
      addTextElement(activeDocumentId, {
        id: uuidv4(),
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        text: '',
        type: activeTool === 'sticky' ? 'sticky' : 'text'
      });
    }
  };

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
          <div
            className="canvas-container"
            onClick={handleContainerClick}
            style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
          >
            <DocumentViewer />
            <ToolPalette />
          </div>
        );
    }
  };

  return (
    <div className={`app-container ${showSidebar ? 'has-sidebar' : 'no-sidebar'}`} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background layer */}
      <div className="app-backdrop" style={{ backgroundImage: `url(${currentBackground})` }} />
      <div className="app-backdrop-blur" />

      {showSidebar && <Sidebar />}

      <div className="main-content" style={{ zIndex: 1, backgroundColor: 'transparent' }}>
        <DocumentHeader
          showSidebar={showSidebar}
          onToggleSidebar={() => setShowSidebar(prev => !prev)}
          showToolbar={showToolbar}
          onToggleToolbar={() => setShowToolbar(prev => !prev)}
        />

        {showToolbar && activeView === 'canvas' && (
          <div className="top-toolbar">
            <Toolbar />
          </div>
        )}

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

