import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useAppStore } from '../../store/appStore';
import DrawingCanvas from './DrawingCanvas';
import TextLayerOverlay from './TextLayer';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
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
  const { activeDocumentId, files, updateFile } = useAppStore();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);

  const file = files.find(f => f.id === activeDocumentId);

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

  useEffect(() => {
    const el = pdfWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setOverlayHeight(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [numPages]);

  const [txtContent, setTxtContent] = useState<string>('');

  useEffect(() => {
    if (file?.type !== 'txt') return;
    const url = file.dataUrl;
    if (!url) { setTxtContent(''); return; }
    if (url.startsWith('data:')) {
      setTxtContent(atob(url.split(',')[1] || ''));
      return;
    }
    if (url.startsWith('/api/files/')) {
      fetch(url).then(r => r.text()).then(setTxtContent).catch(() => setTxtContent(''));
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
      // Server URL or bundled asset URL — react-pdf fetches directly
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

  if (!activeDocumentId) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20vh', fontFamily: 'Nunito' }}>
        Select a note or upload a document to begin.
      </div>
    );
  }

  if (!file) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20vh', fontFamily: 'Nunito' }}>
        Document not found.
      </div>
    );
  }

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: overlayHeight || '100%',
    minHeight: '100%',
    pointerEvents: 'auto',
  };

  return (
    <div
      data-scroll-container
      style={{
        position: 'relative', width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden',
        backgroundColor: 'var(--bg-viewer)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0',
      }}
    >
      {file.type === 'pdf' ? (
        <div ref={pdfWrapperRef} style={{ position: 'relative', minHeight: '100%' }}>
          {!pdfData ? (
            <div style={{ padding: '2rem', fontFamily: 'Nunito' }}>
              {loadError || 'Loading PDF...'}
              {loadError && (
                <button onClick={() => window.location.reload()} style={{ display: 'block', marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0a7aff', color: 'white', cursor: 'pointer' }}>
                  Retry
                </button>
              )}
            </div>
          ) : (
            <Document
              file={pdfData}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => { console.error('PDF Load Error:', error); setLoadError(error.message); }}
              loading={<div style={{ padding: '40px', fontFamily: 'Nunito' }}>Loading document...</div>}
            >
              {Array.from(new Array(numPages || 0), (_, index) => (
                <div key={`page_${index + 1}`} style={{ marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)', backgroundColor: 'white', pointerEvents: 'none', borderRadius: '2px' }}>
                  <Page pageNumber={index + 1} renderTextLayer={false} renderAnnotationLayer={false} width={800} />
                </div>
              ))}
            </Document>
          )}

          <div style={overlayStyle}>
            <DrawingCanvas />
            <TextLayerOverlay />
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', backgroundColor: 'white', width: '100%', maxWidth: '800px', minHeight: '1130px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '40px' }}>
          {file.type === 'txt' && (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Nunito', fontSize: '15px' }}>
              {txtContent}
            </pre>
          )}
          {file.type !== 'txt' && file.type !== 'pdf' && (
            <div style={{ fontFamily: 'Nunito' }}>Preview not available for {file.type} inline yet. But you can take notes!</div>
          )}

          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'auto' }}>
            <DrawingCanvas />
            <TextLayerOverlay />
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
