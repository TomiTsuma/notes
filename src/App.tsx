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
import NotebookViewer from './components/Canvas/NotebookViewer';
import MindMapView from './components/MindMap/MindMapView';
import ToolPalette from './components/UI/ToolPalette';
import GoogleAuthModal from './components/Auth/GoogleAuthModal';
import CommandPalette from './components/Modals/CommandPalette';
import { fetchCurrentAuthUser } from './services/firebaseAuth';

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
    setActiveDocument,
    projects,
    tags,
    nextcloudConnected,
    nextcloudStatus,
    addFolder,
    addFile,
    addNotebook,
    nextcloudSyncPath,
    updateFile,
    splitViewMode,
    authUser,
    setAuthUser,
    requestExportPdf,
  } = useAppStore();

  const { loading, error } = useStoreSync();
  const [showSidebar, setShowSidebar] = useState(true);
  const [bgFading, setBgFading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const [displayView, setDisplayView] = useState(activeView);
  const [viewPhase, setViewPhase] = useState<'enter' | 'exit' | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Keep sidebar visible by default on launch and handle Google OAuth redirect + Firebase Auth session
  useEffect(() => {
    setShowSidebar(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get('code') || params.get('google_connected')) {
      setActiveView('calendar');
    }
    fetchCurrentAuthUser().then((u) => {
      if (u) setAuthUser(u);
    });
  }, [setActiveView, setAuthUser]);

  // Global Cmd+K / Ctrl+K shortcut for Command Palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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

  const activeDoc = files.find(
    (f) => f.id === activeDocumentId || (f.type === 'notebook' && (f.notebookPageIds || []).includes(activeDocumentId || ''))
  );

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
      case 'mindmap':
        return ['Workspace', 'Mind Map'];
      case 'canvas':
      default:
        return [
          activeDoc?.type === 'notebook' ? 'Notebooks' : 'Papers',
          activeDoc ? activeDoc.name.replace(/\.notebook$/i, '') : 'Note Canvas',
        ];
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
      case 'mindmap':
        return <MindMapView />;
      case 'canvas':
      default:
        return (
          <div
            className="canvas-container"
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              height: '100%',
              display: 'flex',
              flexDirection: 'row',
            }}
          >
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%', minWidth: 0 }}>
              <DocumentViewer />
              <ToolPalette />
            </div>
            {splitViewMode !== 'none' && (
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  overflow: 'hidden',
                  height: '100%',
                  minWidth: 0,
                  borderLeft: '2px solid var(--line)',
                }}
              >
                {splitViewMode === 'mindmap' ? <MindMapView /> : <NotebookViewer />}
              </div>
            )}
          </div>
        );
    }
  };

  const handleNewNotebook = () => {
    const name = prompt('Notebook name:', 'Research Notes');
    if (name && name.trim()) {
      addNotebook(name.trim());
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
            activeFileId={activeDoc?.id || activeDocumentId || undefined}
            user={{
              name: authUser?.name || import.meta.env.VITE_USER_NAME || 'User',
              email: authUser?.email || import.meta.env.VITE_USER_EMAIL || 'user@example.com',
            }}
            sync={nextcloudConnected ? 'connected' : nextcloudStatus === 'connecting' ? 'connecting' : 'idle'}
            onNavigate={(v) => setActiveView(v as any)}
            onToggleSidebar={() => setShowSidebar(false)}
            onNewNotebook={handleNewNotebook}
            onNewFolder={handleNewFolder}
            onUploadFile={handleUploadFile}
            onSelectFile={(id) => {
              const target = files.find((f) => f.id === id);
              if (target?.type === 'notebook') {
                if (target.notebookPageIds && target.notebookPageIds.length > 0) {
                  setActiveDocument(target.notebookPageIds[0]);
                } else {
                  const pageIds = Array.from({ length: 3 }, (_, i) => `${target.id}-pg-${i + 1}`);
                  updateFile(target.id, {
                    notebookPageIds: pageIds,
                    notebookMeta: target.notebookMeta || {
                      pageWidth: 800,
                      pageHeight: 1130,
                      lineSpacing: 32,
                      lineColor: '#d4d4d8',
                      marginColor: '#ffcccc',
                    },
                  });
                  setActiveDocument(pageIds[0]);
                }
              } else {
                setActiveDocument(id);
              }
              setActiveView('canvas');
            }}
            onUserClick={() => setShowAuthModal(true)}
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
            onDownload={requestExportPdf}
            onOpenSearch={() => setShowCommandPalette(true)}
            onOpenAuth={() => setShowAuthModal(true)}
            authUser={authUser}
          />

          <div className={`view-wrapper${viewPhase ? ` view-${viewPhase}` : ''}`} style={{ flex: 1, overflow: 'auto' }}>
            {renderView(displayView)}
          </div>
        </main>

        {showRightPanel && <RightPanel />}
      </Window>

      <GoogleAuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <CommandPalette open={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
    </div>
  );
}

export default App;
