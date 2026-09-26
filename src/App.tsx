import { useEffect, useState, useRef } from 'react';
import './App.css';
import { Window, Sidebar, TopBar } from './components/UI/clio';
import type { TreeNode } from './components/UI/clio';
import RightPanel from './components/Layout/RightPanel';
import { useAppStore } from './store/appStore';
import { useStoreSync } from './hooks/useStoreSync';
import { uploadFileToNextcloud } from './services/nextcloud';

// Dynamic Workspace Views
import HomeDashboard from './components/Dashboard/HomeDashboard';
import ProjectsSection from './components/Projects/ProjectsSection';
import KanbanBoard from './components/Kanban/KanbanBoard';
import CalendarView from './components/Calendar/CalendarView';
import NextcloudLibrary from './components/Nextcloud/NextcloudLibrary';
import DocumentViewer from './components/Canvas/DocumentViewer';
import ToolPalette from './components/UI/ToolPalette';

function App() {
  const {
    showRightPanel,
    toggleRightPanel,
    activeView,
    setActiveView,
    currentBackground,
    theme,
    toggleTheme,
    rotateBackground,
    folders,
    files,
    activeDocumentId,
    projects,
    tags,
    nextcloudConnected,
    nextcloudStatus,
    addFolder,
    addFile,
    nextcloudSyncPath,
    updateFile,
  } = useAppStore();

  const { loading, error } = useStoreSync();
  const [showSidebar, setShowSidebar] = useState(true);
  const [bgFading, setBgFading] = useState(false);

  const [displayView, setDisplayView] = useState(activeView);
  const [viewPhase, setViewPhase] = useState<'enter' | 'exit' | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Keep sidebar visible by default on launch
  useEffect(() => {
    setShowSidebar(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.setAttribute('data-theme', theme);
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
    return () => {
      if (transitionRef.current) clearTimeout(transitionRef.current);
    };
  }, [activeView]);

  useEffect(() => {
    if (activeView !== 'home') return;
    const interval = setInterval(() => {
      setBgFading(true);
      setTimeout(() => {
        rotateBackground();
        setTimeout(() => setBgFading(false), 60);
      }, 600);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeView, rotateBackground]);

  const buildFolderTree = (parentId: string | null): TreeNode[] => {
    const subFolders: TreeNode[] = folders
      .filter((f) => f.parentId === parentId)
      .map((f) => ({
        id: f.id,
        type: 'folder',
        name: f.name,
        children: buildFolderTree(f.id),
      }));
    const subFiles: TreeNode[] = files
      .filter((f) => f.folderId === parentId)
      .map((f) => ({
        id: f.id,
        type: f.type === 'pdf' ? 'pdf' : f.type === 'notebook' ? 'notebook' : f.type === 'sticky' ? 'sticky' : 'markdown',
        name: f.name,
      }));
    return [...subFolders, ...subFiles];
  };

  const fileTree = buildFolderTree(null);

  const activeDoc = files.find((f) => f.id === activeDocumentId);

  const getCrumbs = () => {
    switch (activeView) {
      case 'home':
        return ['Home', 'Dashboard'];
      case 'projects':
        return ['Home', 'Project Hub'];
      case 'kanban':
        return ['Home', 'Kanban Board'];
      case 'calendar':
        return ['Home', 'Calendar'];
      case 'nextcloud':
        return ['Library', 'Papers'];
      case 'canvas':
      default:
        return ['Papers', activeDoc ? activeDoc.name : 'Note Canvas'];
    }
  };

  const renderView = (view: typeof activeView) => {
    switch (view) {
      case 'home':
        return <HomeDashboard />;
      case 'projects':
        return <ProjectsSection />;
      case 'kanban':
        return <KanbanBoard />;
      case 'calendar':
        return <CalendarView />;
      case 'nextcloud':
        return <NextcloudLibrary />;
      case 'canvas':
      default:
        return (
          <div className="canvas-container" style={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%' }}>
            <DocumentViewer />
            <ToolPalette />
          </div>
        );
    }
  };

  const handleNewFolder = () => {
    const name = prompt('Folder name:');
    if (name) addFolder({ id: 'folder-' + Date.now(), name, parentId: null });
  };

  const handleUploadFile = () => pdfInputRef.current?.click();

  const handlePdfSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    e.target.value = '';
    picked.forEach((f, i) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const id = `file-${Date.now()}-${i}`;
        addFile({ id, name: f.name, type: 'pdf', folderId: null, dataUrl });
        if (nextcloudConnected) {
          try {
            const remotePath = await uploadFileToNextcloud(f.name, dataUrl, nextcloudSyncPath);
            updateFile(id, { remotePath });
          } catch (err) {
            console.error('Nextcloud sync failed for', f.name, err);
          }
        }
      };
      reader.readAsDataURL(f);
    });
  };

  return (
    <div className={`app-container ${showSidebar ? 'has-sidebar' : 'no-sidebar'} ${theme}`} style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
      {loading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--overlay-scrim)',
            backdropFilter: 'blur(4px)',
            fontFamily: 'var(--font-sans)',
            color: 'var(--ink)',
            fontWeight: 700,
          }}
        >
          Loading workspace…
        </div>
      )}
      {error && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9998,
            padding: '8px 16px',
            background: 'var(--danger)',
            color: 'white',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          Sync error: {error}
        </div>
      )}

      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={handlePdfSelected}
        style={{ display: 'none' }}
      />

      {/* Backdrop wallpaper layer */}
      <div className={`app-backdrop ${bgFading ? 'fading' : ''}`} style={{ backgroundImage: `url(${currentBackground})` }} />
      <div className="app-backdrop-blur" />

      <Window style={{ width: '100%', height: '100%', borderRadius: 0, border: 0, position: 'relative', zIndex: 2 }}>
        {showSidebar && (
          <Sidebar
            activeView={activeView}
            projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
            tree={fileTree}
            tags={tags.map((t) => ({ name: t.name, color: t.color }))}
            activeFileId={activeDocumentId || undefined}
            user={{ name: 'Thomas', email: 'tommytsuma7@gmail.com' }}
            sync={nextcloudConnected ? 'connected' : nextcloudStatus === 'connecting' ? 'connecting' : 'idle'}
            onNavigate={(v) => setActiveView(v as any)}
            onToggleSidebar={() => setShowSidebar(false)}
            onNewFolder={handleNewFolder}
            onUploadFile={handleUploadFile}
          />
        )}

        <main className="cl-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: 'var(--surface)' }}>
          <TopBar
            crumbs={getCrumbs()}
            sidebarOpen={showSidebar}
            onToggleSidebar={() => setShowSidebar((prev) => !prev)}
            theme={theme}
            onToggleTheme={toggleTheme}
            panelOpen={showRightPanel}
            onTogglePanel={toggleRightPanel}
            showDownload={activeView === 'canvas'}
          />

          <div className={`view-wrapper${viewPhase ? ` view-${viewPhase}` : ''}`} style={{ flex: 1, overflow: 'auto' }}>
            {renderView(displayView)}
          </div>
        </main>

        {showRightPanel && <RightPanel />}
      </Window>
    </div>
  );
}

export default App;
