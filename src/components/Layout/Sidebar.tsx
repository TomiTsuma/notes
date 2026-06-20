import React, { useRef, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import logo from '../../assets/logo.png';
import { useAppStore } from '../../store/appStore';
import type { NoteFile } from '../../store/appStore';
import {
  connectNextcloudWithFallback, disconnectNextcloud, getPapersFromNextcloud,
  downloadPaperFromNextcloud, uploadFileToNextcloud, setPapersPath, setSyncPath,
  getPapersPath, getSyncPath,
  type NextcloudPaper,
} from '../../services/nextcloud';
import NextcloudFolderPicker from '../Modals/NextcloudFolderPicker';
import {
  HomeIcon, ProjectsIcon, KanbanIcon, CalendarIcon, CanvasIcon,
  CloudIcon, TagIcon, FolderIcon, UploadIcon, RefreshIcon,
  WallpaperIcon, PlusIcon, ChevronRightIcon, NotebookIcon, FileIcon,
} from '../UI/Icons';

const Sidebar: React.FC = () => {
  const { 
    folders, 
    files, 
    activeDocumentId, 
    addFolder, 
    addFile, 
    setActiveDocument, 
    deleteFolder, 
    deleteFile, 
    updateFolder, 
    updateFile, 
    nextcloudUrl, 
    nextcloudUsername, 
    nextcloudConnected, 
    nextcloudStatus, 
    nextcloudError, 
    setNextcloudConfig, 
    setNextcloudConnectionState,
    // New Suite States & Actions
    activeView,
    setActiveView,
    projects,
    addProject,
    rotateBackground,
    selectedProjectId,
    setSelectedProjectId,
    tags,
    addTag,
    setFileTags,
    tagSearchQuery,
    setTagSearchQuery,
    nextcloudPapersPath,
    nextcloudSyncPath,
    setNextcloudPaths,
    associateFileToProject,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [nextcloudPassword, setNextcloudPassword] = useState('');
  const [remotePapers, setRemotePapers] = useState<NextcloudPaper[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<{ filename: string; dataUrl: string }[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [showNextcloudPanel, setShowNextcloudPanel] = useState(false);
  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [taggingFileId, setTaggingFileId] = useState<string | null>(null);
  const [folderPickerMode, setFolderPickerMode] = useState<'papers' | 'sync' | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; fileId: string; type: 'file' } | { x: number; y: number; folderId: string | null; type: 'folder' } | null>(null);
  const autoConnectAttempted = useRef(false);

  // Close context menu on any click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [ctxMenu]);

  const showProjectPicker = useCallback((fileId: string) => {
    setCtxMenu(null);
    if (projects.length === 0) return alert('No projects yet. Create one in the Project Hub.');
    const list = projects.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const choice = prompt(`Assign to project:\n${list}\n\nEnter number (or 0 to remove from project):`);
    if (!choice) return;
    const idx = parseInt(choice);
    if (idx === 0) {
      associateFileToProject(fileId, null);
    } else if (idx >= 1 && idx <= projects.length) {
      associateFileToProject(fileId, projects[idx - 1].id);
    }
  }, [projects, associateFileToProject]);

  const showFolderProjectPicker = useCallback((folderId: string | null) => {
    setCtxMenu(null);
    const folderFiles = files.filter(f => f.folderId === folderId);
    if (folderFiles.length === 0) return alert('No files in this folder.');
    if (projects.length === 0) return alert('No projects yet. Create one in the Project Hub.');
    const list = projects.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const choice = prompt(`Assign all ${folderFiles.length} files in this folder to project:\n${list}\n\nEnter number (or 0 to remove from project):`);
    if (!choice) return;
    const idx = parseInt(choice);
    if (idx === 0) {
      folderFiles.forEach(f => associateFileToProject(f.id, null));
    } else if (idx >= 1 && idx <= projects.length) {
      folderFiles.forEach(f => associateFileToProject(f.id, projects[idx - 1].id));
    }
  }, [files, projects, associateFileToProject]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const saveNextcloudConfig = (url: string, username: string) => {
    setNextcloudConfig(url, username);
  };

  const connectCloud = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.stopPropagation();
    if (isConnecting) return;
    if (!nextcloudUrl.trim() || !nextcloudUsername.trim()) {
      return alert('Please enter your Nextcloud server and username.');
    }
    if (!nextcloudPassword.trim()) {
      return alert('Please enter your Nextcloud password.');
    }

    setIsConnecting(true);
    setNextcloudConnectionState(false, 'connecting', null);

    try {
      sessionStorage.setItem('nc_pass', nextcloudPassword);
      setPapersPath(nextcloudPapersPath);
      setSyncPath(nextcloudSyncPath);
      setNextcloudPaths(getPapersPath(), getSyncPath());
      await connectNextcloudWithFallback(nextcloudUrl, nextcloudUsername, nextcloudPassword);
      const papers = await getPapersFromNextcloud(nextcloudPapersPath);
      setRemotePapers(papers);
      setNextcloudConnectionState(true, 'connected', null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNextcloudConnectionState(false, 'failed', message);
      setRemotePapers([]);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectCloud = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.stopPropagation();
    disconnectNextcloud();
    sessionStorage.removeItem('nc_pass');
    setNextcloudConnectionState(false, 'idle', null);
    setRemotePapers([]);
  };

  useEffect(() => {
    if (autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;

    const savedPass = sessionStorage.getItem('nc_pass');
    if (!savedPass || !nextcloudUrl || !nextcloudUsername || nextcloudConnected) return;

    setNextcloudPassword(savedPass);
    setPapersPath(nextcloudPapersPath);
    setSyncPath(nextcloudSyncPath);
    setNextcloudPaths(getPapersPath(), getSyncPath());
    setIsConnecting(true);
    setNextcloudConnectionState(false, 'connecting', null);

    connectNextcloudWithFallback(nextcloudUrl, nextcloudUsername, savedPass)
      .then(() => getPapersFromNextcloud(nextcloudPapersPath))
      .then(papers => {
        setRemotePapers(papers);
        setNextcloudConnectionState(true, 'connected', null);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setNextcloudConnectionState(false, 'failed', message);
      })
      .finally(() => setIsConnecting(false));
  }, []);

  const handleCreateTag = () => {
    const name = prompt('Tag name (e.g. variational_auto_encoder):');
    if (!name?.trim()) return;
    addTag({ id: `tag-${uuidv4().substring(0, 8)}`, name: name.trim().toLowerCase().replace(/\s+/g, '_'), createdAt: new Date().toISOString() });
  };

  const filteredFiles = tagSearchQuery.trim()
    ? files.filter(f => {
        const q = tagSearchQuery.toLowerCase();
        const fileTags = (f.tags || []).map(tid => tags.find(t => t.id === tid)?.name || '').join(' ');
        return f.name.toLowerCase().includes(q) || fileTags.includes(q);
      })
    : files;

  const importNextcloudPaper = async (paper: NextcloudPaper) => {
    setIsImporting(true);
    try {
      const fileDataUrl = await downloadPaperFromNextcloud(paper.path);
      const id = uuidv4();
      addFile({ id, name: `${paper.title}.pdf`, type: 'pdf', folderId: null, dataUrl: fileDataUrl, remotePath: paper.path });
      setActiveDocument(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Import failed: ${message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const connectionLabel = nextcloudStatus === 'connected' ? 'Connected' : nextcloudStatus === 'connecting' ? 'Connecting…' : nextcloudStatus === 'failed' ? `Failed: ${nextcloudError || 'Unable to connect'}` : 'Disconnected';

  const handleNewFolder = (parentId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const name = prompt("Enter folder name:");
    if (name) {
      const id = uuidv4();
      addFolder({ id, name, parentId });
      if (parentId) setExpanded(prev => ({ ...prev, [parentId]: true }));
    }
  };

  const triggerUpload = (folderId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTargetFolderId(folderId);
    if (folderId) setExpanded(prev => ({ ...prev, [folderId]: true }));
    fileInputRef.current?.click();
  };

  const triggerFolderUpload = (folderId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTargetFolderId(folderId);
    if (folderId) setExpanded(prev => ({ ...prev, [folderId]: true }));
    folderInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'txt', 'md', 'docx'].includes(ext || '')) return alert("Unsupported file type");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const id = uuidv4();
      let remotePath: string | undefined;
      if (nextcloudConnected) {
        try {
          remotePath = await uploadFileToNextcloud(f.name, dataUrl, nextcloudSyncPath);
          console.log(`[Upload] Synced ${f.name} to ${remotePath}`);
        } catch (error) {
          console.error('Cloud sync failed for file:', f.name, error);
          setPendingUploads(prev => [...prev, { filename: f.name, dataUrl }]);
        }
      } else {
        // Queue for later upload when connection is established
        setPendingUploads(prev => [...prev, { filename: f.name, dataUrl }]);
      }
      addFile({ id, name: f.name, type: ext!, folderId: targetFolderId, dataUrl, remotePath });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(f);
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const supportedExts = ['pdf', 'txt', 'md', 'docx'];
    Array.from(files).forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (!supportedExts.includes(ext || '')) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        addFile({
          id: uuidv4(),
          name: f.name,
          type: ext!,
          folderId: targetFolderId,
          dataUrl
        });

        if (nextcloudConnected) {
          try {
            await uploadFileToNextcloud(f.name, dataUrl);
          } catch (error) {
            console.error('Cloud sync failed for file:', f.name, error);
          setPendingUploads(prev => [...prev, { filename: f.name, dataUrl }]);
          }
        }
      };
      reader.readAsDataURL(f);
    });

    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const isNotebookActive = (file: NoteFile) => {
    if (file.type !== 'notebook') return activeDocumentId === file.id && activeView === 'canvas';
    return activeView === 'canvas' && (file.notebookPageIds || []).includes(activeDocumentId || '');
  };

  const handleFileClick = (file: NoteFile) => {
    if (file.type === 'notebook' && file.notebookPageIds && file.notebookPageIds.length > 0) {
      // Find the currently active page if it belongs to this notebook, otherwise go to first page
      const activePage = (file.notebookPageIds || []).includes(activeDocumentId || '')
        ? activeDocumentId
        : file.notebookPageIds[0];
      useAppStore.setState({ activeDocumentId: activePage, activeView: 'canvas' });
    } else {
      setActiveDocument(file.id);
    }
  };

  const renderFile = (file: NoteFile, depth: number) => {
    const isActive = isNotebookActive(file);
    return (
    <div key={file.id} 
      onClick={() => handleFileClick(file)}
      onContextMenu={(e) => { 
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY, fileId: file.id, type: 'file' });
      }}
      title="Right-click for options"
      style={{ 
        padding: `8px 12px 8px ${12 + depth * 16}px`, 
        backgroundColor: isActive ? 'rgba(10, 122, 255, 0.15)' : 'transparent', 
        borderRadius: '8px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '13px', 
        fontWeight: isActive ? 700 : 500, 
        color: isActive ? 'var(--accent-color)' : 'var(--text-primary)',
        cursor: 'pointer', 
        marginBottom: '2px',
        transition: 'background 0.15s ease'
      }}
      className="btn-animate"
    >
      {file.type === 'notebook'
        ? <NotebookIcon width={15} height={15} stroke="#34c759" />
        : <FileIcon width={15} height={15} />
      }
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{file.name}</span>
      {(file.tags || []).slice(0, 2).map(tid => {
        const t = tags.find(tag => tag.id === tid);
        return t ? <span key={tid} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 6, background: 'rgba(10,122,255,0.12)', color: '#0a7aff', fontWeight: 800 }}>{t.name.slice(0, 8)}</span> : null;
      })}
      <button onClick={(e) => { e.stopPropagation(); setTaggingFileId(file.id); setShowTagsPanel(true); }} title="Manage tags"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', display: 'flex' }}>
        <TagIcon width={12} height={12} />
      </button>
      {file.projectId && (() => {
        const p = projects.find(proj => proj.id === file.projectId);
        return p ? (
          <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', backgroundColor: p.color, color: 'white', fontWeight: 700 }}>
            {p.name.substring(0, 3)}
          </span>
        ) : null;
      })()}
    </div>
    );
  };

  const renderFolder = (folderId: string | null, depth: number) => {
    const childFolders = folders.filter(f => f.parentId === folderId);
    const childFiles = filteredFiles.filter(f => f.folderId === folderId);
    
    return (
      <div key={folderId || 'root'}>
        {folderId && (() => {
          const folder = folders.find(f => f.id === folderId)!;
          const isExp = expanded[folderId];
          return (
            <div 
              onContextMenu={(e) => { 
                e.preventDefault();
                e.stopPropagation();
                setCtxMenu({ x: e.clientX, y: e.clientY, folderId: folderId, type: 'folder' });
              }}
              onClick={(e) => toggleExpand(folderId, e)}
              title="Right-click for options"
              style={{ padding: `8px 12px 8px ${12 + depth * 16}px`, borderRadius: '8px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-sidebar)' }}
              className="btn-animate"
            >
              <ChevronRightIcon width={12} height={12} style={{ transform: isExp ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
              <FolderIcon width={15} height={15} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
              
              <div style={{ display: 'flex', gap: '4px' }}>
                <span onClick={(e) => triggerUpload(folderId, e)} title="Upload File" style={{ color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><UploadIcon width={13} height={13} /></span>
                <span onClick={(e) => triggerFolderUpload(folderId, e)} title="Upload Folder" style={{ color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><FolderIcon width={13} height={13} /></span>
                <span onClick={(e) => handleNewFolder(folderId, e)} title="New Subfolder" style={{ color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><PlusIcon width={13} height={13} /></span>
              </div>
            </div>
          );
        })()}
        
        {(!folderId || expanded[folderId]) && (
          <div>
            {childFolders.map(f => renderFolder(f.id, depth + (folderId ? 1 : 0)))}
            {childFiles.map(f => renderFile(f, depth + (folderId ? 1 : 0)))}
          </div>
        )}
      </div>
    );
  };

  // Nav Item Renderer
  const renderNavItem = (view: typeof activeView, label: string, icon: React.ReactNode) => {
    const isActive = activeView === view;
    return (
      <div
        className="btn-animate sidebar-nav-item"
        onClick={() => {
          setActiveView(view);
          if (view === 'canvas' && files.length > 0 && !activeDocumentId) {
            setActiveDocument(files[0].id);
          }
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 16px', borderRadius: '12px',
          fontSize: '14px', fontWeight: isActive ? 800 : 600,
          color: isActive ? 'var(--accent-color)' : 'var(--text-muted)',
          backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
          cursor: 'pointer', marginBottom: '4px',
          transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {icon}
        <span style={{ flex: 1 }}>{label}</span>
        {isActive && (
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', flexShrink: 0 }} />
        )}
      </div>
    );
  };

  const handleAddNewProject = () => {
    const name = prompt("Enter project name:");
    if (!name) return;
    const desc = prompt("Enter project description:") || "";
    const colors = ['#0a7aff', '#34c759', '#af52de', '#ff9500', '#ff2d55', '#5856d6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    addProject({
      id: `proj-${uuidv4().substring(0, 8)}`,
      name,
      description: desc,
      color: randomColor,
      createdAt: new Date().toISOString()
    });
  };

  // Retry pending uploads whenever connection is established or every 60s
  useEffect(() => {
    if (!nextcloudConnected || pendingUploads.length === 0) return;
    const tryFlush = async () => {
      const remaining: { filename: string; dataUrl: string }[] = [];
      for (const item of pendingUploads) {
        try {
          await uploadFileToNextcloud(item.filename, item.dataUrl);
          console.log(`[PendingUpload] Synced ${item.filename} to Nextcloud`);
        } catch (err) {
          console.error(`[PendingUpload] Retry failed for ${item.filename}:`, err);
          remaining.push(item);
        }
      }
      setPendingUploads(remaining);
    };
    tryFlush();
  }, [nextcloudConnected]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!nextcloudConnected || pendingUploads.length === 0) return;
      const tryFlush = async () => {
        const remaining: { filename: string; dataUrl: string }[] = [];
        for (const item of pendingUploads) {
          try {
            await uploadFileToNextcloud(item.filename, item.dataUrl);
          } catch (err) {
            remaining.push(item);
          }
        }
        setPendingUploads(remaining);
      };
      tryFlush();
    }, 60000);
    return () => clearInterval(interval);
  }, [nextcloudConnected, pendingUploads]);

  return (
    <div 
      className="sidebar-panel glass-card" 
      style={{ 
        width: '280px', 
        minWidth: '280px', 
        background: 'var(--bg-sidebar)', 
        borderRight: '1px solid var(--sidebar-border)', 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        fontFamily: 'Nunito, sans-serif',
        borderRadius: 0,
        boxShadow: 'none',
        color: 'var(--text-primary)',
      }}
    >
      {/* Invisible inputs */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.md,.docx" style={{ display: 'none' }} />
      <input type="file" ref={folderInputRef} onChange={handleFolderUpload} multiple accept=".pdf,.txt,.md,.docx" style={{ display: 'none' }} {...({ webkitdirectory: '' } as any)} />
      
      {/* Header Branding */}
      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
            <img src={logo} alt="Logo" style={{ width: '24px', height: '24px' }} />
            Chlio
            <span style={{ fontSize: '10px', backgroundColor: 'rgba(10, 122, 255, 0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: 800, color: '#0a7aff' }}>OS</span>
          </div>
        </div>
      </div>
      
      {/* Main Suite Navigation */}
      <div style={{ padding: '0 12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        {renderNavItem('home',     'Dashboard',       <HomeIcon />)}
        {renderNavItem('projects', 'Project Hub',     <ProjectsIcon />)}
        {renderNavItem('kanban',   'Kanban Board',    <KanbanIcon />)}
        {renderNavItem('calendar', 'Calendar Planner',<CalendarIcon />)}
        {(files.length > 0 || activeDocumentId) && renderNavItem('canvas', 'Note Canvas', <CanvasIcon />)}
      </div>

      {/* Sidebar Content Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        
        {/* Projects Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
            <span style={{ fontWeight: 800, fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>PROJECTS</span>
            <button onClick={handleAddNewProject} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#0a7aff', fontWeight: 800, fontSize: '14px' }} title="Create Project">+</button>
          </div>
          {projects.map(proj => {
            const isSelected = selectedProjectId === proj.id && activeView === 'projects';
            return (
              <div 
                key={proj.id}
                onClick={() => {
                  setSelectedProjectId(proj.id);
                  setActiveView('projects');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: isSelected ? proj.color : 'var(--text-primary)',
                  backgroundColor: isSelected ? `rgba(${parseInt(proj.color.slice(1,3),16) || 10}, ${parseInt(proj.color.slice(3,5),16) || 122}, ${parseInt(proj.color.slice(5,7),16) || 255}, 0.08)` : 'transparent',
                  marginBottom: '2px',
                  transition: 'all 0.2s'
                }}
                className="btn-animate"
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: proj.color }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  {files.filter(f => f.projectId === proj.id).length}
                </span>
              </div>
            );
          })}
          {projects.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px' }}>No active projects. Click + to create.</div>
          )}
        </div>

        {/* Nextcloud Config Collapsible Section */}
        <div style={{ marginBottom: '20px', background: 'var(--bg-inset)', borderRadius: '14px', padding: '8px' }}>
          <div 
            onClick={() => setShowNextcloudPanel(!showNextcloudPanel)}
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              fontWeight: 800, 
              fontSize: '11px', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer',
              padding: '6px 8px'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CloudIcon width={12} height={12} /> NEXTCLOUD</span>
            <ChevronRightIcon width={12} height={12} style={{ transform: showNextcloudPanel ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </div>
          
          {showNextcloudPanel && (
            <div style={{ padding: '8px 4px 4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                value={nextcloudUrl}
                onChange={(e) => saveNextcloudConfig(e.target.value, nextcloudUsername)}
                placeholder="Server URL"
                style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-input)' }}
              />
              <input
                value={nextcloudUsername}
                onChange={(e) => saveNextcloudConfig(nextcloudUrl, e.target.value)}
                placeholder="Username"
                style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-input)' }}
              />
              <input
                type="password"
                value={nextcloudPassword}
                onChange={(e) => setNextcloudPassword(e.target.value)}
                placeholder="Password"
                style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-input)' }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                {nextcloudConnected && (
                  <button onClick={disconnectCloud} style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--btn-secondary-bg)', padding: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    Disconnect
                  </button>
                )}
                <button onClick={connectCloud} disabled={isConnecting} style={{ flex: 2, border: 'none', borderRadius: '8px', background: '#0a7aff', color: 'white', padding: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {isConnecting ? 'Connecting…' : nextcloudConnected ? 'Refresh' : 'Connect'}
                </button>
              </div>
              <div style={{ fontSize: '10px', color: nextcloudConnected ? 'var(--success-color)' : 'var(--text-secondary)', marginTop: '2px', textAlign: 'center' }}>
                {connectionLabel}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center' }}>
                Papers: {nextcloudPapersPath} · Sync: {nextcloudSyncPath}
              </div>
              {nextcloudConnected && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setFolderPickerMode('papers')} style={{ flex: 1, fontSize: 10, padding: 6, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--btn-secondary-bg)', cursor: 'pointer', fontWeight: 700 }}>Browse Papers Folder</button>
                  <button onClick={() => setFolderPickerMode('sync')} style={{ flex: 1, fontSize: 10, padding: 6, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--btn-secondary-bg)', cursor: 'pointer', fontWeight: 700 }}>Browse Sync Folder</button>
                </div>
              )}
              {nextcloudConnected && (
                <button onClick={async () => {
                  try {
                    const papers = await getPapersFromNextcloud(nextcloudPapersPath);
                    setRemotePapers(papers);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to refresh papers');
                  }
                }} style={{ width: '100%', fontSize: 10, padding: 6, borderRadius: 8, border: 'none', background: 'rgba(10,122,255,0.1)', color: '#0a7aff', cursor: 'pointer', fontWeight: 700 }}>
                  Refresh Papers List
                </button>
              )}
              
              {nextcloudConnected && remotePapers.length > 0 && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: '10px', padding: '8px', marginTop: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  <div style={{ fontWeight: 800, marginBottom: '6px', fontSize: '10px', color: 'var(--text-secondary)' }}>Remote papers in Cloud</div>
                  {remotePapers.map((paper) => (
                    <div key={paper.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paper.title}</div>
                      </div>
                      <button onClick={() => importNextcloudPaper(paper)} disabled={isImporting} style={{ border: 'none', borderRadius: '6px', background: '#34c759', color: 'white', padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontWeight: 700 }}>
                        Get
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div style={{ marginBottom: '20px', background: 'var(--bg-inset)', borderRadius: '14px', padding: '8px' }}>
          <div onClick={() => setShowTagsPanel(!showTagsPanel)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><TagIcon width={12} height={12} /> RESEARCH TAGS</span>
            <ChevronRightIcon width={12} height={12} style={{ transform: showTagsPanel ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </div>
          {showTagsPanel && (
            <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={tagSearchQuery}
                onChange={e => setTagSearchQuery(e.target.value)}
                placeholder="Search by tag or filename..."
                style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-color)', padding: '6px 8px', fontSize: 12 }}
              />
              <button onClick={handleCreateTag} style={{ border: 'none', borderRadius: 8, background: '#0a7aff', color: 'white', padding: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Create Tag</button>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {tags.map(t => (
                  <span key={t.id} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, background: 'rgba(10,122,255,0.1)', color: '#0a7aff', fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => setTagSearchQuery(t.name)}>
                    {t.name}
                  </span>
                ))}
              </div>
              {taggingFileId && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 6 }}>Assign tags to file</div>
                  {tags.map(t => {
                    const file = files.find(f => f.id === taggingFileId);
                    const selected = (file?.tags || []).includes(t.id);
                    return (
                      <button key={t.id} onClick={() => {
                        if (!file) return;
                        const next = selected ? (file.tags || []).filter(id => id !== t.id) : [...(file.tags || []), t.id];
                        setFileTags(file.id, next);
                      }} style={{ margin: 2, fontSize: 10, padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: selected ? 'var(--accent-color)' : 'var(--bg-inset)', color: selected ? 'white' : 'var(--text-muted)', fontWeight: 700 }}>
                        {t.name}
                      </button>
                    );
                  })}
                  <button onClick={() => setTaggingFileId(null)} style={{ marginTop: 6, fontSize: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Done</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notebooks File Explorer */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
            <span style={{ fontWeight: 800, fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>NOTEBOOKS</span>
            <div style={{ display: 'flex', gap: '8px' }}>
               <button onClick={() => triggerUpload(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', display: 'flex' }} title="Upload File">
                 <UploadIcon width={14} height={14} />
               </button>
               <button onClick={() => triggerFolderUpload(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', display: 'flex' }} title="Upload Folder">
                 <FolderIcon width={14} height={14} />
               </button>
               <button onClick={(e) => handleNewFolder(null, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', display: 'flex' }} title="Add Folder">
                 <PlusIcon width={14} height={14} />
               </button>
            </div>
          </div>

          <div style={{ padding: '0 4px' }}>
            {renderFolder(null, 0)}
            
            {filteredFiles.length === 0 && folders.length === 0 && (
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px' }}>{tagSearchQuery ? 'No files match your search.' : 'No notes found. Create a folder or upload a note!'}</div>
            )}
          </div>
        </div>

      </div>

      {/* Sidebar Glassmorphic Footer */}
      <div 
        style={{ 
          padding: '16px', 
          borderTop: '1px solid var(--border-subtle)', 
          background: 'var(--bg-inset)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px'
        }}
      >
        <button 
          onClick={rotateBackground}
          style={{
            width: '100%',
            background: 'var(--btn-secondary-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '10px',
            fontSize: '12px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
          className="btn-animate"
        >
          <WallpaperIcon width={14} height={14} stroke="var(--accent-color)" />
          Change Wallpaper
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
          <span>TomiTsuma Notes © 2026</span>
        </div>
      </div>

      {folderPickerMode && (
        <NextcloudFolderPicker
          title={folderPickerMode === 'papers' ? 'Select Papers Folder' : 'Select Sync Upload Folder'}
          currentPath={folderPickerMode === 'papers' ? nextcloudPapersPath : nextcloudSyncPath}
          onSelect={async (path) => {
            if (folderPickerMode === 'papers') {
              setNextcloudPaths(path, nextcloudSyncPath);
              setPapersPath(path);
              if (nextcloudConnected) {
                try {
                  const papers = await getPapersFromNextcloud(path);
                  setRemotePapers(papers);
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to list papers');
                }
              }
            } else {
              setNextcloudPaths(nextcloudPapersPath, path);
              setSyncPath(path);
            }
          }}
          onClose={() => setFolderPickerMode(null)}
        />
      )}

      {/* Context Menu */}
      {ctxMenu && ctxMenu.type === 'file' && (() => {
        const file = files.find(f => f.id === ctxMenu.fileId);
        if (!file) return null;
        const proj = file.projectId ? projects.find(p => p.id === file.projectId) : null;
        return (
          <div style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999,
            background: 'var(--bg-surface-solid)', border: '1px solid var(--border-color)',
            borderRadius: 10, padding: '4px 0', minWidth: 180, boxShadow: '0 4px 20px var(--shadow-md)',
            fontSize: 13, fontFamily: 'Nunito',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '6px 14px', fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 2 }}>
              {file.name.length > 22 ? file.name.slice(0, 22) + '…' : file.name}
            </div>
            <div style={{ padding: '6px 14px', cursor: 'pointer' }} onClick={() => { setCtxMenu(null); const n = prompt('Rename file:', file.name); if (n) updateFile(file.id, { name: n }); }}>Rename</div>
            <div style={{ padding: '6px 14px', cursor: 'pointer' }} onClick={() => showProjectPicker(file.id)}>
              {proj ? `Change Project (${proj.name})` : 'Assign to Project…'}
            </div>
            {proj && (
              <div style={{ padding: '6px 14px', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => { setCtxMenu(null); associateFileToProject(file.id, null); }}>
                Remove from {proj.name}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 2 }} />
            <div style={{ padding: '6px 14px', cursor: 'pointer', color: 'var(--danger-color)' }} onClick={() => { setCtxMenu(null); if (confirm(`Delete '${file.name}'?`)) deleteFile(file.id); }}>Delete</div>
          </div>
        );
      })()}

      {ctxMenu && ctxMenu.type === 'folder' && (() => {
        const folder = ctxMenu.folderId ? folders.find(f => f.id === ctxMenu.folderId) : null;
        const folderName = folder?.name || 'Root';
        const folderFileCount = files.filter(f => f.folderId === ctxMenu.folderId).length;
        return (
          <div style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999,
            background: 'var(--bg-surface-solid)', border: '1px solid var(--border-color)',
            borderRadius: 10, padding: '4px 0', minWidth: 200, boxShadow: '0 4px 20px var(--shadow-md)',
            fontSize: 13, fontFamily: 'Nunito',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '6px 14px', fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 2 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><FolderIcon width={11} height={11} /> {folderName}</span>
            </div>
            <div style={{ padding: '6px 14px', cursor: 'pointer' }} onClick={() => { setCtxMenu(null); if (folder) { const n = prompt('Rename folder:', folder.name); if (n) updateFolder(folder.id, n); } }}>Rename</div>
            {folderFileCount > 0 && (
              <div style={{ padding: '6px 14px', cursor: 'pointer' }} onClick={() => showFolderProjectPicker(ctxMenu.folderId)}>
                Assign {folderFileCount} file{folderFileCount !== 1 ? 's' : ''} to Project…
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 2 }} />
            <div style={{ padding: '6px 14px', cursor: 'pointer', color: 'var(--danger-color)' }} onClick={() => { setCtxMenu(null); if (folder && confirm(`Delete folder '${folder.name}'?`)) deleteFolder(folder.id); }}>Delete Folder</div>
          </div>
        );
      })()}
    </div>
  );
};

export default Sidebar;
