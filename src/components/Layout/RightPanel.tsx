import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';
import { generateOllamaNoteStream, generateOllamaChatStream, OLLAMA_MODEL } from '../../services/ollama';
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
    clearChatHistory,
    addTextElement,
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
    const trimmedQuery = userQuery.trim();
    if (!trimmedQuery || isGeneratingChat) return;

    addChatMessage(currentChatId, {
      id: uuidv4(),
      role: 'user',
      content: trimmedQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    setIsGeneratingChat(true);
    setChatStreamText('');

    const paperText = await getPaperText();

    try {
      let fullStreamText = '';

      // Answer each question independently via Ollama on OLLAMA_URL
      await generateOllamaChatStream(trimmedQuery, paperText, (chunk: string) => {
        fullStreamText = chunk;
        setChatStreamText(chunk);
      });

      addChatMessage(currentChatId, {
        id: uuidv4(),
        role: 'assistant',
        content: fullStreamText || 'No response generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (error: any) {
      console.error('Ollama chat error:', error);
      addChatMessage(currentChatId, {
        id: uuidv4(),
        role: 'assistant',
        content: `> [!WARNING]\n> **Could not reach Ollama (${OLLAMA_MODEL}):** ${error?.message || 'Connection failed'}. Please verify the Ollama server is running at \`OLLAMA_URL\`.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setChatStreamText('');
      setIsGeneratingChat(false);
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
    } catch (err: any) {
      console.error('Ollama smart note error:', err);
      setSmartNoteStatus(targetDocId, promptTitle, 'error', err?.message || 'Failed to reach Ollama.');
    }
  };

  const handleInsertIntoNote = (content: string) => {
    if (!activeDocumentId) return;
    const pageDocId = `${activeDocumentId}-page-1`;
    addTextElement(pageDocId, {
      id: `sticky-${Date.now()}`,
      x: 120,
      y: 120,
      text: content.slice(0, 600),
      type: 'sticky',
    });
  };

  return (
    <AIPanel
      file={file ? file.name : undefined}
      onClose={toggleRightPanel}
      onClear={() => clearChatHistory(currentChatId)}
      onSend={handleSendChat}
      busy={isGeneratingChat}
    >
      {(tab) =>
        tab === 'chat' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0 24px', flexShrink: 0 }}>
            {chatMessages.length === 0 && !isGeneratingChat && !chatStreamText ? (
              <ChatMessage role="assistant" actions={false}>
                {`### Ask Chlio\nAsk any question about **${file ? file.name : 'your active paper or research topic'}** — each question is answered independently by \`${OLLAMA_MODEL}\`.`}
              </ChatMessage>
            ) : (
              chatMessages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role as 'user' | 'assistant'}
                  onInsert={() => handleInsertIntoNote(msg.content)}
                >
                  {msg.content}
                </ChatMessage>
              ))
            )}

            {isGeneratingChat && !chatStreamText && (
              <ChatMessage role="assistant" loading actions={false}>
                {`Waiting for ${OLLAMA_MODEL} on Ollama...`}
              </ChatMessage>
            )}

            {chatStreamText && (
              <ChatMessage role="assistant" streaming actions={false}>
                {chatStreamText}
              </ChatMessage>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0 24px', flexShrink: 0 }}>
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
