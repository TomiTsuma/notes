import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set as idbSet, del } from 'idb-keyval';

const defaultPaperUrl = new URL('../../2512.02667v1_Graph_VQ-Transformer__GVT___Fast_and_Accurate_Molecular_Gene.pdf', import.meta.url).href;
const defaultPaperId = 'clio-default-paper';

// IndexedDB storage binding securely handling enormous PDF data payloads natively.
const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await idbSet(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export type ToolType = 'pen' | 'highlighter' | 'text' | 'eraser' | 'sticky' | 'select' | 'ruler';

export interface TextElement {
  id: string;
  x: number;
  y: number;
  text: string;
  type: 'text' | 'sticky';
}

export type Point = [number, number, number];

export interface Stroke {
  points: Point[];
  color: string;
  size: number;
  tool: 'pen' | 'highlighter';
}

export interface Paper {
  id: string;
  title: string;
  authors: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface NoteFile {
  id: string;
  name: string;
  type: string;
  folderId: string | null;
  dataUrl?: string; // Securely storing the PDF natively encoded in base 64 as standard state flow
}

export interface SmartNoteSection {
  status: 'idle' | 'loading' | 'done' | 'error';
  content: string;
}

interface DocumentAnnotations {
  strokes: Stroke[];
  textElements: TextElement[];
  smartNotes?: Record<string, SmartNoteSection>;
}

interface AppState {
  activeTool: ToolType;
  brushColor: string;
  brushSize: number;
  
  folders: Folder[];
  files: NoteFile[];
  activeDocumentId: string | null;
  annotations: Record<string, DocumentAnnotations>;
  
  papers: Paper[];
  nextcloudUrl: string;
  nextcloudUsername: string;
  nextcloudConnected: boolean;
  nextcloudStatus: 'idle' | 'connecting' | 'connected' | 'failed';
  nextcloudError: string | null;

  isRecording: boolean;
  showRightPanel: boolean;

  setActiveTool: (tool: ToolType) => void;
  setBrushColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  
  addFolder: (folder: Folder) => void;
  addFile: (file: NoteFile) => void;
  deleteFolder: (id: string) => void;
  deleteFile: (id: string) => void;
  updateFolder: (id: string, name: string) => void;
  updateFile: (id: string, name: string) => void;
  setActiveDocument: (id: string | null) => void;
  setNextcloudConfig: (url: string, username: string) => void;
  setNextcloudConnectionState: (connected: boolean, status: 'idle' | 'connecting' | 'connected' | 'failed', error?: string | null) => void;

  toggleRecording: () => void;
  toggleRightPanel: () => void;
  undo: () => void;
  translateStrokes: (docId: string, strokeIndices: number[], dx: number, dy: number) => void;

  setStrokes: (docId: string, strokesFn: (prev: Stroke[]) => Stroke[]) => void;
  addTextElement: (docId: string, element: TextElement) => void;
  updateTextElement: (docId: string, textId: string, text: string) => void;
  deleteTextElement: (docId: string, textId: string) => void;
  updateTextElementPosition: (docId: string, textId: string, x: number, y: number) => void;

  setSmartNoteStatus: (docId: string, section: string, status: 'idle' | 'loading' | 'done' | 'error', content?: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTool: 'pen',
      brushColor: '#1c1c1e',
      brushSize: 4,
      
      folders: [],
      files: [
        {
          id: defaultPaperId,
          name: '2512.02667v1_Graph_VQ-Transformer__GVT___Fast_and_Accurate_Molecular_Gene.pdf',
          type: 'pdf',
          folderId: null,
          dataUrl: defaultPaperUrl,
        }
      ],
      activeDocumentId: defaultPaperId,
      annotations: {},
      isRecording: false,
      showRightPanel: false,
      
      papers: [
        { id: '1', title: 'Attention Is All You Need', authors: 'Vaswani et al.' },
        { id: '2', title: 'ResNet: Deep Residual Learning for Image Recognition', authors: 'He et al.' },
      ],
      nextcloudUrl: 'http://100.100.133.10:30027',
      nextcloudUsername: '',
      nextcloudConnected: false,
      nextcloudStatus: 'idle',
      nextcloudError: null,

      setActiveTool: (tool) => set({ activeTool: tool }),
      setBrushColor: (color) => set({ brushColor: color }),
      setBrushSize: (size) => set({ brushSize: size }),
      
      addFolder: (folder: Folder) => set(state => ({ folders: [...state.folders, folder] })),
      addFile: (file: NoteFile) => set(state => ({ files: [...state.files, file], activeDocumentId: file.id })),
      deleteFolder: (id: string) => set(state => ({ folders: state.folders.filter(f => f.id !== id) })),
      deleteFile: (id: string) => set(state => ({ files: state.files.filter(f => f.id !== id), activeDocumentId: state.activeDocumentId === id ? null : state.activeDocumentId })),
      updateFolder: (id: string, name: string) => set(state => ({ folders: state.folders.map(f => f.id === id ? { ...f, name } : f) })),
      updateFile: (id: string, name: string) => set(state => ({ files: state.files.map(f => f.id === id ? { ...f, name } : f) })),
      setActiveDocument: (id: string | null) => set({ activeDocumentId: id }),
      setNextcloudConfig: (url: string, username: string) => set({ nextcloudUrl: url, nextcloudUsername: username }),
      setNextcloudConnectionState: (connected: boolean, status: 'idle' | 'connecting' | 'connected' | 'failed', error?: string | null) => set({ nextcloudConnected: connected, nextcloudStatus: status, nextcloudError: error || null }),

      toggleRecording: () => set(state => ({ isRecording: !state.isRecording })),
      toggleRightPanel: () => set(state => ({ showRightPanel: !state.showRightPanel })),
      undo: () => set(state => {
        if (!state.activeDocumentId) return state;
        const docAnn = state.annotations[state.activeDocumentId];
        if (!docAnn || docAnn.strokes.length === 0) return state;
        return {
          annotations: {
            ...state.annotations,
            [state.activeDocumentId]: { ...docAnn, strokes: docAnn.strokes.slice(0, -1) }
          }
        };
      }),
      
      translateStrokes: (docId, strokeIndices, dx, dy) => set(state => {
        const docAnn = state.annotations[docId];
        if (!docAnn) return state;
        const newStrokes = [...docAnn.strokes];
        strokeIndices.forEach(idx => {
          if (newStrokes[idx]) {
            newStrokes[idx] = {
              ...newStrokes[idx],
              points: newStrokes[idx].points.map(p => [p[0] + dx, p[1] + dy, p[2]])
            };
          }
        });
        return {
          annotations: {
            ...state.annotations,
            [docId]: { ...docAnn, strokes: newStrokes }
          }
        };
      }),

      setStrokes: (docId, strokesFn) => set(state => {
        const docAnn = state.annotations[docId] || { strokes: [], textElements: [] };
        return {
          annotations: {
            ...state.annotations,
            [docId]: { ...docAnn, strokes: strokesFn(docAnn.strokes) }
          }
        };
      }),

      addTextElement: (docId, element) => set(state => {
        const docAnn = state.annotations[docId] || { strokes: [], textElements: [] };
        return {
          annotations: {
            ...state.annotations,
            [docId]: { ...docAnn, textElements: [...docAnn.textElements, element] }
          }
        };
      }),

      deleteTextElement: (docId, textId) => set(state => {
        const docAnn = state.annotations[docId] || { strokes: [], textElements: [] };
        return {
          annotations: {
            ...state.annotations,
            [docId]: { ...docAnn, textElements: docAnn.textElements.filter(te => te.id !== textId) }
          }
        };
      }),

      updateTextElementPosition: (docId, textId, x, y) => set(state => {
        const docAnn = state.annotations[docId] || { strokes: [], textElements: [] };
        return {
          annotations: {
            ...state.annotations,
            [docId]: {
              ...docAnn,
              textElements: docAnn.textElements.map(te => te.id === textId ? { ...te, x, y } : te)
            }
          }
        };
      }),

      setSmartNoteStatus: (docId, section, status, content) => set(state => {
        const docAnn = state.annotations[docId] || { strokes: [], textElements: [] };
        const sn = docAnn.smartNotes || {};
        const existingContent = sn[section]?.content || '';
        return {
          annotations: {
            ...state.annotations,
            [docId]: {
              ...docAnn,
              smartNotes: {
                ...sn,
                [section]: { status, content: content !== undefined ? content : existingContent }
              }
            }
          }
        };
      }),

      updateTextElement: (docId, textId, text) => set(state => {
        const docAnn = state.annotations[docId] || { strokes: [], textElements: [] };
        return {
          annotations: {
            ...state.annotations,
            [docId]: {
              ...docAnn,
              textElements: docAnn.textElements.map(te => te.id === textId ? { ...te, text } : te)
            }
          }
        };
      }),
    }),
    {
      name: 'clio-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
