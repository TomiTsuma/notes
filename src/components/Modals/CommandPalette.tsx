import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { Icon } from '../UI/clio';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface SearchHit {
  id: string;
  category: 'Quick Action' | 'Paper / PDF' | 'Annotation' | 'Mind Map' | 'Kanban Task';
  title: string;
  subtitle?: string;
  icon: string;
  onSelect: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const {
    files,
    papers,
    annotations,
    mindMapBoards,
    kanbanTasks,
    setActiveDocument,
    setActiveView,
    setActiveMindMapId,
    setTargetPdfPage,
    palmRejection,
    togglePalmRejection,
    splitViewMode,
    setSplitViewMode,
    toggleTheme,
    requestExportPdf,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const allHits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    const list: SearchHit[] = [];

    // 1. Files & PDFs
    for (const f of files) {
      list.push({
        id: `file-${f.id}`,
        category: 'Paper / PDF',
        title: f.name,
        subtitle: f.type === 'notebook' ? 'Notebook' : 'PDF Document · Open in Canvas',
        icon: f.type === 'notebook' ? 'notebook' : 'pdf',
        onSelect: () => {
          setActiveDocument(f.id);
          setActiveView('canvas');
          onClose();
        },
      });

      // Search annotations inside this file
      const docAnn = annotations[f.id];
      if (docAnn?.textElements) {
        for (const te of docAnn.textElements) {
          if (te.text && te.text.trim()) {
            list.push({
              id: `ann-${f.id}-${te.id}`,
              category: 'Annotation',
              title: te.text.slice(0, 90),
              subtitle: `In ${f.name} (${te.type === 'sticky' ? 'Sticky Note' : 'Text Note'})`,
              icon: 'sticky',
              onSelect: () => {
                setActiveDocument(f.id);
                setActiveView('canvas');
                onClose();
              },
            });
          }
        }
      }
    }

    // 2. Papers metadata (arXiv / DOI)
    for (const p of papers) {
      list.push({
        id: `paper-${p.id}`,
        category: 'Paper / PDF',
        title: p.title,
        subtitle: [p.authors, p.arxivId ? `arXiv:${p.arxivId}` : '', p.doi ? `DOI:${p.doi}` : '']
          .filter(Boolean)
          .join(' · '),
        icon: 'cloud',
        onSelect: () => {
          const matchingFile = files.find(
            (f) => f.id === p.id || f.name.toLowerCase().includes(p.title.slice(0, 20).toLowerCase())
          );
          if (matchingFile) {
            setActiveDocument(matchingFile.id);
            setActiveView('canvas');
          } else {
            setActiveView('nextcloud');
          }
          onClose();
        },
      });
    }

    // 3. Mind Map Boards & Nodes
    for (const b of mindMapBoards) {
      list.push({
        id: `board-${b.id}`,
        category: 'Mind Map',
        title: b.name,
        subtitle: `Mind Map Board · ${b.nodes.length} nodes`,
        icon: 'mindmap',
        onSelect: () => {
          setActiveMindMapId(b.id);
          setActiveView('mindmap');
          onClose();
        },
      });
      for (const n of b.nodes) {
        list.push({
          id: `mmnode-${b.id}-${n.id}`,
          category: 'Mind Map',
          title: n.title || 'Untitled Node',
          subtitle: `${b.name} · ${n.content ? n.content.slice(0, 70) : n.type}${n.linkedPage ? ` · p.${n.linkedPage}` : ''}`,
          icon: 'mindmap',
          onSelect: () => {
            if (n.linkedFileId && n.linkedPage) {
              setActiveDocument(n.linkedFileId);
              setActiveView('canvas');
              setTargetPdfPage({ docId: n.linkedFileId, page: n.linkedPage });
            } else {
              setActiveMindMapId(b.id);
              setActiveView('mindmap');
            }
            onClose();
          },
        });
      }
    }

    // 4. Kanban Tasks
    for (const t of kanbanTasks) {
      list.push({
        id: `task-${t.id}`,
        category: 'Kanban Task',
        title: t.title,
        subtitle: `${t.status.toUpperCase()} · ${t.description?.slice(0, 70) || ''}`,
        icon: 'kanban',
        onSelect: () => {
          setActiveView('kanban');
          onClose();
        },
      });
    }

    // 5. Quick Actions
    list.push(
      {
        id: 'act-touch-scroll',
        category: 'Quick Action',
        title: `Toggle Touch Scroll (Currently ${palmRejection ? 'ON' : 'OFF'})`,
        subtitle: 'Touch anywhere on PDF to scroll; stylus draws',
        icon: 'hand',
        onSelect: () => {
          togglePalmRejection();
          onClose();
        },
      },
      {
        id: 'act-split-mindmap',
        category: 'Quick Action',
        title: splitViewMode === 'mindmap' ? 'Close Split View' : 'Split Screen: PDF + Mind Map',
        subtitle: 'Read PDF on the left and build Mind Map on the right',
        icon: 'mindmap',
        onSelect: () => {
          setActiveView('canvas');
          setSplitViewMode(splitViewMode === 'mindmap' ? 'none' : 'mindmap');
          onClose();
        },
      },
      {
        id: 'act-split-notebook',
        category: 'Quick Action',
        title: splitViewMode === 'notebook' ? 'Close Split View' : 'Split Screen: PDF + Notebook',
        subtitle: 'Read PDF on the left and write in Notebook on the right',
        icon: 'notebook',
        onSelect: () => {
          setActiveView('canvas');
          setSplitViewMode(splitViewMode === 'notebook' ? 'none' : 'notebook');
          onClose();
        },
      },
      {
        id: 'act-export-pdf',
        category: 'Quick Action',
        title: 'Export Annotated PDF',
        subtitle: 'Download current PDF with flattened highlights, pen strokes, and notes',
        icon: 'download',
        onSelect: () => {
          setActiveView('canvas');
          requestExportPdf();
          onClose();
        },
      },
      {
        id: 'act-theme',
        category: 'Quick Action',
        title: 'Toggle Light / Dark Theme',
        subtitle: 'Switch workspace appearance',
        icon: 'sun',
        onSelect: () => {
          toggleTheme();
          onClose();
        },
      }
    );

    if (!q) return list.slice(0, 18);
    return list
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [
    query,
    files,
    papers,
    annotations,
    mindMapBoards,
    kanbanTasks,
    palmRejection,
    splitViewMode,
    setActiveDocument,
    setActiveView,
    setActiveMindMapId,
    setTargetPdfPage,
    togglePalmRejection,
    setSplitViewMode,
    toggleTheme,
    requestExportPdf,
    onClose,
  ]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9600,
        background: 'rgba(15, 14, 12, 0.5)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '92%',
          maxWidth: 620,
          background: 'var(--surface-raised, #ffffff)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <Icon name="search" size={18} className="cl-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx((i) => Math.min(allHits.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && allHits[selectedIdx]) {
                e.preventDefault();
                allHits[selectedIdx].onSelect();
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Search papers, DOIs, PDF notes, Mind Map nodes, tasks, or commands…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: 'var(--ink)',
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'var(--surface-inset)',
              border: '1px solid var(--line)',
              color: 'var(--ink-3)',
            }}
          >
            ESC
          </kbd>
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto', padding: 8 }}>
          {allHits.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No matching papers, annotations, or Mind Map nodes found.
            </div>
          ) : (
            allHits.map((hit, idx) => {
              const active = idx === selectedIdx;
              return (
                <div
                  key={hit.id}
                  onClick={hit.onSelect}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: active ? 'rgba(10, 122, 255, 0.1)' : 'transparent',
                  }}
                >
                  <Icon name={hit.icon} size={17} className="cl-muted" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {hit.title}
                    </div>
                    {hit.subtitle && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--ink-3)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {hit.subtitle}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: 99,
                      background: 'var(--surface-inset)',
                      color: 'var(--ink-2)',
                    }}
                  >
                    {hit.category}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
