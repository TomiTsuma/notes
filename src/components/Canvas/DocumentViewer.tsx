import React, { useState, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useAppStore } from '../../store/appStore';
import DrawingCanvas from './DrawingCanvas';
import TextLayerOverlay from './TextLayer';

// Configure the worker explicitly using unpkg securely synced to exact API version
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const DocumentViewer: React.FC = () => {
  const { activeDocumentId, files } = useAppStore();
  const [numPages, setNumPages] = useState<number | null>(null);
  
  const file = files.find(f => f.id === activeDocumentId);

  // Convert raw base64 data strings natively into pure Uint8Arrays to bypass PDF.js string fetch failures entirely
  const pdfData = useMemo(() => {
    if (!file?.dataUrl) return null;
    try {
      const base64 = file.dataUrl.split('base64,')[1];
      if (!base64) {
        return file.dataUrl; // Fallback directly if not base64 chunked
      }
      const raw = window.atob(base64);
      const uint8Array = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        uint8Array[i] = raw.charCodeAt(i);
      }
      return { data: uint8Array };
    } catch (e) {
      console.error('Error decoding Base64 PDF chunk explicitly:', e);
      return file?.dataUrl; // Ultimate fallback
    }
  }, [file?.dataUrl]);

  if (!activeDocumentId) return (
    <div style={{ padding: '2rem', color: '#8e8e93', textAlign: 'center', marginTop: '20vh', fontFamily: 'Nunito' }}>
      Select a note or upload a document to begin.
    </div>
  );

  if (!file) return (
    <div style={{ padding: '2rem', color: '#8e8e93', textAlign: 'center', marginTop: '20vh', fontFamily: 'Nunito' }}>
      Document not found.
    </div>
  );

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('PDF_SUCCESS_NUMBER_PAGES:', numPages);
    setNumPages(numPages);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden', backgroundColor: '#f0f0f5', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
      {file.type === 'pdf' ? (
        <div style={{ position: 'relative', minHeight: '100%' }}>
          {!pdfData ? (
             <div style={{ padding: '2rem' }}>Failed to extract strict PDF binaries...</div>
          ) : (
            <Document 
              file={pdfData} 
              onLoadSuccess={onDocumentLoadSuccess} 
              onLoadError={(error) => console.error('PDF Load Error Trace:', error.message, error)} 
              loading={<div style={{ padding: '40px', fontFamily: 'Nunito' }}>Loading Document Engine natively...</div>}
            >
              {Array.from(new Array(numPages || 0), (_, index) => (
                <div key={`page_${index + 1}`} style={{ marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: 'white', pointerEvents: 'none' }}>
                   {/* Standard page rendering */}
                   <Page pageNumber={index + 1} renderTextLayer={false} renderAnnotationLayer={false} width={800} />
                </div>
              ))}
            </Document>
          )}
          
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'auto' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
               <DrawingCanvas />
            </div>
            <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
               <TextLayerOverlay />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', backgroundColor: 'white', width: '100%', maxWidth: '800px', minHeight: '1130px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '40px' }}>
          {file.type === 'txt' && (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Nunito', fontSize: '15px' }}>{file.dataUrl ? atob(file.dataUrl.split(',')[1] || '') : ''}</pre>
          )}
          {file.type !== 'txt' && file.type !== 'pdf' && (
             <div style={{ fontFamily: 'Nunito' }}>Preview not available for {file.type} inline yet. But you can take notes!</div>
          )}
          
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
             <div style={{ pointerEvents: 'none', position: 'absolute', width: '100%', height: '100%' }}>
               <DrawingCanvas />
             </div>
             <div style={{ pointerEvents: 'none', position: 'absolute', width: '100%', height: '100%' }}>
               <TextLayerOverlay />
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DocumentViewer;
