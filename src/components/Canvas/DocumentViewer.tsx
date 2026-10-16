import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useAppStore } from '../../store/appStore';
import DrawingCanvas from './DrawingCanvas';
import TextLayerOverlay from './TextLayer';
import NotebookViewer from './NotebookViewer';
import { Tag } from '../UI/clio';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

type SpreadMode = 'fit-width' | 'fit-page' | 'two-page' | 'custom';

const ZOOM_PRESETS = [50, 75, 90, 100, 110, 125, 140, 160, 180, 200, 250, 300];

const DocumentViewer: React.FC = () => {
  const { activeDocumentId, files, updateFile, tags, addTag, setFileTags } = useAppStore();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overlayHeight, setOverlayHeight] = useState(0);

  // Spread & Zoom states
  const [spreadMode, setSpreadMode] = useState<SpreadMode>('fit-width');
  const [customZoom, setCustomZoom] = useState<number>(100);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [basePageSize, setBasePageSize] = useState<{ width: number; height: number }>({ width: 595.28, height: 841.89 });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpPageInput, setJumpPageInput] = useState<string>('1');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const file = files.find((f) => f.id === activeDocumentId);

  // Convert blob/relative to base64 if needed
  useEffect(() => {
    if (!file?.dataUrl) return;
    if (file.dataUrl.startsWith('/api/files/')) return;
    if (file.dataUrl.startsWith('data:application/pdf;base64,')) return;
    if (!file.type?.includes('pdf')) return;

    const convert = async () => {
      try {
        const res = await fetch(file.dataUrl!);
        const buf = await res.arrayBuffer();
        const base64 = arrayBufferToBase64(buf);
        updateFile(file.id, { dataUrl: `data:application/pdf;base64,${base64}` });
      } catch (e) {
        console.error('PDF base64 conversion failed:', e);
      }
    };
    convert();
  }, [file?.id, file?.dataUrl, file?.type, updateFile]);

  // Observe scroll container dimensions to support responsive "Fit Width" spreading
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerDimensions({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [file?.id]);

  // Track rendered overlay height
  useEffect(() => {
    const el = pdfContentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setOverlayHeight(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [numPages, spreadMode, customZoom]);

  // IntersectionObserver to keep currentPage updated during scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !numPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let visiblePage = currentPage;
        entries.forEach((entry) => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const pageNum = Number(entry.target.getAttribute('data-page-number'));
            if (pageNum) visiblePage = pageNum;
          }
        });
        if (maxRatio > 0.25) {
          setCurrentPage(visiblePage);
          setJumpPageInput(String(visiblePage));
        }
      },
      { root: container, threshold: [0.1, 0.25, 0.5, 0.8] }
    );

    for (let i = 1; i <= numPages; i++) {
      const el = pageRefs.current[i];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [numPages, spreadMode]);

  // Compute responsive page width and effective scale
  const { computedPageWidth, effectiveScale } = useMemo(() => {
    const baseW = basePageSize.width || 595.28;
    const baseH = basePageSize.height || 841.89;
    // Provide 48px breathing room (24px left + 24px right) for spread-out reading
    const availW = Math.max(360, (containerDimensions.width || 900) - 48);
    const availH = Math.max(360, (containerDimensions.height || 700) - 64);

    let w = baseW;
    const sPageW = Math.max(320, Math.floor((availW - 20) / 2));

    if (spreadMode === 'fit-width') {
      w = availW;
    } else if (spreadMode === 'fit-page') {
      const aspect = baseW / baseH;
      w = Math.min(availW, availH * aspect);
    } else if (spreadMode === 'two-page') {
      w = sPageW;
    } else if (spreadMode === 'custom') {
      w = Math.round(baseW * (customZoom / 100));
    }

    const scale = w / baseW;
    return {
      computedPageWidth: Math.round(w),
      effectiveScale: scale > 0 ? scale : 1,
    };
  }, [basePageSize, containerDimensions, spreadMode, customZoom]);

  const baseOverlayHeight = useMemo(() => {
    if (!effectiveScale || effectiveScale <= 0) return overlayHeight;
    return overlayHeight / effectiveScale;
  }, [overlayHeight, effectiveScale]);

  const [txtContent, setTxtContent] = useState<string>('');

  useEffect(() => {
    if (file?.type !== 'txt') return;
    const url = file.dataUrl;
    if (!url) {
      setTxtContent('');
      return;
    }
    if (url.startsWith('data:')) {
      setTxtContent(atob(url.split(',')[1] || ''));
      return;
    }
    if (url.startsWith('/api/files/')) {
      fetch(url)
        .then((r) => r.text())
        .then(setTxtContent)
        .catch(() => setTxtContent(''));
    }
  }, [file?.id, file?.type, file?.dataUrl]);

  const pdfData = useMemo(() => {
    if (!file?.dataUrl) return null;
    setLoadError(null);
    try {
      if (file.dataUrl.startsWith('data:application/pdf;base64,')) {
        const base64 = file.dataUrl.split('base64,')[1];
        if (!base64) return null;
        const raw = window.atob(base64);
        const uint8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) uint8Array[i] = raw.charCodeAt(i);
        return { data: uint8Array };
      }
      return file.dataUrl;
    } catch (e) {
      console.error('Error decoding PDF:', e);
      setLoadError('Failed to decode PDF data');
      return null;
    }
  }, [file?.dataUrl]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setLoadError(null);
    setCurrentPage(1);
    setJumpPageInput('1');
  }, []);

  const onPageLoadSuccess = useCallback((page: any) => {
    if (page.pageNumber === 1) {
      const w = page.originalWidth || page.width;
      const h = page.originalHeight || page.height;
      if (w && h) {
        setBasePageSize({ width: w, height: h });
      }
    }
  }, []);

  const scrollToPage = useCallback((pageNum: number) => {
    const clamped = Math.max(1, Math.min(numPages || 1, pageNum));
    const el = pageRefs.current[clamped];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(clamped);
      setJumpPageInput(String(clamped));
    }
  }, [numPages]);

  const handleZoomIn = useCallback(() => {
    setSpreadMode('custom');
    const currentPercent = Math.round(effectiveScale * 100);
    const next = ZOOM_PRESETS.find((s) => s > currentPercent + 5) || Math.min(400, currentPercent + 25);
    setCustomZoom(next);
  }, [effectiveScale]);

  const handleZoomOut = useCallback(() => {
    setSpreadMode('custom');
    const currentPercent = Math.round(effectiveScale * 100);
    const prev = [...ZOOM_PRESETS].reverse().find((s) => s < currentPercent - 5) || Math.max(40, currentPercent - 25);
    setCustomZoom(prev);
  }, [effectiveScale]);

  const handleFitWidth = useCallback(() => {
    setSpreadMode('fit-width');
  }, []);

  const handleFitPage = useCallback(() => {
    setSpreadMode('fit-page');
  }, []);

  const handleTwoPageSpread = useCallback(() => {
    setSpreadMode((prev) => (prev === 'two-page' ? 'fit-width' : 'two-page'));
  }, []);

  // Keyboard shortcuts (Cmd +, Cmd -, Cmd 0, Cmd 9, Cmd 2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (e.target as HTMLElement)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomIn();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handleFitWidth();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '9') {
        e.preventDefault();
        handleFitPage();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        handleTwoPageSpread();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleFitWidth, handleFitPage, handleTwoPageSpread]);

  // Ctrl/Cmd + Wheel to zoom smoothly
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -12 : 12;
      const currentPercent = Math.round(effectiveScale * 100);
      const newZoom = Math.max(40, Math.min(400, currentPercent + delta));
      setSpreadMode('custom');
      setCustomZoom(newZoom);
    }
  };

  const currentFileTags = (file?.tags || []).map((tagName) => {
    const found = tags.find((t) => t.name === tagName);
    return { name: tagName, color: found?.color || 'sky' };
  });

  const handleAddTag = () => {
    if (!file) return;
    const name = prompt('Tag name:');
    if (!name) return;
    const clean = name.replace(/^#/, '').trim();
    if (!clean) return;
    addTag({ id: 'tag-' + Date.now(), name: clean, color: 'sky', createdAt: new Date().toISOString() });
    setFileTags(file.id, [...(file.tags || []), clean]);
  };

  const handleRemoveTag = (tagName: string) => {
    if (!file) return;
    setFileTags(
      file.id,
      (file.tags || []).filter((t) => t !== tagName)
    );
  };

  // 2-Page spread pairing
  const pagePairs = useMemo(() => {
    if (!numPages) return [];
    const pairs: number[][] = [];
    for (let i = 1; i <= numPages; i += 2) {
      if (i + 1 <= numPages) {
        pairs.push([i, i + 1]);
      } else {
        pairs.push([i]);
      }
    }
    return pairs;
  }, [numPages]);

  const isNotebook = file?.type === 'notebook' || (!file && files.some((f) => f.type === 'notebook'));
  if (isNotebook) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
          <Tag tone="sky">#notebook</Tag>
        </div>
        <NotebookViewer />
      </div>
    );
  }

  if (!file) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)' }}>
        No document selected. Select a file from the sidebar or Project Hub.
      </div>
    );
  }

  if (file.type === 'txt') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', flexWrap: 'wrap' }}>
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
            + Add tag
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 32, position: 'relative' }}>
          <div
            style={{
              maxWidth: 720,
              margin: '0 auto',
              background: 'var(--surface-raised)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px 40px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h2 style={{ fontFamily: 'var(--font-serif)', marginBottom: 16 }}>{file.name}</h2>
            <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{txtContent}</pre>
          </div>
          <TextLayerOverlay documentId={file.id} />
          <DrawingCanvas documentId={file.id} width={800} height={Math.max(800, overlayHeight)} />
        </div>
      </div>
    );
  }

  const effectivePercent = Math.round(effectiveScale * 100);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Bar with Tags + PDF Spread & Zoom Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface)',
          minHeight: 42,
          flexShrink: 0,
          gap: 12,
          flexWrap: 'wrap',
          zIndex: 30,
        }}
      >
        {/* Left: Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
            + Add tag
          </button>
        </div>

        {/* Right: PDF Spread & View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Mode Switchers */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--bg-inset, rgba(0,0,0,0.05))',
              padding: '2px',
              borderRadius: '6px',
              gap: 2,
            }}
          >
            {/* Spread / Fit Width */}
            <button
              onClick={handleFitWidth}
              title="Spread out across screen (Fit Width) [⌘0]"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: spreadMode === 'fit-width' ? 'var(--bg-surface-solid, #ffffff)' : 'transparent',
                color: spreadMode === 'fit-width' ? 'var(--accent-color, #007aff)' : 'var(--text-secondary, #86868b)',
                boxShadow: spreadMode === 'fit-width' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              <span>Fit Width</span>
            </button>

            {/* 2-Page Spread */}
            <button
              onClick={handleTwoPageSpread}
              title="Two-Page Side-by-Side Spread [⌘2]"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: spreadMode === 'two-page' ? 'var(--bg-surface-solid, #ffffff)' : 'transparent',
                color: spreadMode === 'two-page' ? 'var(--accent-color, #007aff)' : 'var(--text-secondary, #86868b)',
                boxShadow: spreadMode === 'two-page' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="8" height="16" rx="1" />
                <rect x="13" y="4" width="8" height="16" rx="1" />
              </svg>
              <span>2-Page</span>
            </button>

            {/* Fit Page */}
            <button
              onClick={handleFitPage}
              title="Fit Entire Page in View [⌘9]"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: spreadMode === 'fit-page' ? 'var(--bg-surface-solid, #ffffff)' : 'transparent',
                color: spreadMode === 'fit-page' ? 'var(--accent-color, #007aff)' : 'var(--text-secondary, #86868b)',
                boxShadow: spreadMode === 'fit-page' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="8 3 4 3 4 7" />
                <polyline points="4 17 4 21 8 21" />
                <polyline points="16 3 20 3 20 7" />
                <polyline points="20 17 20 21 16 21" />
              </svg>
              <span>Fit Page</span>
            </button>
          </div>

          {/* Zoom controls */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--bg-inset, rgba(0,0,0,0.05))',
              borderRadius: '6px',
              padding: '2px',
              gap: 2,
            }}
          >
            <button
              onClick={handleZoomOut}
              title="Zoom Out [⌘-]"
              style={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Zoom presets dropdown */}
            <select
              value={spreadMode === 'fit-width' ? 'fit-width' : spreadMode === 'two-page' ? 'two-page' : spreadMode === 'fit-page' ? 'fit-page' : effectivePercent}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'fit-width') handleFitWidth();
                else if (val === 'two-page') handleTwoPageSpread();
                else if (val === 'fit-page') handleFitPage();
                else {
                  setSpreadMode('custom');
                  setCustomZoom(Number(val));
                }
              }}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '2px 4px',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              title="Select Zoom Preset"
            >
              <option value="fit-width">Fit Width ({effectivePercent}%)</option>
              <option value="two-page">2-Page Spread</option>
              <option value="fit-page">Fit Page</option>
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={100}>100% (Actual)</option>
              <option value={125}>125%</option>
              <option value={150}>150%</option>
              <option value={175}>175%</option>
              <option value={200}>200%</option>
              <option value={250}>250%</option>
              <option value={300}>300%</option>
            </select>

            <button
              onClick={handleZoomIn}
              title="Zoom In [⌘+]"
              style={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Page navigation */}
          {numPages && numPages > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--bg-inset, rgba(0,0,0,0.05))',
                borderRadius: '6px',
                padding: '2px 4px',
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              <button
                onClick={() => scrollToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                title="Previous Page"
                style={{
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'transparent',
                  color: currentPage <= 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                  cursor: currentPage <= 1 ? 'default' : 'pointer',
                  opacity: currentPage <= 1 ? 0.4 : 1,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = parseInt(jumpPageInput, 10);
                  if (!isNaN(target)) scrollToPage(target);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
              >
                <input
                  type="text"
                  value={jumpPageInput}
                  onChange={(e) => setJumpPageInput(e.target.value)}
                  onBlur={() => {
                    const target = parseInt(jumpPageInput, 10);
                    if (!isNaN(target)) scrollToPage(target);
                    else setJumpPageInput(String(currentPage));
                  }}
                  style={{
                    width: 28,
                    textAlign: 'center',
                    padding: '2px 0',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface-solid, #ffffff)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>/ {numPages}</span>
              </form>

              <button
                onClick={() => scrollToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                title="Next Page"
                style={{
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'transparent',
                  color: currentPage >= numPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                  cursor: currentPage >= numPages ? 'default' : 'pointer',
                  opacity: currentPage >= numPages ? 0.4 : 1,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main PDF Scroll Container */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          position: 'relative',
          padding: '24px 24px 80px',
          backgroundColor: 'var(--bg-viewer, #161618)',
        }}
      >
        {/* Single Page / Continuous Spread Mode (Supports Full In-Place Vector Annotations) */}
        {spreadMode !== 'two-page' ? (
          <div
            ref={pdfWrapperRef}
            style={{
              position: 'relative',
              display: 'inline-block',
              width: computedPageWidth,
              touchAction: 'none',
              transition: 'width 0.15s ease-out',
            }}
          >
            <div ref={pdfContentRef}>
              {pdfData ? (
                <Document
                  file={pdfData}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)' }}>
                      Loading PDF…
                    </div>
                  }
                >
                  {Array.from(new Array(numPages || 0), (_, index) => {
                    const pageNum = index + 1;
                    return (
                      <div
                        key={`page_${pageNum}`}
                        ref={(el) => {
                          pageRefs.current[pageNum] = el;
                        }}
                        data-page-number={pageNum}
                        className="cl-pdf-page-card"
                        style={{
                          position: 'relative',
                          marginBottom: 24,
                          borderRadius: 4,
                          boxShadow: '0 4px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)',
                          backgroundColor: '#ffffff',
                          overflow: 'hidden',
                        }}
                      >
                        <Page
                          pageNumber={pageNum}
                          width={computedPageWidth}
                          onLoadSuccess={onPageLoadSuccess}
                          renderTextLayer
                          renderAnnotationLayer
                        />
                        {/* Page number badge */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 8,
                            right: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#888',
                            pointerEvents: 'none',
                            userSelect: 'none',
                            background: 'rgba(255, 255, 255, 0.85)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        >
                          {pageNum} / {numPages}
                        </div>
                      </div>
                    );
                  })}
                </Document>
              ) : (
                <div style={{ padding: 20, color: 'var(--danger)' }}>{loadError || 'PDF unavailable'}</div>
              )}
            </div>

            {/* Scaled vector annotations */}
            <DrawingCanvas
              documentId={file.id}
              scale={effectiveScale}
              baseWidth={basePageSize.width}
              baseHeight={baseOverlayHeight}
            />
            <TextLayerOverlay
              documentId={file.id}
              scale={effectiveScale}
              baseWidth={basePageSize.width}
              baseHeight={baseOverlayHeight}
            />
          </div>
        ) : (
          /* 2-Page Spread Mode (Side-by-side reading layout across wide screens) */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%' }}>
            {pdfData ? (
              <Document
                file={pdfData}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)' }}>
                    Loading PDF…
                  </div>
                }
              >
                {pagePairs.map((pair, pairIdx) => (
                  <div
                    key={`pair_${pairIdx}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 20,
                      justifyContent: 'center',
                      marginBottom: 24,
                    }}
                  >
                    {pair.map((pageNum) => (
                      <div
                        key={`page_${pageNum}`}
                        ref={(el) => {
                          pageRefs.current[pageNum] = el;
                        }}
                        data-page-number={pageNum}
                        className="cl-pdf-page-card"
                        style={{
                          position: 'relative',
                          borderRadius: 4,
                          boxShadow: '0 4px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)',
                          backgroundColor: '#ffffff',
                          overflow: 'hidden',
                          width: computedPageWidth,
                        }}
                      >
                        <Page
                          pageNumber={pageNum}
                          width={computedPageWidth}
                          onLoadSuccess={onPageLoadSuccess}
                          renderTextLayer
                          renderAnnotationLayer
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 8,
                            right: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#888',
                            pointerEvents: 'none',
                            userSelect: 'none',
                            background: 'rgba(255, 255, 255, 0.85)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        >
                          {pageNum} / {numPages}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </Document>
            ) : (
              <div style={{ padding: 20, color: 'var(--danger)' }}>{loadError || 'PDF unavailable'}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;
