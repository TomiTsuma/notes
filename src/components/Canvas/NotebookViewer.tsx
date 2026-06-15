import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import DrawingCanvas from './DrawingCanvas';
import TextLayerOverlay from './TextLayer';

const NotebookViewer: React.FC = () => {
  const {
    activeDocumentId, files, annotations,
    addNotebookPage, deleteNotebookPage, setActiveDocument,
  } = useAppStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [currentPageIdx, setCurrentPageIdx] = useState(0);

  // Find the notebook file that owns the current activeDocumentId page
  const notebookFile = files.find(
    f => f.type === 'notebook' && (f.notebookPageIds || []).includes(activeDocumentId || '')
  );

  const pageIds = notebookFile?.notebookPageIds || [];
  const meta = notebookFile?.notebookMeta || {
    pageWidth: 800,
    pageHeight: 1130,
    lineSpacing: 32,
    lineColor: '#d4d4d8',
    marginColor: '#ffcccc',
  };

  // When opening a notebook, set activeDocumentId to first page
  useEffect(() => {
    if (notebookFile && pageIds.length > 0 && !activeDocumentId) {
      setActiveDocument(pageIds[0]);
    }
  }, [notebookFile?.id]);

  // Track which page is most visible using IntersectionObserver
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || pageIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let maxId = '';
        entries.forEach(entry => {
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

    pageIds.forEach(id => {
      const el = pageRefs.current[id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pageIds.join(',')]);

  // Set activeDocumentId to the page when user clicks/touches it
  const handlePagePointerDown = useCallback((pageId: string) => {
    if (activeDocumentId !== pageId) {
      // Use raw set to avoid switching activeView
      useAppStore.setState({ activeDocumentId: pageId });
    }
    const idx = pageIds.indexOf(pageId);
    if (idx >= 0) setCurrentPageIdx(idx);
  }, [activeDocumentId, pageIds]);

  const handleAddPage = () => {
    if (!notebookFile) return;
    addNotebookPage(notebookFile.id);
    // Scroll to bottom after a tick so the new page renders
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

  // Lined paper background via CSS
  const linedBackground: React.CSSProperties = {
    backgroundImage: `
      linear-gradient(to right, transparent 79px, ${meta.marginColor} 79px, ${meta.marginColor} 80px, transparent 80px),
      repeating-linear-gradient(to bottom, transparent, transparent ${meta.lineSpacing - 1}px, ${meta.lineColor} ${meta.lineSpacing - 1}px, ${meta.lineColor} ${meta.lineSpacing}px)
    `,
  };

  if (!notebookFile) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20vh', fontFamily: 'Nunito' }}>
        Notebook not found.
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      data-scroll-container
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'var(--bg-viewer, #e8e8ed)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 0 80px',
      }}
    >
      {/* Notebook title */}
      <div style={{
        fontFamily: 'Nunito',
        fontSize: '14px',
        fontWeight: 800,
        color: 'var(--text-secondary, #666)',
        marginBottom: '16px',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}>
        {notebookFile.name.replace('.notebook', '')}
      </div>

      {/* Pages */}
      {pageIds.map((pageId, idx) => {
        const isActive = activeDocumentId === pageId;
        const pageAnnotations = annotations[pageId];
        const strokeCount = pageAnnotations?.strokes?.length || 0;
        const textCount = pageAnnotations?.textElements?.length || 0;

        return (
          <div
            key={pageId}
            ref={el => { pageRefs.current[pageId] = el; }}
            data-page-id={pageId}
            style={{
              position: 'relative',
              width: meta.pageWidth + 'px',
              height: meta.pageHeight + 'px',
              backgroundColor: '#fffef9',
              boxShadow: isActive
                ? '0 4px 24px rgba(0,0,0,0.12), 0 0 0 2px rgba(10,122,255,0.25)'
                : '0 2px 12px rgba(0,0,0,0.08)',
              borderRadius: '2px',
              marginBottom: '32px',
              overflow: 'hidden',
              flexShrink: 0,
              transition: 'box-shadow 0.25s ease',
              touchAction: 'none',
            }}
            onPointerDown={() => handlePagePointerDown(pageId)}
          >
            {/* Page number label */}
            <div style={{
              position: 'absolute',
              bottom: '8px',
              right: '16px',
              fontSize: '11px',
              color: '#bbb',
              fontFamily: 'Nunito',
              fontWeight: 700,
              zIndex: 5,
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              {idx + 1}
            </div>

            {/* Lined background layer */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              ...linedBackground,
              pointerEvents: 'none',
            }} />

            {/* Drawing + text overlay */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'auto',
            }}>
              <DrawingCanvas documentId={pageId} />
              <TextLayerOverlay documentId={pageId} />
            </div>

            {/* Delete page button (only if > 1 page) */}
            {pageIds.length > 1 && (strokeCount === 0 && textCount === 0) && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeletePage(pageId); }}
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
                  color: '#999',
                  zIndex: 10,
                  opacity: 0.5,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                title="Delete empty page"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {/* Add page button */}
      <button
        onClick={handleAddPage}
        style={{
          width: meta.pageWidth + 'px',
          height: '64px',
          border: '2px dashed rgba(0,0,0,0.12)',
          borderRadius: '8px',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--text-secondary, #888)',
          fontFamily: 'Nunito',
          fontSize: '14px',
          fontWeight: 700,
          marginBottom: '32px',
          flexShrink: 0,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(10,122,255,0.4)';
          e.currentTarget.style.color = '#0a7aff';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
          e.currentTarget.style.color = 'var(--text-secondary, #888)';
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
        Add Page
      </button>

      {/* Page navigation bar */}
      <div style={{
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
        fontFamily: 'Nunito',
        fontSize: '12px',
        fontWeight: 700,
        color: 'var(--text-primary, #1c1c1e)',
        zIndex: 50,
      }}>
        <button
          onClick={() => scrollToPage(Math.max(0, currentPageIdx - 1))}
          disabled={currentPageIdx === 0}
          style={{
            border: 'none', background: 'transparent', cursor: currentPageIdx > 0 ? 'pointer' : 'default',
            color: currentPageIdx > 0 ? '#0a7aff' : '#ccc', padding: '4px', display: 'flex',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <span>
          {currentPageIdx + 1} / {pageIds.length}
        </span>

        <button
          onClick={() => scrollToPage(Math.min(pageIds.length - 1, currentPageIdx + 1))}
          disabled={currentPageIdx >= pageIds.length - 1}
          style={{
            border: 'none', background: 'transparent', cursor: currentPageIdx < pageIds.length - 1 ? 'pointer' : 'default',
            color: currentPageIdx < pageIds.length - 1 ? '#0a7aff' : '#ccc', padding: '4px', display: 'flex',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
};

export default NotebookViewer;
