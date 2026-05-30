import React, { useRef, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import logo from '../../assets/logo.png';
import { useAppStore } from '../../store/appStore';
import type { NoteFile } from '../../store/appStore';
import { connectNextcloud, testNextcloudConnection, getPapersFromNextcloud, downloadPaperFromNextcloud, uploadFileToNextcloud, type NextcloudPaper } from '../../services/nextcloud';

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
    setSelectedProjectId
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

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const saveNextcloudConfig = (url: string, username: string) => {
    setNextcloudConfig(url, username);
  };

  const connectCloud = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.stopPropagation();
    if (!nextcloudUrl.trim() || !nextcloudUsername.trim()) {
      return alert('Please enter your Nextcloud server and username.');
    }

    setIsConnecting(true);
    setNextcloudConnectionState(false, 'connecting', null);

    try {
      connectNextcloud(nextcloudUrl, nextcloudUsername, nextcloudPassword);
      await testNextcloudConnection();
      const papers = await getPapersFromNextcloud();
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
    setNextcloudConnectionState(false, 'idle', null);
    setRemotePapers([]);
  };

  const importNextcloudPaper = async (paper: NextcloudPaper) => {
    setIsImporting(true);
    try {
      const fileDataUrl = await downloadPaperFromNextcloud(paper.path);
      const id = uuidv4();
      addFile({ id, name: `${paper.title}.pdf`, type: 'pdf', folderId: null, dataUrl: fileDataUrl });
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
      addFile({ id, name: f.name, type: ext!, folderId: targetFolderId, dataUrl });

      if (nextcloudConnected) {
        try {
          await uploadFileToNextcloud(f.name, dataUrl);
          console.log(`[Upload] Synced ${f.name} to Nextcloud/Chlio`);
        } catch (error) {
          console.error('Cloud sync failed for file:', f.name, error);
          setPendingUploads(prev => [...prev, { filename: f.name, dataUrl }]);
        }
      } else {
        // Queue for later upload when connection is established
        setPendingUploads(prev => [...prev, { filename: f.name, dataUrl }]);
      }
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

  const renderFile = (file: NoteFile, depth: number) => (
    <div key={file.id} 
      onClick={() => setActiveDocument(file.id)}
      onContextMenu={(e) => { 
        e.preventDefault(); 
        if (confirm(`Are you sure you want to delete '${file.name}'?`)) deleteFile(file.id); 
        else { const n = prompt('Rename file:', file.name); if(n) updateFile(file.id, n); } 
      }}
      title="Right click to Rename/Delete"
      style={{ 
        padding: `8px 12px 8px ${12 + depth * 16}px`, 
        backgroundColor: activeDocumentId === file.id && activeView === 'canvas' ? 'rgba(10, 122, 255, 0.15)' : 'transparent', 
        borderRadius: '8px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '13px', 
        fontWeight: activeDocumentId === file.id && activeView === 'canvas' ? 700 : 500, 
        color: activeDocumentId === file.id && activeView === 'canvas' ? '#0a7aff' : '#1c1c1e',
        cursor: 'pointer', 
        marginBottom: '2px',
        transition: 'all 0.2s ease'
      }}
      className="btn-animate"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{file.name}</span>
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

  const renderFolder = (folderId: string | null, depth: number) => {
    const childFolders = folders.filter(f => f.parentId === folderId);
    const childFiles = files.filter(f => f.folderId === folderId);
    
    return (
      <div key={folderId || 'root'}>
        {folderId && (() => {
          const folder = folders.find(f => f.id === folderId)!;
          const isExp = expanded[folderId];
          return (
            <div 
              onContextMenu={(e) => { 
                e.preventDefault(); 
                if (confirm(`Are you sure you want to delete folder '${folder.name}'?`)) deleteFolder(folder.id); 
                else { const n = prompt('Rename folder:', folder.name); if(n) updateFolder(folder.id, n); } 
              }}
              onClick={(e) => toggleExpand(folderId, e)}
              title="Right click to Rename/Delete"
              style={{ padding: `8px 12px 8px ${12 + depth * 16}px`, borderRadius: '8px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, color: '#3a3b3c' }}
              className="btn-animate"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExp ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}><path d="M9 18l6-6-6-6"/></svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"/></svg>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
              
              <div style={{ display: 'flex', gap: '6px' }}>
                <span onClick={(e) => triggerUpload(folderId, e)} title="Upload File" style={{ color: '#8e8e93', fontSize: '13px' }}>↑</span>
                <span onClick={(e) => triggerFolderUpload(folderId, e)} title="Upload Folder" style={{ color: '#8e8e93', fontSize: '13px' }}>📁</span>
                <span onClick={(e) => handleNewFolder(folderId, e)} title="New Subfolder" style={{ color: '#8e8e93', fontSize: '13px' }}>+</span>
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
        onClick={() => {
          setActiveView(view);
          if (view === 'canvas' && files.length > 0 && !activeDocumentId) {
            setActiveDocument(files[0].id);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 16px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: isActive ? 800 : 600,
          color: isActive ? '#0a7aff' : '#48484a',
          backgroundColor: isActive ? 'rgba(10, 122, 255, 0.12)' : 'transparent',
          cursor: 'pointer',
          marginBottom: '4px',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        className="btn-animate"
      >
        {icon}
        <span style={{ flex: 1 }}>{label}</span>
        {isActive && (
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0a7aff' }} />
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
        background: 'rgba(255, 255, 255, 0.45)', 
        borderRight: '1px solid rgba(255, 255, 255, 0.35)', 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        fontFamily: 'Nunito, sans-serif',
        borderRadius: 0,
        boxShadow: 'none'
      }}
    >
      {/* Invisible inputs */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.md,.docx" style={{ display: 'none' }} />
      <input type="file" ref={folderInputRef} onChange={handleFolderUpload} multiple accept=".pdf,.txt,.md,.docx" style={{ display: 'none' }} {...({ webkitdirectory: '' } as any)} />
      
      {/* Header Branding */}
      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px', color: '#1c1c1e' }}>
            <img src={logo} alt="Logo" style={{ width: '24px', height: '24px' }} />
            Chlio
            <span style={{ fontSize: '10px', backgroundColor: 'rgba(10, 122, 255, 0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: 800, color: '#0a7aff' }}>OS</span>
          </div>
        </div>
      </div>
      
      {/* Main Suite Navigation */}
      <div style={{ padding: '0 12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        {renderNavItem('home', 'Dashboard', 
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        )}
        {renderNavItem('projects', 'Project Hub', 
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"/></svg>
        )}
        {renderNavItem('kanban', 'Kanban Board', 
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        )}
        {renderNavItem('calendar', 'Calendar Planner', 
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        )}
        {(files.length > 0 || activeDocumentId) && renderNavItem('canvas', 'Active Note Canvas', 
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z"/></svg>
        )}
      </div>

      {/* Sidebar Content Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        
        {/* Projects Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
            <span style={{ fontWeight: 800, fontSize: '11px', color: '#8e8e93', letterSpacing: '0.5px' }}>PROJECTS</span>
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
                  color: isSelected ? proj.color : '#1c1c1e',
                  backgroundColor: isSelected ? `rgba(${parseInt(proj.color.slice(1,3),16) || 10}, ${parseInt(proj.color.slice(3,5),16) || 122}, ${parseInt(proj.color.slice(5,7),16) || 255}, 0.08)` : 'transparent',
                  marginBottom: '2px',
                  transition: 'all 0.2s'
                }}
                className="btn-animate"
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: proj.color }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                <span style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 700 }}>
                  {files.filter(f => f.projectId === proj.id).length}
                </span>
              </div>
            );
          })}
          {projects.length === 0 && (
            <div style={{ fontSize: '12px', color: '#8e8e93', fontStyle: 'italic', padding: '8px' }}>No active projects. Click + to create.</div>
          )}
        </div>

        {/* Nextcloud Config Collapsible Section */}
        <div style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.03)', borderRadius: '14px', padding: '8px' }}>
          <div 
            onClick={() => setShowNextcloudPanel(!showNextcloudPanel)}
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              fontWeight: 800, 
              fontSize: '11px', 
              color: '#8e8e93', 
              cursor: 'pointer',
              padding: '6px 8px'
            }}
          >
            <span>☁️ NEXTCLOUD CLIENT</span>
            <span>{showNextcloudPanel ? '▲' : '▼'}</span>
          </div>
          
          {showNextcloudPanel && (
            <div style={{ padding: '8px 4px 4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                value={nextcloudUrl}
                onChange={(e) => saveNextcloudConfig(e.target.value, nextcloudUsername)}
                placeholder="Server URL"
                style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', padding: '6px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.7)' }}
              />
              <input
                value={nextcloudUsername}
                onChange={(e) => saveNextcloudConfig(nextcloudUrl, e.target.value)}
                placeholder="Username"
                style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', padding: '6px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.7)' }}
              />
              <input
                type="password"
                value={nextcloudPassword}
                onChange={(e) => setNextcloudPassword(e.target.value)}
                placeholder="Password"
                style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', padding: '6px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.7)' }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                {nextcloudConnected && (
                  <button onClick={disconnectCloud} style={{ flex: 1, border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', background: '#fff', padding: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    Disconnect
                  </button>
                )}
                <button onClick={connectCloud} disabled={isConnecting} style={{ flex: 2, border: 'none', borderRadius: '8px', background: '#0a7aff', color: 'white', padding: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {nextcloudConnected ? 'Refreshed' : 'Connect'}
                </button>
              </div>
              <div style={{ fontSize: '10px', color: nextcloudConnected ? '#34c759' : '#8e8e93', marginTop: '2px', textAlign: 'center' }}>
                {connectionLabel}
              </div>
              
              {nextcloudConnected && remotePapers.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: '10px', padding: '8px', marginTop: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  <div style={{ fontWeight: 800, marginBottom: '6px', fontSize: '10px', color: '#8e8e93' }}>Remote papers in Cloud</div>
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

        {/* Notebooks File Explorer */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
            <span style={{ fontWeight: 800, fontSize: '11px', color: '#8e8e93', letterSpacing: '0.5px' }}>NOTEBOOKS</span>
            <div style={{ display: 'flex', gap: '8px' }}>
               <button onClick={() => triggerUpload(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} title="Upload File">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
               </button>
               <button onClick={() => triggerFolderUpload(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: '11px' }} title="Upload Folder">
                 📁
               </button>
               <button onClick={(e) => handleNewFolder(null, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: '#8e8e93' }} title="Add Folder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
               </button>
            </div>
          </div>

          <div style={{ padding: '0 4px' }}>
            {renderFolder(null, 0)}
            
            {files.length === 0 && folders.length === 0 && (
               <div style={{ fontSize: '12px', color: '#8e8e93', fontStyle: 'italic', padding: '8px' }}>No notes found. Create a folder or upload a note!</div>
            )}
          </div>
        </div>

      </div>

      {/* Sidebar Glassmorphic Footer */}
      <div 
        style={{ 
          padding: '16px', 
          borderTop: '1px solid rgba(255,255,255,0.25)', 
          background: 'rgba(255,255,255,0.2)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px'
        }}
      >
        <button 
          onClick={rotateBackground}
          style={{
            width: '100%',
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: '12px',
            padding: '10px',
            fontSize: '12px',
            fontWeight: 800,
            color: '#1c1c1e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
          className="btn-animate"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a7aff" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Change Wallpaper
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '10px', color: '#8e8e93', fontWeight: 600 }}>
          <span>TomiTsuma Notes © 2026</span>
        </div>
      </div>

    </div>
  );
};

export default Sidebar;
