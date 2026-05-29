import React, { useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/appStore';
import type { NoteFile } from '../../store/appStore';
import { connectNextcloud, testNextcloudConnection, getPapersFromNextcloud, downloadPaperFromNextcloud, type NextcloudPaper } from '../../services/nextcloud';

const Sidebar: React.FC = () => {
  const { folders, files, activeDocumentId, addFolder, addFile, setActiveDocument, deleteFolder, deleteFile, updateFolder, updateFile, nextcloudUrl, nextcloudUsername, nextcloudConnected, nextcloudStatus, nextcloudError, setNextcloudConfig, setNextcloudConnectionState } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [nextcloudPassword, setNextcloudPassword] = useState('');
  const [remotePapers, setRemotePapers] = useState<NextcloudPaper[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'txt', 'md', 'docx'].includes(ext || '')) return alert("Unsupported file type");
    
    const reader = new FileReader();
    reader.onload = (event) => {
      addFile({ id: uuidv4(), name: f.name, type: ext!, folderId: targetFolderId, dataUrl: event.target?.result as string });
      
      // Reset input unconditionally so multiple files can be uploaded natively
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(f);
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const supportedExts = ['pdf', 'txt', 'md', 'docx'];
    let uploadedCount = 0;

    Array.from(files).forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (!supportedExts.includes(ext || '')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        addFile({
          id: uuidv4(),
          name: f.name,
          type: ext!,
          folderId: targetFolderId,
          dataUrl: event.target?.result as string
        });
        uploadedCount++;
      };
      reader.readAsDataURL(f);
    });

    // Reset input
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
      style={{ padding: `8px 12px 8px ${12 + depth * 16}px`, backgroundColor: activeDocumentId === file.id ? '#f0f0f5' : 'transparent', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: activeDocumentId === file.id ? 700 : 500, cursor: 'pointer', marginBottom: '4px' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
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
              style={{ padding: `8px 12px 8px ${12 + depth * 16}px`, borderRadius: '8px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExp ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}><path d="M9 18l6-6-6-6"/></svg>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"/></svg>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <span onClick={(e) => triggerUpload(folderId, e)} title="Upload PDF to folder" style={{ color: '#8e8e93', fontSize: '15px' }}>↑</span>
                <span onClick={(e) => triggerFolderUpload(folderId, e)} title="Upload folder" style={{ color: '#8e8e93', fontSize: '15px' }}>📁</span>
                <span onClick={(e) => handleNewFolder(folderId, e)} title="New Subfolder" style={{ color: '#8e8e93', fontSize: '15px' }}>+</span>
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

  return (
    <div className="sidebar-panel" style={{ width: '280px', backgroundColor: '#ffffff', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Nunito, sans-serif' }}>
      {/* Invisible file input for single files */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.md,.docx" style={{ display: 'none' }} />
      
      {/* Invisible folder input for directory uploads */}
      <input type="file" ref={folderInputRef} onChange={handleFolderUpload} multiple accept=".pdf,.txt,.md,.docx" style={{ display: 'none' }} {...({ webkitdirectory: true } as any)} />
      
      <div style={{ padding: '24px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            Clio
            <span style={{ fontSize: '11px', backgroundColor: '#f0f0f5', padding: '4px 6px', borderRadius: '4px', fontWeight: 700, color: '#666' }}>Beta</span>
          </div>
        </div>
      </div>
      
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontWeight: 800, fontSize: '13px' }}>Nextcloud</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {nextcloudConnected && (
              <button onClick={disconnectCloud} style={{ border: '1px solid #d1d1d6', borderRadius: '8px', background: '#fff', padding: '6px 10px', cursor: 'pointer' }}>
                Disconnect
              </button>
            )}
            <button onClick={connectCloud} disabled={isConnecting} style={{ border: 'none', borderRadius: '8px', background: '#2e75b6', color: 'white', padding: '6px 12px', cursor: 'pointer' }}>
              {nextcloudConnected ? 'Refresh' : 'Connect'}
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
          <input
            value={nextcloudUrl}
            onChange={(e) => saveNextcloudConfig(e.target.value, nextcloudUsername)}
            placeholder="Nextcloud server URL"
            style={{ width: '100%', borderRadius: '10px', border: '1px solid #d1d1d6', padding: '10px', fontSize: '13px' }}
          />
          <input
            value={nextcloudUsername}
            onChange={(e) => saveNextcloudConfig(nextcloudUrl, e.target.value)}
            placeholder="Username"
            style={{ width: '100%', borderRadius: '10px', border: '1px solid #d1d1d6', padding: '10px', fontSize: '13px' }}
          />
          <input
            type="password"
            value={nextcloudPassword}
            onChange={(e) => setNextcloudPassword(e.target.value)}
            placeholder="Password"
            style={{ width: '100%', borderRadius: '10px', border: '1px solid #d1d1d6', padding: '10px', fontSize: '13px' }}
          />
        </div>
        <div style={{ fontSize: '12px', color: nextcloudConnected ? '#0b6623' : '#6b7280', marginBottom: '12px' }}>
          {connectionLabel}
        </div>
        {nextcloudConnected && remotePapers.length === 0 && (
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>Connected. There are no PDFs in /Papers yet.</div>
        )}
        {nextcloudConnected && remotePapers.length > 0 && (
          <div style={{ background: '#f8f8fb', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '12px' }}>Remote files in /Papers</div>
            {remotePapers.map((paper) => (
              <div key={paper.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>{paper.title}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{paper.authors}</div>
                </div>
                <button onClick={() => importNextcloudPaper(paper)} disabled={isImporting} style={{ border: 'none', borderRadius: '8px', background: '#00c48c', color: 'white', padding: '6px 12px', cursor: 'pointer', fontSize: '12px' }}>
                  Import
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontWeight: 800, fontSize: '13px' }}>Workspace</span>
          <div style={{ display: 'flex', gap: '8px' }}>
             <button onClick={() => triggerUpload(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} title="Upload File to Root">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
             </button>
             <button onClick={() => triggerFolderUpload(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: '14px' }} title="Upload Folder to Root">
               📁
             </button>
             <button onClick={(e) => handleNewFolder(null, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent-color)' }} title="Add Root Folder">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
             </button>
          </div>
        </div>

        {renderFolder(null, 0)}
        
        {files.length === 0 && folders.length === 0 && (
           <div style={{ fontSize: '13px', color: '#8e8e93', fontStyle: 'italic', marginBottom: '16px', marginTop: '16px' }}>No notebooks found. Create a folder or upload a PDF to begin!</div>
        )}
      </div>
    </div>
  );
};
export default Sidebar;
