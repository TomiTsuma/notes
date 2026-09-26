import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useAppStore } from '../../store/appStore';
import DrawingCanvas from './DrawingCanvas';
import TextLayerOverlay from './TextLayer';
import NotebookViewer from './NotebookViewer';
import { CanvasTagBar } from '../UI/clio';

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

const DocumentViewer: React.FC = () => {
  const { activeDocumentId, files, updateFile, tags, addTag, setFileTags } = useAppStore();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  const file = files.find((f) => f.id === activeDocumentId);

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

  // Measure the rendered pages only. Measuring the outer wrapper fed the overlay's
  // own height back into its next size, growing the canvas without bound.
  useEffect(() => {
    const el = pdfContentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setOverlayHeight(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [numPages]);

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
  }, []);

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

  const isNotebook = file?.type === 'notebook' || (!file && files.some((f) => f.type === 'notebook'));
  if (isNotebook) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <CanvasTagBar
          tags={currentFileTags.length > 0 ? currentFileTags : [{ name: 'methods', color: 'sky' }, { name: 'results', color: 'sage' }]}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
        />
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
        <CanvasTagBar tags={currentFileTags} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} />
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <CanvasTagBar tags={currentFileTags} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          position: 'relative',
          padding: '24px 0',
        }}
      >
        <div ref={pdfWrapperRef} style={{ position: 'relative', display: 'inline-block', touchAction: 'none' }}>
          <div ref={pdfContentRef}>
            {pdfData ? (
              <Document file={pdfData} onLoadSuccess={onDocumentLoadSuccess} loading={<div style={{ padding: 20 }}>Loading PDF…</div>}>
                {Array.from(new Array(numPages || 0), (_, index) => (
                  <Page key={`page_${index + 1}`} pageNumber={index + 1} renderTextLayer renderAnnotationLayer />
                ))}
              </Document>
            ) : (
              <div style={{ padding: 20, color: 'var(--danger)' }}>{loadError || 'PDF unavailable'}</div>
            )}
          </div>

          <DrawingCanvas documentId={file.id} width={794} height={overlayHeight || 1123} />
          <TextLayerOverlay documentId={file.id} />
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
