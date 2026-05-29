import React, { useState, useEffect, useRef } from 'react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useAppStore } from '../../store/appStore';
import * as ReactMarkdownImport from 'react-markdown';
const ReactMarkdown: any = (ReactMarkdownImport as any).default || ReactMarkdownImport;
import { extractPdfText } from '../../utils/pdfExtract';
import { generateOllamaNoteStream } from '../../services/ollama';

const PROMPTS = [
  'Summary',
  'Network Architecture',
  "Molecule Representation",
  "Conditioning Mechanism",
  "Datasets",
  "Evaluation criteria",
  "Hyperparameters",
  "Key results",
  "Challenges solved"
];

const RightPanel: React.FC = () => {
  const { files, activeDocumentId, toggleRightPanel, annotations, setSmartNoteStatus } = useAppStore();
  const file = activeDocumentId ? files.find(f => f.id === activeDocumentId) : null;
  const docAnnotations = activeDocumentId ? annotations[activeDocumentId] : null;
  const smartNotes = docAnnotations?.smartNotes || {};

  const [isExtractingGlobal, setIsExtractingGlobal] = useState(false);
  const [cachedPdfText, setCachedPdfText] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [panelWidth, setPanelWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobilePanel, setIsMobilePanel] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateMode = () => setIsMobilePanel(window.innerWidth <= 1100);
    updateMode();
    window.addEventListener('resize', updateMode);
    return () => window.removeEventListener('resize', updateMode);
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizing(true);

    const startX = event.clientX;
    const startWidth = panelWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX;
      const nextWidth = Math.min(720, Math.max(280, startWidth + delta));
      setPanelWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const getOrExtractText = async () => {
    if (cachedPdfText) return cachedPdfText;
    if (!file?.dataUrl) throw new Error("No data URL");
    const text = await extractPdfText(file.dataUrl);
    setCachedPdfText(text);
    return text;
  };

  const handleGenerateAll = async () => {
    if (!file?.dataUrl || !activeDocumentId) return;
    setIsExtractingGlobal(true);
    try {
      const pdfText = await getOrExtractText();
      
      for (const topic of PROMPTS) {
        setSmartNoteStatus(activeDocumentId, topic, 'loading', '');
        try {
          await generateOllamaNoteStream(topic, pdfText, (partial) => {
            setSmartNoteStatus(activeDocumentId, topic, 'loading', partial);
          });
          setSmartNoteStatus(activeDocumentId, topic, 'done');
        } catch (e) {
          console.error(e);
          const message = e instanceof Error ? e.message : String(e);
          setSmartNoteStatus(activeDocumentId, topic, 'error', `Error reaching Ollama endpoint: ${message}`);
        }
      }
    } catch (e) {
      console.error("Text extraction failed", e);
    }
    setIsExtractingGlobal(false);
  };

  const handleGenerateSingle = async (topic: string) => {
    if (!file?.dataUrl || !activeDocumentId) return;
    try {
      setSmartNoteStatus(activeDocumentId, topic, 'loading', '');
      const pdfText = await getOrExtractText();
      await generateOllamaNoteStream(topic, pdfText, (partial) => {
        setSmartNoteStatus(activeDocumentId, topic, 'loading', partial);
      });
      setSmartNoteStatus(activeDocumentId, topic, 'done');
      setExpandedSections(prev => ({ ...prev, [topic]: true }));
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : String(e);
      setSmartNoteStatus(activeDocumentId, topic, 'error', `Error reaching Ollama endpoint: ${message}`);
    }
  };

  const panelStyle: React.CSSProperties = {
    position: isMobilePanel ? 'fixed' : 'relative',
    top: isMobilePanel ? 0 : undefined,
    right: isMobilePanel ? 0 : undefined,
    bottom: isMobilePanel ? 0 : undefined,
    width: `${panelWidth}px`,
    maxWidth: '92vw',
    backgroundColor: '#ffffff',
    borderLeft: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'Nunito, sans-serif',
    zIndex: isMobilePanel ? 120 : undefined,
    boxShadow: isMobilePanel ? 'rgba(0,0,0,0.12) 0 0 28px' : undefined,
  };

  return (
    <div ref={panelRef} className="right-panel" style={panelStyle}>
      <div
        onPointerDown={handleResizePointerDown}
        style={{
          position: 'absolute',
          left: '-8px',
          top: 0,
          bottom: 0,
          width: '16px',
          cursor: 'col-resize',
          zIndex: 10,
          backgroundColor: isResizing ? 'rgba(0,0,0,0.05)' : 'transparent'
        }}
      />
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
         <span style={{ fontWeight: 800, fontSize: '15px' }}>Document Info</span>
         <button onClick={toggleRightPanel} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
         </button>
      </div>
      
      <div style={{ padding: '24px 16px', flex: 1, overflowY: 'auto' }}>
         <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: '#8e8e93', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>FILE NAME</div>
            <div style={{ fontSize: '14px', wordBreak: 'break-all', fontWeight: 600 }}>{file?.name || 'No file selected'}</div>
         </div>
         
         <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                 <span style={{ fontSize: '14px', fontWeight: 800 }}>Smart Notes</span>
              </div>
              <button 
                onClick={handleGenerateAll}
                disabled={isExtractingGlobal || !activeDocumentId || file?.type !== 'pdf'}
                style={{ backgroundColor: '#f0f0f5', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 700, cursor: (isExtractingGlobal || !activeDocumentId || file?.type !== 'pdf') ? 'not-allowed' : 'pointer', color: '#333' }}
              >
                {isExtractingGlobal ? 'Generating...' : 'Extract All'}
              </button>
            </div>
            
            <div style={{ fontSize: '11px', color: '#8e8e93', marginBottom: '24px', lineHeight: 1.4 }}>
              Powered by Ollama (qwen3.5:35b-tuned). Extracts highly contextual research insights explicitly requested for scientific mapping natively out of the central viewport.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {PROMPTS.map(topic => {
                const noteState = smartNotes[topic];
                const expanded = !!expandedSections[topic];
                return (
                  <div key={topic} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedSections(prev => ({ ...prev, [topic]: !prev[topic] }))}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#f9f9fb',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#1c1c1e',
                        textAlign: 'left'
                      }}
                    >
                      <span>{topic}</span>
                      <span style={{ fontSize: '18px', lineHeight: '14px' }}>{expanded ? '−' : '+'}</span>
                    </button>
                    {expanded && (
                      <div style={{ padding: '14px', backgroundColor: '#fff', minHeight: '80px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '12px', color: '#8e8e93' }}>{noteState?.status === 'loading' ? 'Generating...' : noteState?.status === 'done' ? 'Ready' : noteState?.status === 'error' ? 'Failed' : 'Idle'}</span>
                          <button
                            onClick={() => handleGenerateSingle(topic)}
                            style={{ background: '#f0f0f5', border: 'none', padding: '6px 10px', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#333' }}
                          >
                            Generate
                          </button>
                        </div>
                        {noteState?.status === 'loading' && (
                          <div style={{ fontSize: '12px', color: '#007aff', fontStyle: 'italic', marginBottom: '10px' }}>
                            Streaming analysis from Ollama...
                          </div>
                        )}
                        {noteState?.status === 'error' && (
                          <div style={{ fontSize: '12px', color: '#e24361', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                            {noteState.content || 'Unable to generate summary.'}
                          </div>
                        )}
                        {noteState?.content && noteState?.status !== 'error' && (
                          <div style={{ fontSize: '13px', lineHeight: 1.7, color: '#333' }}>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{noteState.content}</ReactMarkdown>
                          </div>
                        )}
                        {!noteState?.content && noteState?.status !== 'loading' && noteState?.status !== 'error' && (
                          <div style={{ fontSize: '12px', color: '#8e8e93', lineHeight: 1.6 }}>
                            Tap Generate to analyze this section and view the output here.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
         </div>
      </div>
    </div>
  );
};
export default RightPanel;
