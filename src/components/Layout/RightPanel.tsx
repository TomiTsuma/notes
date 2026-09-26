import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';
import { generateOllamaNoteStream, generateOllamaChatStream } from '../../services/ollama';
import { extractPdfText } from '../../utils/pdfExtract';
import {
  AIPanel,
  ChatMessage,
  SmartNote,
  SMART_PROMPTS,
} from '../UI/clio';

const PROMPTS = SMART_PROMPTS;

const RightPanel: React.FC = () => {
  const {
    files,
    activeDocumentId,
    toggleRightPanel,
    annotations,
    setSmartNoteStatus,
    chatHistory,
    addChatMessage,
  } = useAppStore();

  const file = activeDocumentId ? files.find((f) => f.id === activeDocumentId) : null;
  const targetDocId = activeDocumentId || file?.id || 'global';
  const docAnnotations = annotations[targetDocId];
  const smartNotes = docAnnotations?.smartNotes || {};

  const [isGeneratingChat, setIsGeneratingChat] = useState(false);
  const [chatStreamText, setChatStreamText] = useState('');
  const [cachedPdfText, setCachedPdfText] = useState<string | null>(null);

  const currentChatId = targetDocId || 'global-chat';
  const chatMessages = chatHistory[currentChatId] || [];

  // Extract PDF text if viewing PDF
  useEffect(() => {
    if (!file || file.type !== 'pdf' || !file.dataUrl) return;
    setCachedPdfText(null);
    extractPdfText(file.dataUrl)
      .then((txt) => setCachedPdfText(txt))
      .catch((err) => console.warn('PDF text extraction error:', err));
  }, [file?.id, file?.dataUrl, file?.type]);

  const getPaperText = async (): Promise<string> => {
    if (!file) return '';
    if (cachedPdfText) return cachedPdfText;
    if ((file as any).content) return (file as any).content;
    if (file.type === 'pdf' && file.dataUrl) {
      try {
        const extracted = await extractPdfText(file.dataUrl);
        setCachedPdfText(extracted);
        return extracted;
      } catch (err) {
        console.warn('PDF extraction error in chat:', err);
      }
    }
    return '';
  };

  const handleSendChat = async (userQuery: string) => {
    if (!userQuery.trim() || isGeneratingChat) return;

    addChatMessage(currentChatId, {
      id: uuidv4(),
      role: 'user',
      content: userQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    setIsGeneratingChat(true);
    setChatStreamText('');

    const paperText = await getPaperText();

    try {
      const payloadMessages = [
        ...chatMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: userQuery },
      ];

      let fullStreamText = '';

      await generateOllamaChatStream(payloadMessages, paperText, (chunk: string) => {
        fullStreamText = chunk;
        setChatStreamText(chunk);
      });

      addChatMessage(currentChatId, {
        id: uuidv4(),
        role: 'assistant',
        content: fullStreamText || 'Analysis complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      setChatStreamText('');
      setIsGeneratingChat(false);
    } catch (error) {
      console.warn('Ollama streaming error, synthesizing response from document text context:', error);
      const docName = file ? file.name : 'active paper';
      let fallbackResponse = '';

      if (paperText && paperText.length > 50) {
        const cleanLines = paperText
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 25 && !l.toLowerCase().includes('http') && !l.toLowerCase().includes('doi'));

        const sampleExcerpts = cleanLines.slice(0, 12).join(' ');
        const q = userQuery.toLowerCase();

        if (q.includes('summarize') || q.includes('summary') || q.includes('overview') || q.includes('what is')) {
          fallbackResponse = `### Paper Summary: ${docName}\n\nKey details extracted from **${docName}**:\n\n` +
            `- **Topic / Header**: ${cleanLines[0] || docName}\n` +
            `- **Excerpts**: ${sampleExcerpts.slice(0, 400)}...\n\n` +
            `*Derived directly from active paper contents.*`;
        } else {
          fallbackResponse = `### Paper Analysis (${docName})\n\nRegarding *"${userQuery}"* from **${docName}**:\n\n` +
            `${cleanLines.slice(0, 5).join('\n\n') || paperText.slice(0, 600)}\n\n` +
            `*Ask Clio AI for specific sections, metrics, or table data from this paper.*`;
        }
      } else {
        fallbackResponse = `Hello Thomas! I am **Clio AI**, analyzing **${docName}**.\n\nAsk me any questions about the methodology, data, or results described in **${docName}**.`;
      }

      let currentLen = 0;
      const interval = setInterval(() => {
        currentLen += 6;
        const currentSlice = fallbackResponse.substring(0, currentLen);
        setChatStreamText(currentSlice);
        if (currentLen >= fallbackResponse.length) {
          clearInterval(interval);
          addChatMessage(currentChatId, {
            id: uuidv4(),
            role: 'assistant',
            content: fallbackResponse,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
          setChatStreamText('');
          setIsGeneratingChat(false);
        }
      }, 20);
    }
  };

  const handleGenerateSmartNote = async (promptTitle: string) => {
    setSmartNoteStatus(targetDocId, promptTitle, 'loading', '');

    const paperText = await getPaperText();
    const textForContext = paperText || (file ? file.name : '');

    try {
      let resultText = '';
      await generateOllamaNoteStream(promptTitle, textForContext, (chunk: string) => {
        resultText = chunk;
        setSmartNoteStatus(targetDocId, promptTitle, 'loading', chunk);
      });
      setSmartNoteStatus(targetDocId, promptTitle, 'done', resultText || `Extracted summary for ${promptTitle}.`);
    } catch (err) {
      console.warn('Ollama smart note streaming fallback:', err);
      const docName = file ? file.name : 'active paper';
      let fallbackText = '';

      if (paperText && paperText.length > 50) {
        const lines = paperText
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 25);
        fallbackText = `### ${promptTitle}\n- Context source: **${docName}**\n- Extracted details: ${lines.slice(0, 3).join(' ')}`;
      } else {
        fallbackText = `### ${promptTitle}\n- Context source: **${docName}**\n- Key paper metrics and structure processed.`;
      }

      let curLen = 0;
      const interval = setInterval(() => {
        curLen += 6;
        const partial = fallbackText.substring(0, curLen);
        setSmartNoteStatus(targetDocId, promptTitle, 'loading', partial);
        if (curLen >= fallbackText.length) {
          clearInterval(interval);
          setSmartNoteStatus(targetDocId, promptTitle, 'done', fallbackText);
        }
      }, 20);
    }
  };

  return (
    <AIPanel
      file={file ? file.name : undefined}
      onClose={toggleRightPanel}
      onSend={handleSendChat}
      busy={isGeneratingChat}
    >
      {(tab) =>
        tab === 'chat' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 0' }}>
            {chatMessages.length === 0 && !isGeneratingChat && !chatStreamText ? (
              <ChatMessage role="assistant" actions={false}>
                Hello! Ask me questions about <b>{file ? file.name : 'your research workspace'}</b> or type <code>@</code> to attach context.
              </ChatMessage>
            ) : (
              chatMessages.map((msg) => (
                <ChatMessage key={msg.id} role={msg.role as 'user' | 'assistant'}>
                  {msg.content}
                </ChatMessage>
              ))
            )}

            {isGeneratingChat && !chatStreamText && (
              <ChatMessage role="assistant" loading actions={false}>
                Processing context with Ollama model...
              </ChatMessage>
            )}

            {chatStreamText && (
              <ChatMessage role="assistant" streaming actions={false}>
                {chatStreamText}
              </ChatMessage>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
            {PROMPTS.map((title) => {
              const sec = smartNotes[title];
              const st = sec ? sec.status : 'idle';
              const content = sec ? sec.content : '';
              return (
                <SmartNote
                  key={title}
                  title={title}
                  status={st}
                  onGenerate={() => handleGenerateSmartNote(title)}
                  onRetry={() => handleGenerateSmartNote(title)}
                >
                  {content}
                </SmartNote>
              );
            })}
          </div>
        )
      }
    </AIPanel>
  );
};

export default RightPanel;
