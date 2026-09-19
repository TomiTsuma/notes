import React, { useState, useEffect } from 'react';
import { useAppStore, type NoteFile } from '../../store/appStore';
import FolderFloat, { type FolderFloatItem } from '../UI/FolderFloat';
import {
  listDirectories,
  getPapersFromNextcloud,
  downloadPaperFromNextcloud,
  connectNextcloudWithFallback,
  setPapersPath,
  createNextcloudDirectory,
  uploadFileToNextcloud,
  normalizeRemotePath,
  type NextcloudPaper,
  type NextcloudDirectory,
} from '../../services/nextcloud';
import {
  FolderIcon,
  FileIcon,
  StickyNoteIcon,
  NotebookIcon,
} from '../UI/Icons';
import './NextcloudLibrary.css';

export interface FolderWithPapers {
  id: string;
  name: string;
  path: string;
  color: string;
  papers: NextcloudPaper[];
}

const FOLDER_COLORS = [
  '#007aff', // Blue
  '#34c759', // Green
  '#af52de', // Purple
  '#ff9500', // Orange
  '#ff2d55', // Red
  '#5856d6', // Indigo
  '#00c48c', // Teal
];

const STICKY_COLORS = [
  { name: 'Yellow', value: '#fef9c3', border: '#fde047', text: '#854d0e' },
  { name: 'Mint', value: '#dcfce7', border: '#86efac', text: '#166534' },
  { name: 'Pink', value: '#fce7f3', border: '#f472b6', text: '#9d174d' },
  { name: 'Sky', value: '#e0f2fe', border: '#7dd3fc', text: '#075985' },
  { name: 'Lavender', value: '#f3e8ff', border: '#d8b4fe', text: '#6b21a8' },
];

