import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  connectNextcloudWithFallback,
  listDirectories,
  getPapersFromNextcloud,
  downloadPaperFromNextcloud,
  uploadFileToNextcloud,
  fetchAndUploadArxivPaper,
  lookupPaperByIdentifier,
  fetchPaperBibtex,
  fetchPaperCitations,
  createNextcloudDirectory,
  normalizeRemotePath,
  getParentRemotePath,
  type NextcloudPaper,
  type NextcloudDirectory,
  type PaperLookupResult,
  type CitationItem,
} from '../../services/nextcloud';
import {
  ViewHeader,
  SectionHeader,
  QuickActions,
  FolderCard,
  PaperCard,
  SegmentedControl,
  SearchField,
  Button,
  IconButton,
  Modal,
  TextField,
  ConnectionForm,
} from '../UI/clio';

const NextcloudLibrary: React.FC = () => {
  const {
    nextcloudUrl,
    nextcloudUsername,
    nextcloudConnected,
    nextcloudError,
    setNextcloudConfig,
    setNextcloudConnectionState,
    addFile,
    setActiveDocument,
    setActiveView,
    files,
    mindMapBoards,
    activeMindMapId,
    updateMindMapBoard,
  } = useAppStore();

  const [bibtexModal, setBibtexModal] = useState<{ title: string; bibtex: string; apa: string } | null>(null);
  const [citationModal, setCitationModal] = useState<{
    paperTitle: string;
    loading: boolean;
    references: CitationItem[];
    citations: CitationItem[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPath, setCurrentPath] = useState('/');
  const [dirs, setDirs] = useState<NextcloudDirectory[]>([]);
  const [papers, setPapers] = useState<NextcloudPaper[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  const [showArxivModal, setShowArxivModal] = useState(false);
  const [arxivIdInput, setArxivIdInput] = useState('');
  const [isImportingArxiv, setIsImportingArxiv] = useState(false);
  const [isSearchingPaper, setIsSearchingPaper] = useState(false);
  const [paperPreview, setPaperPreview] = useState<PaperLookupResult | null>(null);
  const [arxivError, setArxivError] = useState<string | null>(null);

  const [showConnModal, setShowConnModal] = useState(false);
  const [connPass, setConnPass] = useState(() => sessionStorage.getItem('nc_pass') || '');
  const [isConnecting, setIsConnecting] = useState(false);

  // Auto-connect attempt on mount if credentials exist in sessionStorage
  useEffect(() => {
    const savedPass = sessionStorage.getItem('nc_pass');
    if (savedPass && nextcloudUrl && nextcloudUsername && !nextcloudConnected) {
      setConnPass(savedPass);
      handleConnect(nextcloudUrl, nextcloudUsername, savedPass);
    }
  }, []);

  // Fetch directory contents whenever currentPath or connection state changes
  const loadPathContents = async (path: string) => {
    setLoadingItems(true);
    setLoadError(null);
    try {
      const normalized = normalizeRemotePath(path);
      const [dirItems, paperItems] = await Promise.all([
        listDirectories(normalized),
        getPapersFromNextcloud(normalized),
      ]);
      setDirs(dirItems);
      setPapers(paperItems);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load Nextcloud directory contents.');
      setDirs([]);
      setPapers([]);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (nextcloudConnected) {
      loadPathContents(currentPath);
    }
  }, [currentPath, nextcloudConnected]);

  const handleConnect = async (url: string, user: string, pass: string) => {
    if (!url.trim() || !user.trim() || !pass.trim()) {
      alert('Please provide Nextcloud server URL, username, and password.');
      return;
    }
    setIsConnecting(true);
    setNextcloudConfig(url, user);
    setNextcloudConnectionState(false, 'connecting', null);

    try {
      sessionStorage.setItem('nc_pass', pass);
      await connectNextcloudWithFallback(url, user, pass);
      setNextcloudConnectionState(true, 'connected', null);
      setShowConnModal(false);
      loadPathContents(currentPath);
    } catch (err: any) {
      setNextcloudConnectionState(false, 'failed', err?.message || 'Connection failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOpenPaper = async (paper: NextcloudPaper) => {
    try {
      let existingFile = files.find((f) => f.remotePath === paper.path || f.name === paper.title + '.pdf');
      if (!existingFile) {
        const dataUrl = await downloadPaperFromNextcloud(paper.path);
        const newFileId = 'file-' + Date.now();
        addFile({
          id: newFileId,
          name: paper.title + '.pdf',
          type: 'pdf',
          folderId: null,
          dataUrl,
          remotePath: paper.path,
        });
        setActiveDocument(newFileId);
      } else {
        if (!existingFile.dataUrl) {
          const dataUrl = await downloadPaperFromNextcloud(paper.path);
          useAppStore.getState().updateFile(existingFile.id, { dataUrl });
        }
        setActiveDocument(existingFile.id);
      }
      setActiveView('canvas');
    } catch (err: any) {
      alert(`Error opening paper: ${err?.message || 'Download failed.'}`);
    }
  };

  const handleLookupPaper = async () => {
    if (!arxivIdInput.trim()) return;
    setIsSearchingPaper(true);
    setArxivError(null);
    setPaperPreview(null);
    try {
      const result = await lookupPaperByIdentifier(arxivIdInput.trim());
      setPaperPreview(result);
    } catch (err: any) {
      setArxivError(err?.message || 'Could not find paper for the given arXiv ID or DOI.');
    } finally {
      setIsSearchingPaper(false);
    }
  };

  const handleImportArxiv = async () => {
    if (!arxivIdInput.trim()) return;
    setIsImportingArxiv(true);
    setArxivError(null);
    try {
      const paper = await fetchAndUploadArxivPaper(arxivIdInput.trim(), currentPath);
      if (paper) {
        addFile({
          id: 'file-' + Date.now(),
          name: paper.filename,
          type: 'pdf',
          folderId: null,
          dataUrl: paper.dataUrl,
          remotePath: paper.remotePath,
        });
        setShowArxivModal(false);
        setArxivIdInput('');
        setPaperPreview(null);
        loadPathContents(currentPath);
      } else {
        setArxivError('Failed to fetch paper metadata.');
      }
    } catch (err: any) {
      setArxivError(err?.message || 'Error downloading paper.');
    } finally {
      setIsImportingArxiv(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt('New folder name:');
    if (!name?.trim()) return;
    try {
      const newDirPath = normalizeRemotePath(`${currentPath}/${name.trim()}`);
      await createNextcloudDirectory(newDirPath);
      loadPathContents(currentPath);
    } catch (err: any) {
      alert(`Failed to create directory: ${err?.message || 'Error'}`);
    }
  };

  const handleFileUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const remotePath = await uploadFileToNextcloud(file.name, dataUrl, currentPath);
        addFile({
          id: 'file-' + Date.now(),
          name: file.name,
          type: file.name.endsWith('.pdf') ? 'pdf' : 'notebook',
          folderId: null,
          dataUrl,
          remotePath,
        });
        loadPathContents(currentPath);
      } catch (err: any) {
        alert(`Upload error: ${err?.message || 'Failed'}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const quickItems = [
    {
      icon: 'arxiv',
      label: 'Import arXiv / DOI',
      tone: 'rose',
      onClick: () => {
        setArxivError(null);
        setPaperPreview(null);
        setShowArxivModal(true);
      },
    },
    {
      icon: 'upload',
      label: 'Upload PDF',
      tone: 'sky',
      onClick: () => fileInputRef.current?.click(),
    },
    {
      icon: 'folder-plus',
      label: 'New subfolder',
      tone: 'stone',
      onClick: handleCreateFolder,
    },
    {
      icon: 'sync',
      label: nextcloudConnected ? 'Connection settings' : 'Connect Nextcloud',
      tone: 'amber',
      onClick: () => setShowConnModal(true),
    },
  ];

  const parentPath = getParentRemotePath(currentPath);

  const extractDoiFromTitle = (title: string): string | undefined => {
    const m = title.match(/(10\.\d{4,9})[/_]([-._;()/:A-Za-z0-9]+)/);
    if (!m) return undefined;
    return `${m[1]}/${m[2].replace(/_/g, '/')}`;
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedSearchDoi = normalizedSearch
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(export\.)?arxiv\.org\/(abs|pdf)\//i, '')
    .replace(/^arxiv:\s*/i, '');

  const filteredDirs = dirs.filter((d) => d.name.toLowerCase().includes(normalizedSearch));
  const filteredPapers = papers.filter((p) => {
    if (!normalizedSearch) return true;
    const t = p.title.toLowerCase();
    const a = (p.authors || '').toLowerCase();
    const tNormalizedSlashes = t.replace(/_/g, '/');
    return (
      t.includes(normalizedSearch) ||
      a.includes(normalizedSearch) ||
      tNormalizedSlashes.includes(normalizedSearchDoi) ||
      t.includes(normalizedSearchDoi.replace(/\//g, '_'))
    );
  });

  return (
    <div className="cl-view" style={{ padding: '32px 40px', width: '100%', boxSizing: 'border-box' }}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".pdf"
        onChange={handleFileUploadChange}
      />

      {/* View Header with Live Breadcrumb Path */}
      <ViewHeader
        overline={`Nextcloud · ${currentPath}`}
        title="Library"
        subtitle={
          nextcloudConnected
            ? `Connected to ${nextcloudUrl} as ${nextcloudUsername} · ${dirs.length} folders · ${papers.length} papers`
            : 'Nextcloud not connected — click Connection below to connect.'
        }
        actions={
          <>
            <SearchField
              placeholder="Search by title, arXiv ID, or DOI…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 260 }}
            />
            <Button icon="sync" onClick={() => setShowConnModal(true)}>
              {nextcloudConnected ? 'Connection' : 'Connect'}
            </Button>
          </>
        }
      />

      <div style={{ marginTop: 20 }}>
        <QuickActions items={quickItems} />
      </div>

      {/* Path Navigation Bar */}
      <div
        className="cl-row"
        style={{
          marginTop: 20,
          padding: '8px 14px',
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--line)',
          gap: 12,
        }}
      >
        {currentPath !== '/' && (
          <IconButton icon="chevron-left" label="Up folder" onClick={() => setCurrentPath(parentPath)} outlined />
        )}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Path:</span>
        <span className="cl-mono" style={{ fontSize: 13, color: 'var(--accent)' }}>
          {currentPath}
        </span>
      </div>

      {loadingItems && (
        <div style={{ padding: '24px 0', fontSize: 14, color: 'var(--ink-2)' }}>
          Loading Nextcloud files for <code>{currentPath}</code>…
        </div>
      )}

      {loadError && (
        <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--danger)' }}>
          Nextcloud error: {loadError}
        </div>
      )}

      {!nextcloudConnected && (
        <div
          style={{
            marginTop: 24,
            padding: 32,
            textAlign: 'center',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--radius-lg)',
            border: '1px border-dashed var(--line)',
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--ink)' }}>Connect to Nextcloud</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-2)' }}>
            Access research papers, subfolders, and sync files directly from your Nextcloud server.
          </p>
          <Button variant="primary" icon="sync" onClick={() => setShowConnModal(true)}>
            {nextcloudUrl ? `Connect Server (${nextcloudUrl})` : 'Connect Nextcloud'}
          </Button>
        </div>
      )}

      {nextcloudConnected && !loadingItems && (
        <>
          {/* Directories Section */}
          <div className="cl-section" style={{ marginTop: 24 }}>
            <SectionHeader title="Folders" count={filteredDirs.length} />
            {filteredDirs.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, paddingTop: 8 }}>
                {filteredDirs.map((dir) => (
                  <FolderCard
                    key={dir.path}
                    name={dir.name}
                    count="Folder"
                    tone="sky"
                    onClick={() => setCurrentPath(dir.path)}
                  />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '8px 0 0' }}>No subfolders in this directory.</p>
            )}
          </div>

          {/* Papers / Files Section */}
          <div className="cl-section" style={{ marginTop: 28 }}>
            <SectionHeader
              title="Papers & Files"
              count={filteredPapers.length}
              actions={
                <SegmentedControl
                  iconOnly
                  value={layoutMode}
                  onChange={(v) => setLayoutMode(v as any)}
                  options={[
                    { value: 'grid', label: 'Grid', icon: 'grid' },
                    { value: 'list', label: 'List', icon: 'list' },
                  ]}
                />
              }
            />

            {filteredPapers.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: layoutMode === 'grid' ? '1fr 1fr' : '1fr',
                  gap: 16,
                  marginTop: 12,
                }}
              >
                {filteredPapers.map((p) => {
                  const pArxiv = p.title.match(/\d{4}\.\d{4,5}/)?.[0];
                  const pDoi = extractDoiFromTitle(p.title);
                  return (
                    <PaperCard
                      key={p.id}
                      title={p.title}
                      authors={p.authors}
                      arxiv={pArxiv}
                      doi={pDoi}
                      status="remote"
                      onClick={() => handleOpenPaper(p)}
                      onCopyBibtex={async () => {
                        try {
                          const res = await fetchPaperBibtex({
                            title: p.title,
                            authors: p.authors,
                            arxivId: pArxiv,
                            doi: pDoi,
                          });
                          navigator.clipboard?.writeText(res.bibtex).catch(() => {});
                          setBibtexModal({ title: p.title, bibtex: res.bibtex, apa: res.apa });
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      onOpenCitations={async () => {
                        setCitationModal({
                          paperTitle: p.title,
                          loading: true,
                          references: [],
                          citations: [],
                        });
                        try {
                          const res = await fetchPaperCitations({
                            title: p.title,
                            arxivId: pArxiv,
                            doi: pDoi,
                          });
                          setCitationModal({
                            paperTitle: p.title,
                            loading: false,
                            references: res.references || [],
                            citations: res.citations || [],
                          });
                        } catch {
                          setCitationModal((prev) => (prev ? { ...prev, loading: false } : null));
                        }
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  marginTop: 12,
                  padding: 24,
                  textAlign: 'center',
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--ink-2)',
                  fontSize: 13,
                }}
              >
                {searchQuery.trim() ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div>
                      No papers in <code>{currentPath}</code> matched <b>"{searchQuery.trim()}"</b>.
                    </div>
                    <Button
                      variant="primary"
                      icon="arxiv"
                      onClick={() => {
                        setArxivIdInput(searchQuery.trim());
                        setArxivError(null);
                        setPaperPreview(null);
                        setShowArxivModal(true);
                      }}
                    >
                      Search & Import "{searchQuery.trim()}" via arXiv / DOI
                    </Button>
                  </div>
                ) : (
                  <>
                    No PDF papers found in <code>{currentPath}</code>. Click <b>Upload PDF</b> or <b>Import arXiv / DOI</b> above to add papers to this folder.
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Connection Modal */}
      {showConnModal && (
        <Modal
          title="Nextcloud Server Connection"
          description="Enter your Nextcloud server URL and account credentials."
          onClose={() => setShowConnModal(false)}
        >
          <ConnectionForm
            serverUrl={nextcloudUrl || ''}
            username={nextcloudUsername || ''}
            password={connPass}
            connected={nextcloudConnected}
            busy={isConnecting}
            error={nextcloudError}
            onConnect={(url: string, user: string, pass: string) => handleConnect(url, user, pass)}
          />
        </Modal>
      )}

      {/* ArXiv / DOI Import Modal */}
      {showArxivModal && (
        <Modal
          title="Search & Import Paper (arXiv or DOI)"
          description={`Search by arXiv ID or DOI and download the PDF directly into Nextcloud (${currentPath}).`}
          onClose={() => setShowArxivModal(false)}
          footer={
            <>
              <Button onClick={() => setShowArxivModal(false)}>Cancel</Button>
              <Button onClick={handleLookupPaper} disabled={isSearchingPaper || isImportingArxiv || !arxivIdInput.trim()}>
                {isSearchingPaper ? 'Searching…' : 'Search Metadata'}
              </Button>
              <Button variant="primary" icon="arxiv" onClick={handleImportArxiv} disabled={isImportingArxiv || !arxivIdInput.trim()}>
                {isImportingArxiv ? 'Downloading…' : 'Import & Save'}
              </Button>
            </>
          }
        >
          <TextField
            label="arXiv ID, DOI, or URL"
            placeholder="e.g. 2512.02667, 10.1038/nature14539, or https://doi.org/..."
            value={arxivIdInput}
            onChange={(e) => {
              setArxivIdInput(e.target.value);
              if (paperPreview) setPaperPreview(null);
            }}
            error={arxivError || undefined}
          />
          {paperPreview && (
            <div
              style={{
                marginTop: 12,
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-inset)',
                border: '1px solid var(--line)',
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{paperPreview.title}</div>
              <div style={{ color: 'var(--ink-2)', fontSize: 12, marginBottom: 6 }}>{paperPreview.authors}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11 }} className="cl-mono cl-faint">
                {paperPreview.arxivId && <span>arXiv:{paperPreview.arxivId}</span>}
                {paperPreview.doi && <span>DOI:{paperPreview.doi}</span>}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* BibTeX & Citation Copy Modal */}
      {bibtexModal && (
        <Modal
          title="BibTeX & Formatted Citation"
          description="Copied to clipboard! You can also copy the BibTeX or APA citation below."
          onClose={() => setBibtexModal(null)}
          footer={
            <>
              <Button
                icon="copy"
                onClick={() => {
                  navigator.clipboard?.writeText(bibtexModal.apa);
                }}
              >
                Copy APA
              </Button>
              <Button
                variant="primary"
                icon="copy"
                onClick={() => {
                  navigator.clipboard?.writeText(bibtexModal.bibtex);
                  setBibtexModal(null);
                }}
              >
                Copy BibTeX & Done
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 4 }}>BIBTEX</div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--surface-inset)',
                  border: '1px solid var(--line)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  overflowX: 'auto',
                }}
              >
                {bibtexModal.bibtex}
              </pre>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 4 }}>APA CITATION</div>
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: 'var(--surface-inset)',
                  border: '1px solid var(--line)',
                  fontSize: 12.5,
                  color: 'var(--ink-2)',
                }}
              >
                {bibtexModal.apa}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Citation Graph Discovery Modal */}
      {citationModal && (
        <Modal
          title="Citation Graph Discovery"
          description={`Referenced papers and citing papers for "${citationModal.paperTitle.slice(0, 64)}"`}
          onClose={() => setCitationModal(null)}
          footer={
            <Button variant="primary" onClick={() => setCitationModal(null)}>
              Close
            </Button>
          }
        >
          {citationModal.loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)', fontSize: 13 }}>
              Querying Semantic Scholar & OpenAlex citation graph…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 420, overflowY: 'auto' }}>
              <div>
                <h5 style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--ink-2)' }}>
                  Cited References ({citationModal.references.length})
                </h5>
                {citationModal.references.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No open citation references found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {citationModal.references.map((item, i) => (
                      <div
                        key={`ref-${i}`}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'var(--surface-inset)',
                          border: '1px solid var(--line)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                            {item.authors} {item.year ? `· ${item.year}` : ''}
                            {item.arxivId ? ` · arXiv:${item.arxivId}` : ''}
                            {item.doi ? ` · DOI:${item.doi}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="mindmap"
                            onClick={() => {
                              const board = mindMapBoards.find((b) => b.id === activeMindMapId) || mindMapBoards[0];
                              if (!board) return;
                              updateMindMapBoard(board.id, {
                                nodes: [
                                  ...board.nodes,
                                  {
                                    id: `mm-cite-${Date.now()}-${i}`,
                                    type: 'paper',
                                    x: 420 + (i % 3) * 260,
                                    y: 280 + Math.floor(i / 3) * 160,
                                    width: 260,
                                    title: item.title,
                                    content: [
                                      item.authors,
                                      item.arxivId ? `arXiv:${item.arxivId}` : '',
                                      item.doi ? `DOI:${item.doi}` : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' · '),
                                    color: 'sky',
                                    linkedPaperTitle: item.title,
                                    linkedPaperAuthors: item.authors,
                                  },
                                ],
                              });
                            }}
                          >
                            + Mind Map
                          </Button>
                          {(item.arxivId || item.doi) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setCitationModal(null);
                                setArxivIdInput(item.arxivId || item.doi || '');
                                setShowArxivModal(true);
                              }}
                            >
                              Import PDF
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h5 style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--ink-2)' }}>
                  Cited By ({citationModal.citations.length})
                </h5>
                {citationModal.citations.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No citing papers found yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {citationModal.citations.map((item, i) => (
                      <div
                        key={`cit-${i}`}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'var(--surface-inset)',
                          border: '1px solid var(--line)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                            {item.authors} {item.year ? `· ${item.year}` : ''}
                            {item.arxivId ? ` · arXiv:${item.arxivId}` : ''}
                            {item.doi ? ` · DOI:${item.doi}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="mindmap"
                            onClick={() => {
                              const board = mindMapBoards.find((b) => b.id === activeMindMapId) || mindMapBoards[0];
                              if (!board) return;
                              updateMindMapBoard(board.id, {
                                nodes: [
                                  ...board.nodes,
                                  {
                                    id: `mm-citing-${Date.now()}-${i}`,
                                    type: 'paper',
                                    x: 420 + (i % 3) * 260,
                                    y: 480 + Math.floor(i / 3) * 160,
                                    width: 260,
                                    title: item.title,
                                    content: [
                                      item.authors,
                                      item.arxivId ? `arXiv:${item.arxivId}` : '',
                                      item.doi ? `DOI:${item.doi}` : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' · '),
                                    color: 'sage',
                                    linkedPaperTitle: item.title,
                                    linkedPaperAuthors: item.authors,
                                  },
                                ],
                              });
                            }}
                          >
                            + Mind Map
                          </Button>
                          {(item.arxivId || item.doi) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setCitationModal(null);
                                setArxivIdInput(item.arxivId || item.doi || '');
                                setShowArxivModal(true);
                              }}
                            >
                              Import PDF
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default NextcloudLibrary;
