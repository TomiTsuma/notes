import { useEffect, useState, useRef } from 'react';
import './App.css';
import Sidebar from './components/Layout/Sidebar';
import DocumentHeader from './components/Layout/DocumentHeader';
import DocumentViewer from './components/Canvas/DocumentViewer';
import RightPanel from './components/Layout/RightPanel';
import { useAppStore } from './store/appStore';
import { useStoreSync } from './hooks/useStoreSync';

// Dynamic Workspace Views
import HomeDashboard from './components/Dashboard/HomeDashboard';
import ProjectsSection from './components/Projects/ProjectsSection';
import KanbanBoard from './components/Kanban/KanbanBoard';
import CalendarView from './components/Calendar/CalendarView';
import ToolPalette from './components/UI/ToolPalette';
import ThemeToggle from './components/UI/ThemeToggle';

function App() {
  const { showRightPanel, activeView, currentBackground, theme, rotateBackground } = useAppStore();
  const { loading, error } = useStoreSync();
  const [showSidebar, setShowSidebar] = useState(true);
  const [bgFading, setBgFading] = useState(false);

  // View transition state — fade-out current, swap, fade-in next
  const [displayView, setDisplayView] = useState(activeView);
  const [viewPhase, setViewPhase] = useState<'enter' | 'exit'>('enter');
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (activeView === displayView) return;
    if (transitionRef.current) clearTimeout(transitionRef.current);
    setViewPhase('exit');
    transitionRef.current = setTimeout(() => {
      setDisplayView(activeView);
      setViewPhase('enter');
    }, 180);
    return () => { if (transitionRef.current) clearTimeout(transitionRef.current); };
  }, [activeView]);

  // Rotate wallpaper every 10s on dashboard with a proper fade transition
  useEffect(() => {
    if (activeView !== 'home') return;
    const interval = setInterval(() => {
      setBgFading(true); // fade out
      setTimeout(() => {
        rotateBackground(); // swap image while invisible
        setTimeout(() => setBgFading(false), 60); // fade back in
      }, 600); // matches the CSS opacity transition duration
    }, 10000);
    return () => clearInterval(interval);
  }, [activeView, rotateBackground]);

  const renderView = (view: typeof activeView) => {
    switch (view) {
      case 'home':     return <HomeDashboard />;
      case 'projects': return <ProjectsSection />;
      case 'kanban':   return <KanbanBoard />;
      case 'calendar': return <CalendarView />;
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
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', fontFamily: 'Nunito', color: 'white', fontWeight: 700,
        }}>
          Loading workspace…
        </div>
      )}
      {error && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998, padding: '8px 16px',
          background: '#ff3b30', color: 'white', fontFamily: 'Nunito', fontSize: 13, textAlign: 'center',
        }}>
          Sync error: {error}
        </div>
      )}
      {/* Background layer */}
      <div className={`app-backdrop ${bgFading ? 'fading' : ''}`} style={{ backgroundImage: `url(${currentBackground})` }} />
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

        <div className={`view-wrapper view-${viewPhase}`}>
          {renderView(displayView)}
        </div>
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