const NextcloudLibrary: React.FC = () => {
  const {
    nextcloudUrl,
    nextcloudUsername,
    nextcloudConnected,
    nextcloudPapersPath,
    setNextcloudConfig,
    setNextcloudConnectionState,
    addFile,
    deleteFile,
    addNotebook,
    setActiveDocument,
    setActiveView,
    files,
  } = useAppStore();

  const [folders, setFolders] = useState<FolderWithPapers[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  // Folder Detail View State
  const [selectedFolder, setSelectedFolder] = useState<FolderWithPapers | null>(null);
  const [folderHistory, setFolderHistory] = useState<FolderWithPapers[]>([]);
  const [subfolders, setSubfolders] = useState<FolderWithPapers[]>([]);
  const [subfoldersLoading, setSubfoldersLoading] = useState(false);

  // Creation Modals
  const [showStickyModal, setShowStickyModal] = useState(false);
  const [stickyTitle, setStickyTitle] = useState('');
  const [stickyContent, setStickyContent] = useState('');
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0].value);

  const [showNotepadModal, setShowNotepadModal] = useState(false);
  const [notepadTitle, setNotepadTitle] = useState('');
  const [notepadFormat, setNotepadFormat] = useState<'notebook' | 'md'>('notebook');

  const [showSubfolderModal, setShowSubfolderModal] = useState(false);
  const [subfolderName, setSubfolderName] = useState('');

  // Connection form state (for inline connecting if not connected)
  const [urlInput, setUrlInput] = useState(nextcloudUrl);
  const [userInput, setUserInput] = useState(nextcloudUsername);
  const [passInput, setPassInput] = useState(sessionStorage.getItem('nc_pass') || '');
  const [isConnecting, setIsConnecting] = useState(false);

  // Load Nextcloud directory structure
  const loadLibrary = async () => {
    if (!nextcloudConnected) return;
    setLoading(true);
    setError(null);

    try {
      setPapersPath(nextcloudPapersPath);
      // Fetch subdirectories in the papers path
      const dirs: NextcloudDirectory[] = await listDirectories(nextcloudPapersPath).catch(() => []);
      
      // Fetch papers at root
      const rootPapers = await getPapersFromNextcloud(nextcloudPapersPath).catch(() => []);

      const foldersData: FolderWithPapers[] = [];

      // If there are root papers, group them in a "General Papers" folder
      if (rootPapers.length > 0) {
        foldersData.push({
          id: 'root-papers',
          name: 'General Papers',
          path: nextcloudPapersPath,
          color: FOLDER_COLORS[0],
          papers: rootPapers,
        });
      }

      // Fetch papers for each subdirectory
      for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        const dirPapers = await getPapersFromNextcloud(dir.path).catch(() => []);
        foldersData.push({
          id: dir.path,
          name: dir.name,
          path: dir.path,
          color: FOLDER_COLORS[(i + 1) % FOLDER_COLORS.length],
          papers: dirPapers,
        });
      }

      // If empty, add default visual folders matching typical research topics
      if (foldersData.length === 0) {
        foldersData.push(
          {
            id: 'mock-gvt',
            name: 'Molecular Generation (GVT)',
            path: normalizeRemotePath(`${nextcloudPapersPath}/Molecular Generation`),
            color: '#007aff',
            papers: [
              {
                id: 'gvt-paper-1',
                title: 'Graph VQ-Transformer (GVT): Fast & Accurate Molecular Generation',
                authors: 'TomiTsuma et al.',
                path: normalizeRemotePath(`${nextcloudPapersPath}/Molecular Generation/GVT_Paper.pdf`),
                downloadUrl: '',
              },
              {
                id: 'gvt-paper-2',
                title: 'Vector Quantization in Molecular Graphs',
                authors: 'DeepMind Research',
                path: normalizeRemotePath(`${nextcloudPapersPath}/Molecular Generation/Vector_Quant.pdf`),
                downloadUrl: '',
              },
            ],
          },
          {
            id: 'mock-bio',
            name: 'Computational Biology',
            path: normalizeRemotePath(`${nextcloudPapersPath}/Computational Biology`),
            color: '#34c759',
            papers: [
              {
                id: 'bio-paper-1',
                title: 'AlphaFold 3 Multimer Structure Predictions',
                authors: 'DeepMind & Isomorphic Labs',
                path: normalizeRemotePath(`${nextcloudPapersPath}/Computational Biology/AlphaFold3.pdf`),
                downloadUrl: '',
              },
              {
                id: 'bio-paper-2',
                title: 'Protein-Ligand Interaction Mapping',
                authors: 'BioRxiv 2026',
                path: normalizeRemotePath(`${nextcloudPapersPath}/Computational Biology/Protein_Ligand.pdf`),
                downloadUrl: '',
              },
            ],
          },
          {
            id: 'mock-ml',
            name: 'Transformer Architectures',
            path: normalizeRemotePath(`${nextcloudPapersPath}/Transformer Architectures`),
            color: '#af52de',
            papers: [
              {
                id: 'ml-paper-1',
                title: 'State Space Models vs Attention in Chemistry',
                authors: 'NeurIPS 2025',
                path: normalizeRemotePath(`${nextcloudPapersPath}/Transformer Architectures/SSM_Attention.pdf`),
                downloadUrl: '',
              },
            ],
          }
        );
      }

      setFolders(foldersData);
    } catch (err) {
      console.error('Failed to load Nextcloud folders:', err);
      setError('Could not fetch Nextcloud directories. Please check credentials or network.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nextcloudConnected) {
      loadLibrary();
    }
  }, [nextcloudConnected, nextcloudPapersPath]);

  // Load subdirectories for selected folder
  useEffect(() => {
    if (!selectedFolder) {
      setSubfolders([]);
      return;
    }

    const loadSubdir = async () => {
      if (!nextcloudConnected) {
        // Provide mock subfolders if not connected
        if (selectedFolder.id === 'mock-gvt') {
          setSubfolders([
            {
              id: `${selectedFolder.path}/Benchmarks`,
              name: 'Benchmarks & Datasets',
              path: `${selectedFolder.path}/Benchmarks`,
              color: '#5856d6',
              papers: [
                {
                  id: 'bench-1',
                  title: 'QM9 Benchmark Results & VQ Codebook Evaluation',
                  authors: 'Clio Research 2026',
                  path: `${selectedFolder.path}/Benchmarks/QM9_Evaluation.pdf`,
                  downloadUrl: '',
                },
              ],
            },
          ]);
        } else {
          setSubfolders([]);
        }
        return;
      }

      setSubfoldersLoading(true);
      try {
        const dirs = await listDirectories(selectedFolder.path);
        const subData: FolderWithPapers[] = [];
        for (let i = 0; i < dirs.length; i++) {
          const d = dirs[i];
          const papers = await getPapersFromNextcloud(d.path).catch(() => []);
          subData.push({
            id: d.path,
            name: d.name,
            path: d.path,
            color: FOLDER_COLORS[(i + 3) % FOLDER_COLORS.length],
            papers,
          });
        }
        setSubfolders(subData);
      } catch (err) {
        console.error('Failed to list subdirectories:', err);
      } finally {
        setSubfoldersLoading(false);
      }
    };

    loadSubdir();
  }, [selectedFolder?.path, nextcloudConnected]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !userInput.trim() || !passInput.trim()) {
      return alert('Please fill in Server URL, Username, and Password.');
    }

    setIsConnecting(true);
    try {
      sessionStorage.setItem('nc_pass', passInput);
      setNextcloudConfig(urlInput, userInput);
      await connectNextcloudWithFallback(urlInput, userInput, passInput);
      setNextcloudConnectionState(true, 'connected', null);
    } catch (err: any) {
      alert(`Connection failed: ${err.message || err}`);
      setNextcloudConnectionState(false, 'failed', err.message || 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  // Open / Download paper directly into Clio Canvas
  const handleOpenPaper = async (paper: NextcloudPaper) => {
    const existing = files.find(f => f.remotePath === paper.path || f.name === `${paper.title}.pdf`);
    if (existing) {
      setActiveDocument(existing.id);
      setActiveView('canvas');
      return;
    }

    setDownloadingPath(paper.path);
    try {
      let dataUrl = '';
      if (nextcloudConnected && sessionStorage.getItem('nc_pass')) {
        dataUrl = await downloadPaperFromNextcloud(paper.path);
      }

      const newId = `file-${Date.now()}`;
      addFile({
        id: newId,
        name: `${paper.title}.pdf`,
        type: 'pdf',
        folderId: selectedFolder ? selectedFolder.id : null,
        dataUrl: dataUrl || undefined,
        remotePath: paper.path,
      });

      setActiveDocument(newId);
      setActiveView('canvas');
    } catch (err) {
      console.error('Failed to download paper:', err);
      const fallbackId = `file-${Date.now()}`;
      addFile({
        id: fallbackId,
        name: `${paper.title}.pdf`,
        type: 'pdf',
        folderId: selectedFolder ? selectedFolder.id : null,
      });
      setActiveDocument(fallbackId);
      setActiveView('canvas');
    } finally {
      setDownloadingPath(null);
    }
  };

  // Drill down into a subfolder
  const handleOpenFolder = (folder: FolderWithPapers) => {
    if (selectedFolder) {
      setFolderHistory(prev => [...prev, selectedFolder]);
    }
    setSelectedFolder(folder);
  };

  const handleGoBack = () => {
    if (folderHistory.length > 0) {
      const prev = folderHistory[folderHistory.length - 1];
      setFolderHistory(h => h.slice(0, -1));
      setSelectedFolder(prev);
    } else {
      setSelectedFolder(null);
    }
  };

  // Create Sticky Note in selected folder
  const handleCreateStickyNote = async () => {
    if (!selectedFolder || !stickyTitle.trim()) return;

    const stickyId = `sticky-${Date.now()}`;
    const filename = `${stickyTitle.trim()}.txt`;
    const textContent = `${stickyTitle.trim()}\n\n${stickyContent.trim()}`;
    const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(textContent)}`;

    const newStickyFile: NoteFile = {
      id: stickyId,
      name: stickyTitle.trim(),
      type: 'sticky',
      folderId: selectedFolder.id,
      remotePath: `${selectedFolder.path}/${filename}`,
      dataUrl,
      tags: [stickyColor],
    };

    addFile(newStickyFile);

    // Sync to Nextcloud if connected
    if (nextcloudConnected) {
      try {
        await uploadFileToNextcloud(filename, dataUrl, selectedFolder.path);
      } catch (err) {
        console.error('Failed to sync sticky note to Nextcloud:', err);
      }
    }

    setStickyTitle('');
    setStickyContent('');
    setShowStickyModal(false);
  };

  // Create Notepad in selected folder
  const handleCreateNotepad = async () => {
    if (!selectedFolder || !notepadTitle.trim()) return;
    const cleanTitle = notepadTitle.trim();

    if (notepadFormat === 'notebook') {
      const filename = `${cleanTitle}.notebook`;
      addNotebook(cleanTitle, null, selectedFolder.id, `${selectedFolder.path}/${filename}`);
      setShowNotepadModal(false);
      setNotepadTitle('');
      setActiveView('canvas');
    } else {
      const filename = `${cleanTitle}.md`;
      const docId = `doc-${Date.now()}`;
      const initialMarkdown = `# ${cleanTitle}\n\n*Created in ${selectedFolder.name}*\n\n`;
      const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(initialMarkdown)}`;

      addFile({
        id: docId,
        name: filename,
        type: 'md',
        folderId: selectedFolder.id,
        remotePath: `${selectedFolder.path}/${filename}`,
        dataUrl,
      });

      if (nextcloudConnected) {
        try {
          await uploadFileToNextcloud(filename, dataUrl, selectedFolder.path);
        } catch (err) {
          console.error('Failed to sync notepad to Nextcloud:', err);
        }
      }

      setShowNotepadModal(false);
      setNotepadTitle('');
      setActiveDocument(docId);
      setActiveView('canvas');
    }
  };

  // Create Subfolder
  const handleCreateSubfolder = async () => {
    if (!selectedFolder || !subfolderName.trim()) return;
    const cleanName = subfolderName.trim();
    const newPath = `${selectedFolder.path}/${cleanName}`;

    if (nextcloudConnected) {
      try {
        await createNextcloudDirectory(newPath);
      } catch (err) {
        console.error('Failed to create directory on Nextcloud:', err);
      }
    }

    const newSub: FolderWithPapers = {
      id: newPath,
      name: cleanName,
      path: newPath,
      color: FOLDER_COLORS[subfolders.length % FOLDER_COLORS.length],
      papers: [],
    };

    setSubfolders(prev => [...prev, newSub]);
    setSubfolderName('');
    setShowSubfolderModal(false);
  };

  // Filtered files belonging to selected folder
  const folderFiles = selectedFolder
    ? files.filter(
        f => f.folderId === selectedFolder.id || (f.remotePath && f.remotePath.startsWith(selectedFolder.path))
      )
    : [];

  const folderStickyNotes = folderFiles.filter(f => f.type === 'sticky');
  const folderNotepads = folderFiles.filter(
    f => f.type === 'notebook' || f.type === 'md' || f.type === 'txt'
  );

  const filteredFolders = folders
    .map(folder => {
      if (!searchQuery.trim()) return folder;
      const query = searchQuery.toLowerCase();
      const matchesFolder = folder.name.toLowerCase().includes(query);
      const matchedPapers = folder.papers.filter(p => p.title.toLowerCase().includes(query));
      if (matchesFolder) return folder;
      if (matchedPapers.length > 0) return { ...folder, papers: matchedPapers };
      return null;
    })
    .filter(Boolean) as FolderWithPapers[];

  return (
    <div
      className="workspace-view-container"
      style={{ gap: '28px', maxWidth: '1240px', margin: '0 auto', width: '100%' }}
    >
      {/* View Mode 1: Folder Detail View */}
      {selectedFolder ? (
        <div className="nextcloud-folder-detail">
          {/* Breadcrumb & Action Toolbar */}
          <div className="nextcloud-breadcrumb-bar">
            <button className="nextcloud-back-btn btn-animate" onClick={handleGoBack}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span>{folderHistory.length > 0 ? 'Back' : 'All Folders'}</span>
            </button>

            {/* Creation Action Pills */}
            <div className="nextcloud-actions-group">
              <button
                className="folder-action-pill sticky btn-animate"
                onClick={() => setShowStickyModal(true)}
              >
                <StickyNoteIcon width={14} height={14} />
                <span>+ New Sticky Note</span>
              </button>

              <button
                className="folder-action-pill notepad btn-animate"
                onClick={() => setShowNotepadModal(true)}
              >
                <NotebookIcon width={14} height={14} />
                <span>+ New Notepad</span>
              </button>

              <button
                className="folder-action-pill subfolder btn-animate"
                onClick={() => setShowSubfolderModal(true)}
              >
                <FolderIcon width={14} height={14} />
                <span>+ New Subfolder</span>
              </button>
            </div>
          </div>

          {/* Folder Header Banner Card */}
          <div className="folder-header-banner">
            <div className="folder-header-left">
              <div
                className="folder-header-icon-box"
                style={{ backgroundColor: `${selectedFolder.color}15`, color: selectedFolder.color }}
              >
                <FolderIcon width={28} height={28} />
              </div>
              <div>
                <h1 className="folder-header-title">{selectedFolder.name}</h1>
                <div className="folder-header-path">{selectedFolder.path}</div>
              </div>
            </div>

            <div className="folder-header-meta">
              <span className="folder-meta-tag">
                {selectedFolder.papers.length} {selectedFolder.papers.length === 1 ? 'Paper' : 'Papers'}
              </span>
              <span className="folder-meta-tag">
                {folderNotepads.length} {folderNotepads.length === 1 ? 'Notepad' : 'Notepads'}
              </span>
              <span className="folder-meta-tag">
                {folderStickyNotes.length} {folderStickyNotes.length === 1 ? 'Sticky' : 'Stickies'}
              </span>
            </div>
          </div>

          {/* 1. Subfolders Section (if any exist) */}
          {(subfolders.length > 0 || subfoldersLoading) && (
            <div>
              <div className="folder-section-title">
                <span>SUBFOLDERS ({subfolders.length})</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '24px 20px',
                  marginBottom: '28px',
                }}
              >
                {subfolders.map(sub => {
                  const items: FolderFloatItem[] = sub.papers.map(p => ({
                    id: p.id,
                    title: p.title,
                    type: 'pdf',
                    subtitle: p.authors || 'Paper',
                    onClick: () => handleOpenPaper(p),
                  }));

                  return (
                    <FolderFloat
                      key={sub.id}
                      id={sub.id}
                      label={sub.name}
                      sublabel={`${sub.papers.length} papers`}
                      color={sub.color}
                      items={items}
                      onOpenFolder={() => handleOpenFolder(sub)}
                      onSelectItem={item => {
                        const paper = sub.papers.find(p => p.id === item.id);
                        if (paper) handleOpenPaper(paper);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Research Papers (PDF) Section */}
          <div style={{ marginBottom: '28px' }}>
            <div className="folder-section-title">
              <span>RESEARCH PAPERS ({selectedFolder.papers.length})</span>
            </div>
            {selectedFolder.papers.length > 0 ? (
              <div className="papers-detail-grid">
                {selectedFolder.papers.map(paper => (
                  <div key={paper.id} className="paper-detail-card btn-animate">
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FileIcon width={18} height={18} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            lineHeight: 1.35,
                            marginBottom: 4,
                          }}
                        >
                          {paper.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {paper.authors}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 14,
                        paddingTop: 10,
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>PDF Document</span>
                      <button
                        onClick={() => handleOpenPaper(paper)}
                        style={{
                          background: 'var(--accent-color)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '5px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        className="btn-animate"
                      >
                        Read in Canvas
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '24px',
                  borderRadius: 12,
                  background: 'var(--bg-surface)',
                  border: '1px dashed var(--border-color)',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                No PDF papers in this folder yet.
              </div>
            )}
          </div>

          {/* 3. Notepads & Documents Section */}
          <div style={{ marginBottom: '28px' }}>
            <div className="folder-section-title">
              <span>NOTEPADS & DOCUMENTS ({folderNotepads.length})</span>
              <button
                onClick={() => setShowNotepadModal(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent-color)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                + New Notepad
              </button>
            </div>

            {folderNotepads.length > 0 ? (
              <div className="notepads-grid">
                {folderNotepads.map(np => (
                  <div
                    key={np.id}
                    className="notepad-card btn-animate"
                    onClick={() => {
                      if (np.type === 'notebook' && np.notebookPageIds && np.notebookPageIds.length > 0) {
                        setActiveDocument(np.notebookPageIds[0]);
                      } else {
                        setActiveDocument(np.id);
                      }
                      setActiveView('canvas');
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {np.type === 'notebook' ? (
                        <NotebookIcon width={18} height={18} stroke="#34c759" />
                      ) : (
                        <FileIcon width={18} height={18} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {np.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {np.type === 'notebook'
                            ? `${np.notebookPageIds?.length || 3} Ruled Pages`
                            : 'Markdown Note'}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 12,
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--accent-color)', fontWeight: 600 }}>
                        Open Canvas ›
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(`Delete '${np.name}'?`)) deleteFile(np.id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--danger-color)',
                          fontSize: 11,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '24px',
                  borderRadius: 12,
                  background: 'var(--bg-surface)',
                  border: '1px dashed var(--border-color)',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                No notepads created in this subfolder yet. Click "+ New Notepad" above to create one.
              </div>
            )}
          </div>

          {/* 4. Sticky Notes Board Section */}
          <div>
            <div className="folder-section-title">
              <span>STICKY NOTES ({folderStickyNotes.length})</span>
              <button
                onClick={() => setShowStickyModal(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#b45309',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                + Pin Note
              </button>
            </div>

            {folderStickyNotes.length > 0 ? (
              <div className="sticky-notes-grid">
                {folderStickyNotes.map(sticky => {
                  let bodyText = '';
                  if (sticky.dataUrl?.startsWith('data:text/plain;charset=utf-8,')) {
                    bodyText = decodeURIComponent(
                      sticky.dataUrl.replace('data:text/plain;charset=utf-8,', '')
                    );
                  } else {
                    bodyText = sticky.name;
                  }

                  const bgColor = sticky.tags?.[0] || STICKY_COLORS[0].value;

                  return (
                    <div
                      key={sticky.id}
                      className="sticky-note-card"
                      style={{ backgroundColor: bgColor }}
                    >
                      <div className="sticky-pin" />
                      <div className="sticky-title">{sticky.name}</div>
                      <div className="sticky-body">{bodyText}</div>
                      <div className="sticky-footer">
                        <span className="sticky-date">Subfolder Sticky</span>
                        <button
                          className="sticky-delete-btn"
                          onClick={() => {
                            if (confirm(`Delete sticky note '${sticky.name}'?`)) {
                              deleteFile(sticky.id);
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: '28px',
                  borderRadius: 12,
                  background: 'rgba(254, 240, 138, 0.15)',
                  border: '1px dashed rgba(245, 158, 11, 0.3)',
                  color: '#b45309',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                No sticky notes pinned yet. Click "+ New Sticky Note" to pin key takeaways or quick thoughts!
              </div>
            )}
          </div>
        </div>
      ) : (
        /* View Mode 2: Main Nextcloud Folder Float Grid */
        <>
          {/* Header Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--accent-color)',
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                  marginBottom: '2px',
                }}
              >
                RESEARCH REPOSITORY
              </div>
              <h1
                style={{
                  fontSize: '26px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.4px',
                }}
              >
                Nextcloud Paper Library
              </h1>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--text-muted)',
                  marginTop: '2px',
                  fontWeight: 400,
                }}
              >
                Hover over any folder to preview floating research papers, or click a folder to open its subfolders, sticky notes, and notepads.
              </p>
            </div>

            {/* Toolbar actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search folders & papers..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    padding: '8px 12px 8px 32px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    width: '220px',
                    outline: 'none',
                  }}
                />
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2.5"
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              {nextcloudConnected && (
                <button
                  onClick={loadLibrary}
                  disabled={loading}
                  style={{
                    background: 'var(--btn-secondary-bg)',
                    color: 'var(--btn-secondary-text)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: loading ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  className="btn-animate"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M23 4v6h-6M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  {loading ? 'Syncing…' : 'Refresh'}
                </button>
              )}
            </div>
          </div>

          {/* Connection Notice / Inline Connect */}
          {!nextcloudConnected ? (
            <div
              className="glass-card"
              style={{ padding: '24px', borderLeft: '4px solid var(--accent-color)' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Connect to Nextcloud Server
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    Enter your WebDAV credentials to sync research folders and stream papers directly.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'rgba(255, 149, 0, 0.15)',
                    color: '#ff9500',
                  }}
                >
                  Offline Mode
                </span>
              </div>

              <form
                onSubmit={handleConnect}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) auto',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <input
                  placeholder="Server URL"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
                <input
                  placeholder="Username"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={passInput}
                  onChange={e => setPassInput(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
                <button
                  type="submit"
                  disabled={isConnecting}
                  style={{
                    background: 'var(--accent-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isConnecting ? 'wait' : 'pointer',
                  }}
                  className="btn-animate"
                >
                  {isConnecting ? 'Connecting…' : 'Connect'}
                </button>
              </form>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--success-color)',
                  fontWeight: 600,
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success-color)' }} />
                Connected to Nextcloud
              </span>
              <span>•</span>
              <span>
                Remote Path:{' '}
                <code style={{ background: 'var(--bg-inset)', padding: '2px 6px', borderRadius: 4 }}>
                  {nextcloudPapersPath}
                </code>
              </span>
              {downloadingPath && (
                <span
                  style={{
                    color: 'var(--accent-color)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--accent-color)',
                      animation: 'pulse 1s infinite',
                    }}
                  />
                  Downloading {downloadingPath.split('/').pop()}...
                </span>
              )}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(255, 59, 48, 0.12)',
                border: '1px solid var(--danger-color)',
                borderRadius: 8,
                color: 'var(--danger-color)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Grid of FolderFloat Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '32px 24px',
              paddingBottom: '40px',
            }}
          >
            {filteredFolders.map(folder => {
              const items: FolderFloatItem[] = folder.papers.map(p => ({
                id: p.id,
                title: p.title,
                type: 'pdf',
                subtitle: p.authors || 'Nextcloud Research Paper',
                onClick: () => handleOpenPaper(p),
              }));

              return (
                <FolderFloat
                  key={folder.id}
                  id={folder.id}
                  label={folder.name}
                  sublabel={`${folder.papers.length} ${folder.papers.length === 1 ? 'paper' : 'papers'}`}
                  color={folder.color}
                  items={items}
                  onOpenFolder={() => handleOpenFolder(folder)}
                  onSelectItem={item => {
                    const paper = folder.papers.find(p => p.id === item.id);
                    if (paper) handleOpenPaper(paper);
                  }}
                />
              );
            })}
          </div>

          {filteredFolders.length === 0 && !loading && (
            <div
              className="glass-card"
              style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}
            >
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                No matching folders found
              </p>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                Try clearing your search query or sync more folders from Nextcloud.
              </p>
            </div>
          )}
        </>
      )}

      {/* Modal 1: Create Sticky Note */}
      {showStickyModal && (
        <div className="folder-modal-overlay" onClick={() => setShowStickyModal(false)}>
          <div className="folder-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                Pin Sticky Note
              </h3>
              <button
                onClick={() => setShowStickyModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 18,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                ✕
              </button>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Title
              </label>
              <input
                type="text"
                placeholder="Key Hypothesis, Paper Question..."
                value={stickyTitle}
                onChange={e => setStickyTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Note Content
              </label>
              <textarea
                rows={4}
                placeholder="Write your observation or reminder..."
                value={stickyContent}
                onChange={e => setStickyContent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  resize: 'vertical',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Sticky Color
              </label>
              <div className="color-swatch-picker">
                {STICKY_COLORS.map(c => (
                  <div
                    key={c.name}
                    className={`color-swatch-item ${stickyColor === c.value ? 'selected' : ''}`}
                    style={{ backgroundColor: c.value, borderColor: c.border }}
                    onClick={() => setStickyColor(c.value)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => setShowStickyModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateStickyNote}
                disabled={!stickyTitle.trim()}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#f59e0b',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !stickyTitle.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Pin Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Create Notepad */}
      {showNotepadModal && (
        <div className="folder-modal-overlay" onClick={() => setShowNotepadModal(false)}>
          <div className="folder-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                New Notepad in Subfolder
              </h3>
              <button
                onClick={() => setShowNotepadModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 18,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                ✕
              </button>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Notepad Name
              </label>
              <input
                type="text"
                placeholder="e.g. Experiment Notes, Research Log"
                value={notepadTitle}
                onChange={e => setNotepadTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Document Format
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div
                  onClick={() => setNotepadFormat('notebook')}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: `1.5px solid ${notepadFormat === 'notebook' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    background: notepadFormat === 'notebook' ? 'var(--accent-light)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                    <NotebookIcon width={16} height={16} stroke="#34c759" />
                    <span>Ruled Notebook</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Multi-page ruled canvas with drawing & annotations
                  </span>
                </div>

                <div
                  onClick={() => setNotepadFormat('md')}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: `1.5px solid ${notepadFormat === 'md' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    background: notepadFormat === 'md' ? 'var(--accent-light)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                    <FileIcon width={16} height={16} />
                    <span>Markdown Doc</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Structured text notes with headers and lists
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => setShowNotepadModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNotepad}
                disabled={!notepadTitle.trim()}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#16a34a',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !notepadTitle.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Create & Open
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Create Subfolder */}
      {showSubfolderModal && (
        <div className="folder-modal-overlay" onClick={() => setShowSubfolderModal(false)}>
          <div className="folder-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                Create Subfolder
              </h3>
              <button
                onClick={() => setShowSubfolderModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 18,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                ✕
              </button>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Subfolder Name
              </label>
              <input
                type="text"
                placeholder="e.g. Supplementary Materials, Code Artifacts"
                value={subfolderName}
                onChange={e => setSubfolderName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => setShowSubfolderModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubfolder}
                disabled={!subfolderName.trim()}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent-color)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !subfolderName.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NextcloudLibrary;
