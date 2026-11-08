import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import DrawingCanvas from './DrawingCanvas';
import TextLayerOverlay from './TextLayer';
import { Tag } from '../UI/clio';

const DEFAULT_META = {
  pageWidth: 800,
  pageHeight: 1130,
  lineSpacing: 32,
  lineColor: '#d4d4d8',
  marginColor: '#ffcccc',
};

const NotebookViewer: React.FC = () => {
  const {
    activeDocumentId,
    files,
    annotations,
    activeTool,
    addNotebook,
    addNotebookPage,
    deleteNotebookPage,
    setActiveDocument,
    updateFile,
    deleteFile,
    addTextElement,
    updateTextElement,
    palmRejection,
    tags,
    addTag,
    setFileTags,
  } = useAppStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [writeMode, setWriteMode] = useState<'type' | 'draw'>('type');

  // Switch to 'draw' automatically when user picks an ink/annotation tool from ToolPalette
  useEffect(() => {
    if (['pen', 'pencil', 'highlighter', 'eraser', 'ruler', 'text', 'sticky'].includes(activeTool)) {
      setWriteMode('draw');
    }
  }, [activeTool]);

  const allNotebooks = files.filter((f) => f.type === 'notebook');

  // Find the notebook file that owns activeDocumentId (either by notebook ID or page ID),
  // or fall back to selectedNotebookId / first available notebook
  const matchedByActiveDoc = files.find(
    (f) =>
      f.type === 'notebook' &&
      (f.id === activeDocumentId || (f.notebookPageIds || []).includes(activeDocumentId || ''))
  );

  const notebookFile =
    matchedByActiveDoc ||
    allNotebooks.find((f) => f.id === selectedNotebookId) ||
    allNotebooks[0] ||
    null;

  // Auto-heal legacy notebooks that were created without notebookPageIds
  useEffect(() => {
    if (!notebookFile) return;
    if (!notebookFile.notebookPageIds || notebookFile.notebookPageIds.length === 0) {
      const generatedPages = Array.from({ length: 3 }, (_, i) => `${notebookFile.id}-pg-${i + 1}`);
      updateFile(notebookFile.id, {
        notebookPageIds: generatedPages,
        notebookMeta: notebookFile.notebookMeta || DEFAULT_META,
      });
      setActiveDocument(generatedPages[0]);
    } else if (activeDocumentId === notebookFile.id) {
      // If activeDocumentId was set to the notebook's file ID, point it to the first page
      setActiveDocument(notebookFile.notebookPageIds[0]);
    }
  }, [notebookFile?.id, notebookFile?.notebookPageIds?.length, activeDocumentId, updateFile, setActiveDocument]);

  useEffect(() => {
    if (notebookFile?.id && notebookFile.id !== selectedNotebookId) {
      setSelectedNotebookId(notebookFile.id);
    }
  }, [notebookFile?.id]);

  const pageIds =
    notebookFile?.notebookPageIds && notebookFile.notebookPageIds.length > 0
      ? notebookFile.notebookPageIds
      : notebookFile
      ? [`${notebookFile.id}-pg-1`, `${notebookFile.id}-pg-2`, `${notebookFile.id}-pg-3`]
      : [];

  const meta = notebookFile?.notebookMeta || DEFAULT_META;

  // Track which page is most visible using IntersectionObserver
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || pageIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let maxId = '';
        entries.forEach((entry) => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            maxId = entry.target.getAttribute('data-page-id') || '';
          }
        });
        if (maxId && maxRatio > 0.3) {
          const idx = pageIds.indexOf(maxId);
          if (idx >= 0) setCurrentPageIdx(idx);
        }
      },
      { root: container, threshold: [0, 0.1, 0.3, 0.5, 0.7, 1.0] }
    );

    pageIds.forEach((id) => {
      const el = pageRefs.current[id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pageIds.join(',')]);

  // Set activeDocumentId to the page when user clicks/touches it
  const handlePagePointerDown = useCallback(
    (pageId: string) => {
      if (activeDocumentId !== pageId) {
        useAppStore.setState({ activeDocumentId: pageId });
      }
      const idx = pageIds.indexOf(pageId);
      if (idx >= 0) setCurrentPageIdx(idx);
    },
    [activeDocumentId, pageIds]
  );

  const handleCreateNewNotebook = () => {
    const name = prompt('New notebook title:', 'Research Notes');
    if (!name || !name.trim()) return;
    const newId = addNotebook(name.trim());
    setSelectedNotebookId(newId);
  };

  const handleRenameNotebook = () => {
    if (!notebookFile) return;
    const currentTitle = notebookFile.name.replace(/\.notebook$/i, '');
    const nextTitle = prompt('Rename notebook:', currentTitle);
    if (!nextTitle || !nextTitle.trim()) return;
    updateFile(notebookFile.id, {
      name: nextTitle.trim().endsWith('.notebook') ? nextTitle.trim() : `${nextTitle.trim()}.notebook`,
    });
  };

  const handleDeleteCurrentNotebook = () => {
    if (!notebookFile) return;
    const displayName = notebookFile.name.replace(/\.notebook$/i, '');
    if (confirm(`Delete notebook "${displayName}" and all its pages?`)) {
      deleteFile(notebookFile.id);
    }
  };

  const handleAddPage = () => {
    if (!notebookFile) return;
    addNotebookPage(notebookFile.id);
    setTimeout(() => {
      const container = scrollContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }, 50);
  };

  const handleDeletePage = (pageId: string) => {
    if (!notebookFile) return;
    if (pageIds.length <= 1) return;
    if (confirm('Delete this page and all its annotations?')) {
      deleteNotebookPage(notebookFile.id, pageId);
    }
  };

  const scrollToPage = (idx: number) => {
    const pageId = pageIds[idx];
    if (!pageId) return;
    const el = pageRefs.current[pageId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setCurrentPageIdx(idx);
  };

  const handleLinedNoteChange = (pageId: string, val: string) => {
    const linedId = `${pageId}-lined-notes`;
    const existing = annotations[pageId]?.textElements?.find((t) => t.id === linedId);
    if (existing) {
      updateTextElement(pageId, linedId, val);
    } else {
      addTextElement(pageId, {
        id: linedId,
        x: 88,
        y: 32,
        text: val,
        type: 'text',
      });
    }
  };

  const currentFileTags = (notebookFile?.tags || []).map((tagName) => {
    const found = tags.find((t) => t.name === tagName);
    return { name: tagName, color: found?.color || 'sky' };
  });

  const handleAddTag = () => {
    if (!notebookFile) return;
    const name = prompt('Tag name:');
    if (!name) return;
    const clean = name.replace(/^#/, '').trim();
    if (!clean) return;
    addTag({ id: 'tag-' + Date.now(), name: clean, color: 'sky', createdAt: new Date().toISOString() });
    setFileTags(notebookFile.id, [...(notebookFile.tags || []), clean]);
  };

  const handleRemoveTag = (tagName: string) => {
    if (!notebookFile) return;
    setFileTags(
      notebookFile.id,
      (notebookFile.tags || []).filter((t) => t !== tagName)
    );
  };

  // Lined paper background via CSS
  const linedBackground: React.CSSProperties = {
    backgroundImage: `
      linear-gradient(to right, transparent 79px, ${meta.marginColor} 79px, ${meta.marginColor} 80px, transparent 80px),
      repeating-linear-gradient(to bottom, transparent, transparent ${meta.lineSpacing - 1}px, ${meta.lineColor} ${meta.lineSpacing - 1}px, ${meta.lineColor} ${meta.lineSpacing}px)
    `,
  };

  if (!notebookFile) {
    return (
      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          textAlign: 'center',
          background: 'var(--surface)',
          color: 'var(--ink)',
          fontFamily: 'var(--font-sans)',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'var(--sky-tint)',
            color: 'var(--sky-ink)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 24,
          }}
        >
          📓
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>No Notebook Open Yet</h2>
        <p style={{ margin: 0, maxWidth: 400, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.5 }}>
          Create a standalone lined notebook to type research notes, sketch equations, or handwrite with Apple Pencil — no PDF required.
        </p>
        <button
          onClick={handleCreateNewNotebook}
          style={{
            marginTop: 4,
            padding: '10px 20px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--accent, #2563eb)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          }}
        >
          + Create New Notebook
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Notebook Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '8px 16px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface)',
          flexWrap: 'wrap',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Tag tone="sky">#notebook</Tag>

          {/* Switch between notebooks */}
          <select
            value={notebookFile.id}
            onChange={(e) => {
              const nextId = e.target.value;
              const target = files.find((f) => f.id === nextId);
              if (target) {
                setSelectedNotebookId(target.id);
                const firstPage = target.notebookPageIds?.[0] || target.id;
                setActiveDocument(firstPage);
              }
            }}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--line-strong)',
              background: 'var(--surface-raised)',
              color: 'var(--ink)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Switch active notebook"
          >
            {allNotebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>
                📓 {nb.name.replace(/\.notebook$/i, '')}
              </option>
            ))}
          </select>

          <button
            onClick={handleRenameNotebook}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-2)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title="Rename notebook"
          >
            Rename
          </button>

          <button
            onClick={handleCreateNewNotebook}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--line-strong)',
              background: 'var(--surface-raised)',
              color: 'var(--ink)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Create another standalone notebook"
          >
            + New Notebook
          </button>

          {/* Notebook Tags */}
          {currentFileTags.map((t) => (
            <Tag key={t.name} tone={t.color} onRemove={() => handleRemoveTag(t.name)}>
              #{t.name}
            </Tag>
          ))}
          <button
            onClick={handleAddTag}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 22,
              padding: '0 8px',
              borderRadius: 'var(--radius-xs)',
              border: '1px dashed var(--line-strong)',
              fontSize: 12,
              color: 'var(--ink-2)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            + Tag
          </button>
        </div>

        {/* Right Controls: Write/Type vs Draw Mode + Add Page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--surface-sunken, rgba(0,0,0,0.05))',
              padding: 2,
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--line)',
            }}
          >
            <button
              onClick={() => {
                setWriteMode('type');
                useAppStore.getState().setActiveTool('select');
              }}
              style={{
                height: 24,
                padding: '0 10px',
                borderRadius: 4,
                border: 'none',
                background: writeMode === 'type' ? 'var(--surface-raised)' : 'transparent',
                color: writeMode === 'type' ? 'var(--ink)' : 'var(--ink-2)',
                fontSize: 12,
                fontWeight: writeMode === 'type' ? 600 : 500,
                cursor: 'pointer',
                boxShadow: writeMode === 'type' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
              title="Type notes directly onto the lined paper"
            >
              ⌨️ Type Notes
            </button>
            <button
              onClick={() => {
                setWriteMode('draw');
                if (activeTool === 'select') {
                  useAppStore.getState().setActiveTool('pen');
                }
              }}
              style={{
                height: 24,
                padding: '0 10px',
                borderRadius: 4,
                border: 'none',
                background: writeMode === 'draw' ? 'var(--surface-raised)' : 'transparent',
                color: writeMode === 'draw' ? 'var(--ink)' : 'var(--ink-2)',
                fontSize: 12,
                fontWeight: writeMode === 'draw' ? 600 : 500,
                cursor: 'pointer',
                boxShadow: writeMode === 'draw' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
              title="Handwrite or draw with Apple Pencil / Pen tools"
            >
              ✏️ Draw / Ink
            </button>
          </div>

          <button
            onClick={handleAddPage}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--line-strong)',
              background: 'var(--surface-raised)',
              color: 'var(--ink)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add Page
          </button>

          <button
            onClick={handleDeleteCurrentNotebook}
            style={{
              height: 28,
              padding: '0 8px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--danger, #dc2626)',
              fontSize: 12,
              cursor: 'pointer',
            }}
            title="Delete this notebook"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Scrollable Lined Pages Area */}
      <div
        ref={scrollContainerRef}
        data-scroll-container
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: 'var(--bg-viewer, #e8e8ed)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '28px 0 80px',
        }}
      >
        {/* Notebook title header */}
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--ink-2, #666)',
            marginBottom: '14px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {notebookFile.name.replace(/\.notebook$/i, '')} — {pageIds.length} {pageIds.length === 1 ? 'Page' : 'Pages'}
        </div>

        {/* Pages */}
        {pageIds.map((pageId, idx) => {
          const isActive = activeDocumentId === pageId;
          const pageAnnotations = annotations[pageId];
          const strokeCount = pageAnnotations?.strokes?.length || 0;
          const textCount = pageAnnotations?.textElements?.length || 0;
          const linedText =
            pageAnnotations?.textElements?.find((t) => t.id === `${pageId}-lined-notes`)?.text || '';

          return (
            <div
              key={pageId}
              ref={(el) => {
                pageRefs.current[pageId] = el;
              }}
              data-page-id={pageId}
              style={{
                position: 'relative',
                width: meta.pageWidth + 'px',
                height: meta.pageHeight + 'px',
                backgroundColor: '#fffef9',
                boxShadow: isActive
                  ? '0 4px 24px rgba(0,0,0,0.12), 0 0 0 2px rgba(10,122,255,0.25)'
                  : '0 2px 12px rgba(0,0,0,0.08)',
                borderRadius: '4px',
                marginBottom: '32px',
                overflow: 'hidden',
                flexShrink: 0,
                transition: 'box-shadow 0.25s ease',
                touchAction: palmRejection || writeMode === 'type' ? 'pan-x pan-y' : 'none',
              }}
              onPointerDown={() => handlePagePointerDown(pageId)}
            >
              {/* Page number label */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '16px',
                  fontSize: '11px',
                  color: '#999',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                  zIndex: 25,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                Page {idx + 1}
              </div>

              {/* Lined background layer */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  ...linedBackground,
                  pointerEvents: 'none',
                }}
              />

              {/* Direct Lined-Paper Note Editor (aligned to 32px ruled lines, right of 80px margin) */}
              <textarea
                value={linedText}
                onChange={(e) => handleLinedNoteChange(pageId, e.target.value)}
                onFocus={() => handlePagePointerDown(pageId)}
                placeholder={
                  idx === 0 && !linedText
                    ? 'Click here to start typing notes on this page, or switch to Draw / Ink to handwrite with Apple Pencil…'
                    : 'Type notes on this page…'
                }
                style={{
                  position: 'absolute',
                  top: meta.lineSpacing + 4 + 'px',
                  left: '92px',
                  width: meta.pageWidth - 116 + 'px',
                  height: meta.pageHeight - meta.lineSpacing * 2 + 'px',
                  bottom: '32px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  padding: 0,
                  margin: 0,
                  fontFamily: 'var(--font-sans, "Figtree", sans-serif)',
                  fontSize: '16px',
                  lineHeight: `${meta.lineSpacing}px`,
                  color: '#1e1e24',
                  zIndex: writeMode === 'type' ? 15 : 5,
                  pointerEvents: writeMode === 'type' ? 'auto' : 'none',
                  overflowY: 'auto',
                }}
              />

              {/* Drawing + floating text/sticky overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 10,
                  pointerEvents: writeMode === 'draw' ? 'auto' : 'none',
                }}
              >
                <DrawingCanvas documentId={pageId} />
                <TextLayerOverlay documentId={pageId} />
              </div>

              {/* Delete page button (only if > 1 page and empty) */}
              {pageIds.length > 1 && strokeCount === 0 && textCount === 0 && !linedText && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePage(pageId);
                  }}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.06)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#666',
                    zIndex: 30,
                    opacity: 0.65,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.65')}
                  title="Delete empty page"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        {/* Add page button at bottom */}
        <button
          onClick={handleAddPage}
          style={{
            width: meta.pageWidth + 'px',
            height: '64px',
            border: '2px dashed rgba(0,0,0,0.16)',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.45)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#555',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 700,
            marginBottom: '32px',
            flexShrink: 0,
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Page
        </button>

        {/* Page navigation bar */}
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            backgroundColor: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '8px 14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            border: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            fontWeight: 700,
            color: '#1c1c1e',
            zIndex: 50,
          }}
        >
          <button
            onClick={() => scrollToPage(Math.max(0, currentPageIdx - 1))}
            disabled={currentPageIdx === 0}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: currentPageIdx > 0 ? 'pointer' : 'default',
              color: currentPageIdx > 0 ? '#0a7aff' : '#ccc',
              padding: '4px',
              display: 'flex',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <span>
            {currentPageIdx + 1} / {pageIds.length}
          </span>

          <button
            onClick={() => scrollToPage(Math.min(pageIds.length - 1, currentPageIdx + 1))}
            disabled={currentPageIdx >= pageIds.length - 1}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: currentPageIdx < pageIds.length - 1 ? 'pointer' : 'default',
              color: currentPageIdx < pageIds.length - 1 ? '#0a7aff' : '#ccc',
              padding: '4px',
              display: 'flex',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotebookViewer;
