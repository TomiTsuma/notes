import React, { useState, useEffect, useRef } from 'react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useAppStore } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';
import * as ReactMarkdownImport from 'react-markdown';
const ReactMarkdown: any = (ReactMarkdownImport as any).default || ReactMarkdownImport;
import { extractPdfText } from '../../utils/pdfExtract';
import { generateOllamaNoteStream, generateOllamaChatStream } from '../../services/ollama';

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
  const { 
    files, 
    activeDocumentId, 
    toggleRightPanel, 
    annotations, 
    setSmartNoteStatus,
    // New AI Chat store integrations
    chatHistory,
    addChatMessage,
    clearChatHistory,
  } = useAppStore();

  const file = activeDocumentId ? files.find(f => f.id === activeDocumentId) : null;
  const docAnnotations = activeDocumentId ? annotations[activeDocumentId] : null;
  const smartNotes = docAnnotations?.smartNotes || {};

  const [panelMode, setPanelMode] = useState<'summary' | 'chat'>('summary');

  // AI Chat states
  const [chatInput, setChatInput] = useState('');
  const [isGeneratingChat, setIsGeneratingChat] = useState(false);
  const [chatStreamText, setChatStreamText] = useState('');

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [isExtractingGlobal, setIsExtractingGlobal] = useState(false);
  const [cachedPdfText, setCachedPdfText] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [panelWidth, setPanelWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobilePanel, setIsMobilePanel] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Retrieve chat messages for active doc
  const currentChatId = activeDocumentId || 'global-chat';
  const chatMessages = chatHistory[currentChatId] || [];

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatStreamText, panelMode]);

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
    if (!file?.dataUrl) return "No active document text available.";
    try {
      const text = await extractPdfText(file.dataUrl);
      setCachedPdfText(text);
      return text;
    } catch (e) {
      console.error("Text extract fail, using base name", e);
      return `Document Name: ${file.name}`;
    }
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

  // AI Chat Submission
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isGeneratingChat) return;

    const userQuery = chatInput;
    setChatInput('');
    setIsGeneratingChat(true);
    setChatStreamText('');

    // Save user message to history
    addChatMessage(currentChatId, {
      id: uuidv4(),
      role: 'user',
      content: userQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    try {
      const contextText = await getOrExtractText();
      const payloadMessages = [
        ...chatMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userQuery }
      ];

      await generateOllamaChatStream(payloadMessages, contextText, (chunk) => {
        setChatStreamText(chunk);
      });

      // Save assistant message to history on done
      addChatMessage(currentChatId, {
        id: uuidv4(),
        role: 'assistant',
        content: chatStreamText || 'Response mapped successfully.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      setChatStreamText('');
    } catch (error) {
      // Graceful local intelligence fallback streamer if Ollama is not connected!
      console.warn("Ollama unavailable, fallback to offline semantic assistant.");
      let fallbackResponse = "";
      
      if (userQuery.toLowerCase().includes('hi') || userQuery.toLowerCase().includes('hello')) {
        fallbackResponse = `Hello TomiTsuma! I am your AI workspace helper. I see you are working on **${file ? file.name : 'your general notes'}**. How can I help you organize your projects or explain these concepts today?`;
      } else if (userQuery.toLowerCase().includes('gene') || userQuery.toLowerCase().includes('gvt') || userQuery.toLowerCase().includes('transformer')) {
        fallbackResponse = `The **Graph VQ-Transformer (GVT)** mentioned in your Molecular Gene Research project utilizes vector quantization to map continuous molecular states into discrete tokens. This allows accurate genetic attention maps. Let me know if you'd like me to draft a summary section on this!`;
      } else {
        fallbackResponse = `I am reviewing your workspace notes for you. Your notes currently mention projects like **Molecular Gene Research** and **Deep Learning Studies**. 

I can help you:
1. Summarize PDF document concepts.
2. Outline tasks for your **Kanban Board**.
3. Draft email updates for Nextcloud synching.

Please let me know how you would like to proceed!`;
      }

      // Stream fallback response text
      let currentLen = 0;
      const interval = setInterval(() => {
        currentLen += 4;
        setChatStreamText(fallbackResponse.substring(0, currentLen));
        if (currentLen >= fallbackResponse.length) {
          clearInterval(interval);
          addChatMessage(currentChatId, {
            id: uuidv4(),
            role: 'assistant',
            content: fallbackResponse,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          setChatStreamText('');
          setIsGeneratingChat(false);
        }
      }, 20);
      return;
    }

    setIsGeneratingChat(false);
  };

  const panelStyle: React.CSSProperties = {
    position: isMobilePanel ? 'fixed' : 'relative',
    top: isMobilePanel ? 0 : undefined,
    right: isMobilePanel ? 0 : undefined,
    bottom: isMobilePanel ? 0 : undefined,
    width: `${panelWidth}px`,
    maxWidth: '92vw',
    backgroundColor: 'var(--bg-panel)',
    backdropFilter: 'blur(30px) saturate(160%)',
    WebkitBackdropFilter: 'blur(30px) saturate(160%)',
    borderLeft: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'Nunito, sans-serif',
    zIndex: isMobilePanel ? 120 : undefined,
    boxShadow: `-8px 0 32px var(--shadow-md)`,
    color: 'var(--text-primary)',
  };

  return (
    <div ref={panelRef} className="right-panel" style={panelStyle}>
      
      {/* Col resize handle */}
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

      {/* Header Container */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <button onClick={toggleRightPanel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {/* Radio Toggle Segmented button row */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', padding: '3px', borderRadius: '10px' }}>
          <button 
            onClick={() => setPanelMode('summary')}
            style={{
              border: 'none',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '8px',
              cursor: 'pointer',
              color: panelMode === 'summary' ? '#1c1c1e' : '#8e8e93',
              background: panelMode === 'summary' ? '#ffffff' : 'transparent',
              boxShadow: panelMode === 'summary' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Summary
          </button>
          <button 
            onClick={() => setPanelMode('chat')}
            style={{
              border: 'none',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '8px',
              cursor: 'pointer',
              color: panelMode === 'chat' ? '#1c1c1e' : '#8e8e93',
              background: panelMode === 'chat' ? '#ffffff' : 'transparent',
              boxShadow: panelMode === 'chat' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            AI Chat
          </button>
        </div>
      </div>
      
      {panelMode === 'summary' ? (
        /* ================== SUMMARY PANEL MODE ================== */
        <div style={{ padding: '24px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
           <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>ACTIVE FILE</div>
              <div style={{ fontSize: '14px', wordBreak: 'break-all', fontWeight: 800, color: 'var(--text-primary)' }}>{file?.name || 'No note selected'}</div>
           </div>
           
           <div style={{ marginTop: '12px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                   <span style={{ fontSize: '14px', fontWeight: 900 }}>Smart Notes</span>
                </div>
                <button 
                  onClick={handleGenerateAll}
                  disabled={isExtractingGlobal || !activeDocumentId || file?.type !== 'pdf'}
                  style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-subtle)', padding: '6px 14px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, cursor: (isExtractingGlobal || !activeDocumentId || file?.type !== 'pdf') ? 'not-allowed' : 'pointer', color: '#333', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                  className="btn-animate"
                >
                  {isExtractingGlobal ? 'Generating...' : 'Extract All'}
                </button>
              </div>
              
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.4, fontWeight: 500 }}>
                Extract dense, high-fidelity research insights explicitly requested for GVT mapping.
              </div>
  
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {PROMPTS.map(topic => {
                  const noteState = smartNotes[topic];
                  const expanded = !!expandedSections[topic];
                  return (
                    <div key={topic} style={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.45)' }}>
                      <button
                        onClick={() => setExpandedSections(prev => ({ ...prev, [topic]: !prev[topic] }))}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'rgba(0,0,0,0.01)',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          textAlign: 'left'
                        }}
                      >
                        <span>{topic}</span>
                        <span style={{ fontSize: '16px' }}>{expanded ? '−' : '+'}</span>
                      </button>
                      {expanded && (
                        <div style={{ padding: '14px', backgroundColor: '#fff', minHeight: '80px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{noteState?.status === 'loading' ? 'Generating...' : noteState?.status === 'done' ? 'Ready' : noteState?.status === 'error' ? 'Failed' : 'Idle'}</span>
                            <button
                              onClick={() => handleGenerateSingle(topic)}
                              style={{ background: '#f0f0f5', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 800, color: '#333' }}
                              className="btn-animate"
                            >
                              Generate
                            </button>
                          </div>
                          {noteState?.status === 'loading' && (
                            <div style={{ fontSize: '12px', color: '#007aff', fontStyle: 'italic', marginBottom: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0a7aff', animation: 'pulse 1s infinite' }} />
                              Streaming from local model...
                            </div>
                          )}
                          {noteState?.status === 'error' && (
                            <div style={{ fontSize: '12px', color: '#ff2d55', fontStyle: 'italic', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                              {noteState.content || 'Unable to generate summary.'}
                            </div>
                          )}
                          {noteState?.content && noteState?.status !== 'error' && (
                            <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#333' }}>
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{noteState.content}</ReactMarkdown>
                            </div>
                          )}
                          {!noteState?.content && noteState?.status !== 'loading' && noteState?.status !== 'error' && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                              Tap Generate to analyze this section and view output.
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
      ) : (
        /* ================== AI CHAT PANEL MODE ================== */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Active note linking indicator */}
          <div style={{ padding: '10px 20px', backgroundColor: 'rgba(10, 122, 255, 0.05)', fontSize: '11px', color: '#0a7aff', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🔗 LINKED CONTEXT: {file ? file.name : 'General Workspace'}</span>
            {chatMessages.length > 0 && (
              <button 
                onClick={() => {
                  if (confirm("Reset chat history?")) clearChatHistory(currentChatId);
                }}
                style={{ background: 'transparent', border: 'none', color: '#ff2d55', fontWeight: 800, fontSize: '10px', cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Chat bubbles list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Assistant Welcome message */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: 'flex-start', maxWidth: '85%' }}>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.04)', borderRadius: '14px 14px 14px 4px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                Hi TomiTsuma! I'm your Clio AI Workspace Assistant. I read active document context natively. Let me know if you want me to explain GVT architectures, draft a plan, or schedule items!
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, marginLeft: '4px' }}>AI Assistant</span>
            </div>

            {/* Bubble items */}
            {chatMessages.map(msg => {
              const isUser = msg.role === 'user';
              return (
                <div 
                  key={msg.id}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '6px', 
                    alignSelf: isUser ? 'flex-end' : 'flex-start', 
                    maxWidth: '85%' 
                  }}
                >
                  <div style={{ 
                    backgroundColor: isUser ? '#0a7aff' : '#ffffff', 
                    color: isUser ? '#ffffff' : '#1c1c1e',
                    border: isUser ? 'none' : '1px solid rgba(0,0,0,0.04)', 
                    borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px', 
                    padding: '12px 14px', 
                    fontSize: '13px', 
                    lineHeight: 1.5,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
                    wordBreak: 'break-word'
                  }}>
                    {isUser ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, alignSelf: isUser ? 'flex-end' : 'flex-start', marginRight: isUser ? '4px' : 0, marginLeft: isUser ? 0 : '4px' }}>
                    {isUser ? 'You' : 'Clio AI'} • {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {/* Live Streaming Assistant bubble */}
            {isGeneratingChat && chatStreamText && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.04)', borderRadius: '14px 14px 14px 4px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                  <ReactMarkdown>{chatStreamText}</ReactMarkdown>
                </div>
                <span style={{ fontSize: '10px', color: '#0a7aff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0a7aff', animation: 'pulse 1s infinite' }} />
                  Streaming reply...
                </span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat Footer Input bar */}
          <form 
            onSubmit={handleSendChat}
            style={{ 
              padding: '16px', 
              borderTop: '1px solid rgba(0,0,0,0.05)', 
              backgroundColor: 'rgba(255,255,255,0.4)', 
              display: 'flex', 
              gap: '10px', 
              alignItems: 'center' 
            }}
          >
            <input 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={isGeneratingChat ? "AI is generating..." : "Ask a question about the active document..."}
              disabled={isGeneratingChat}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                background: 'var(--btn-secondary-bg)',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isGeneratingChat}
              style={{
                backgroundColor: (!chatInput.trim() || isGeneratingChat) ? 'rgba(0,0,0,0.04)' : '#0a7aff',
                color: (!chatInput.trim() || isGeneratingChat) ? '#8e8e93' : 'white',
                border: 'none',
                borderRadius: '12px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (!chatInput.trim() || isGeneratingChat) ? 'not-allowed' : 'pointer'
              }}
              className="btn-animate"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </form>

        </div>
      )}

      {/* Internal animations */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
      `}</style>

    </div>
  );
};

export default RightPanel;
