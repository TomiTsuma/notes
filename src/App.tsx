import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './App.css';
import Sidebar from './components/Layout/Sidebar';
import DocumentHeader from './components/Layout/DocumentHeader';
import Toolbar from './components/Layout/Toolbar';
import FloatingToolbar from './components/Layout/FloatingToolbar';
import DocumentViewer from './components/Canvas/DocumentViewer';
import RightPanel from './components/Layout/RightPanel';
import { useAppStore } from './store/appStore';

function App() {
  const { activeTool, addTextElement, activeDocumentId, showRightPanel } = useAppStore();
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
    if ((activeTool === 'text' || activeTool === 'sticky') && activeDocumentId) {
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

  return (
    <div className={`app-container ${showSidebar ? 'has-sidebar' : 'no-sidebar'}`}>
      {showSidebar && <Sidebar />}

      <div className="main-content">
        <DocumentHeader
          showSidebar={showSidebar}
          onToggleSidebar={() => setShowSidebar(prev => !prev)}
          showToolbar={showToolbar}
          onToggleToolbar={() => setShowToolbar(prev => !prev)}
        />

        {showToolbar && (
          <div className="top-toolbar">
            <Toolbar />
          </div>
        )}

        <div
          className="canvas-container"
          onClick={handleContainerClick}
        >
          <DocumentViewer />
          <FloatingToolbar />
        </div>
      </div>

      {showRightPanel && <RightPanel />}

      {!showSidebar && (
        <button className="sidebar-toggle" onClick={() => setShowSidebar(true)} title="Open sidebar">
          ☰
        </button>
      )}
    </div>
  );
}

export default App;
