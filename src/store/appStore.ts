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

const calculateNextStreak = (currentStreak: number, lastActiveDate: string, today: string): number => {
  if (lastActiveDate === today) return currentStreak;

  const lastDate = new Date(lastActiveDate);
  const todayDate = new Date(today);

  // Calculate difference in days
  const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return currentStreak + 1;
  } else {
    return 1; // Reset to 1 if gap is more than 1 day
  }
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
  projectId?: string | null; // Associated project ID
  remotePath?: string; // Path on Nextcloud for persistence
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

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
}

export interface KanbanTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'todo' | 'inprogress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  projectId: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface UserStreak {
  streakCount: number;
  lastActiveDate: string;
  totalTasksCompleted: number;
  totalNotesCreated: number;
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

  // New Productivity Suite State
  activeView: 'home' | 'projects' | 'kanban' | 'calendar' | 'canvas';
  selectedProjectId: string | null;
  currentBackground: string;
  projects: Project[];
  kanbanTasks: KanbanTask[];
  calendarEvents: CalendarEvent[];
  chatHistory: Record<string, ChatMessage[]>;
  userStreak: UserStreak;

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

  // New Productivity Actions
  setActiveView: (view: 'home' | 'projects' | 'kanban' | 'calendar' | 'canvas') => void;
  setSelectedProjectId: (id: string | null) => void;
  addProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  updateProject: (id: string, project: Partial<Project>) => void;
  addKanbanTask: (task: KanbanTask) => void;
  updateKanbanTask: (id: string, task: Partial<KanbanTask>) => void;
  deleteKanbanTask: (id: string) => void;
  addCalendarEvent: (event: CalendarEvent) => void;
  updateCalendarEvent: (id: string, event: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  addChatMessage: (docOrProjId: string, message: ChatMessage) => void;
  clearChatHistory: (docOrProjId: string) => void;
  rotateBackground: () => void;
  updateStreak: (streak: Partial<UserStreak>) => void;
  associateFileToProject: (fileId: string, projectId: string | null) => void;
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
          projectId: 'proj-1'
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

      // New Productivity State Init
      activeView: 'home',
      selectedProjectId: null,
      currentBackground: '/bkg1.jpeg',
      projects: [
        { id: 'proj-1', name: 'Molecular Gene Research', description: 'Exploring Graph VQ-Transformer methods', color: '#0a7aff', createdAt: new Date().toISOString() },
        { id: 'proj-2', name: 'Deep Learning Studies', description: 'Investigating standard architectures like Attention and ResNet', color: '#34c759', createdAt: new Date().toISOString() }
      ],
      kanbanTasks: [
        { id: 'task-1', projectId: 'proj-1', title: 'Extract PDF Smart Notes', description: 'Complete smart summaries for the Gene paper.', status: 'inprogress', priority: 'high', dueDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() },
        { id: 'task-2', projectId: 'proj-1', title: 'Review GVT Architecture', description: 'Analyze Graph VQ-Transformer structural layers.', status: 'todo', priority: 'medium', dueDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() },
        { id: 'task-3', projectId: 'proj-2', title: 'Replicate ResNet', description: 'Implement a ResNet50 in PyTorch.', status: 'done', priority: 'low', dueDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() }
      ],
      calendarEvents: [
        { id: 'ev-1', title: 'Weekly Project Review', description: 'Going over deep learning summaries', date: new Date().toISOString().split('T')[0], startTime: '10:00', endTime: '11:30', projectId: 'proj-2', createdAt: new Date().toISOString() }
      ],
      chatHistory: {},
      userStreak: {
        streakCount: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
        totalTasksCompleted: 0,
        totalNotesCreated: 0
      },

      setActiveTool: (tool) => set({ activeTool: tool }),
      setBrushColor: (color) => set({ brushColor: color }),
      setBrushSize: (size) => set({ brushSize: size }),
      
      addFolder: (folder) => set(state => ({ folders: [...state.folders, folder] })),
      addFile: (file) => set(state => {
        const nextActive = file.id;
        const totalNotes = state.userStreak.totalNotesCreated + 1;
        const today = new Date().toISOString().split('T')[0];
        const streak = calculateNextStreak(state.userStreak.streakCount, state.userStreak.lastActiveDate, today);
        return {
          files: [...state.files, file],
          activeDocumentId: nextActive,
          activeView: 'canvas',
          userStreak: {
            ...state.userStreak,
            totalNotesCreated: totalNotes,
            lastActiveDate: today,
            streakCount: streak
          }
        };
      }),
      deleteFolder: (id) => set(state => ({ folders: state.folders.filter(f => f.id !== id) })),
      deleteFile: (id) => set(state => ({ files: state.files.filter(f => f.id !== id), activeDocumentId: state.activeDocumentId === id ? null : state.activeDocumentId })),
      updateFolder: (id, name) => set(state => ({ folders: state.folders.map(f => f.id === id ? { ...f, name } : f) })),
      updateFile: (id, updated) => set(state => ({ files: state.files.map(f => f.id === id ? { ...f, ...updated } : f) })),
      setActiveDocument: (id) => set({ activeDocumentId: id, activeView: id ? 'canvas' : 'home' }),
      setNextcloudConfig: (url, username) => set({ nextcloudUrl: url, nextcloudUsername: username }),
      setNextcloudConnectionState: (connected, status, error) => set({ nextcloudConnected: connected, nextcloudStatus: status, nextcloudError: error || null }),

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

      // New Productivity Actions Impl
      setActiveView: (view) => set({ activeView: view }),
      setSelectedProjectId: (id) => set({ selectedProjectId: id }),
      addProject: (project) => set(state => ({ projects: [...state.projects, project] })),
      deleteProject: (id) => set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        kanbanTasks: state.kanbanTasks.filter(t => t.projectId !== id),
        files: state.files.map(f => f.projectId === id ? { ...f, projectId: null } : f),
        selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
        activeView: state.selectedProjectId === id ? 'home' : state.activeView
      })),
      updateProject: (id, updated) => set(state => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...updated } : p)
      })),
      addKanbanTask: (task) => set(state => ({ kanbanTasks: [...state.kanbanTasks, task] })),
      updateKanbanTask: (id, updated) => set(state => {
        const nextTasks = state.kanbanTasks.map(t => t.id === id ? { ...t, ...updated } : t);
        const taskObj = state.kanbanTasks.find(t => t.id === id);
        let completedInc = 0;
        let streakUpdate = {};
        if (taskObj && taskObj.status !== 'done' && updated.status === 'done') {
          completedInc = 1;
          const today = new Date().toISOString().split('T')[0];
          streakUpdate = {
            streakCount: calculateNextStreak(state.userStreak.streakCount, state.userStreak.lastActiveDate, today),
            lastActiveDate: today
          };
        }
        return {
          kanbanTasks: nextTasks,
          userStreak: {
            ...state.userStreak,
            totalTasksCompleted: state.userStreak.totalTasksCompleted + completedInc,
            ...streakUpdate
          }
        };
      }),
      deleteKanbanTask: (id) => set(state => ({ kanbanTasks: state.kanbanTasks.filter(t => t.id !== id) })),
      addCalendarEvent: (event) => set(state => ({ calendarEvents: [...state.calendarEvents, event] })),
      updateCalendarEvent: (id, updated) => set(state => ({
        calendarEvents: state.calendarEvents.map(e => e.id === id ? { ...e, ...updated } : e)
      })),
      deleteCalendarEvent: (id) => set(state => ({ calendarEvents: state.calendarEvents.filter(e => e.id !== id) })),
      addChatMessage: (id, message) => set(state => {
        const currentChat = state.chatHistory[id] || [];
        return {
          chatHistory: {
            ...state.chatHistory,
            [id]: [...currentChat, message]
          }
        };
      }),
      clearChatHistory: (id) => set(state => {
        const newHistory = { ...state.chatHistory };
        delete newHistory[id];
        return { chatHistory: newHistory };
      }),
      rotateBackground: () => set(state => {
        const nextIdx = Math.floor(Math.random() * 5) + 1;
        return { currentBackground: `/bkg${nextIdx}.jpeg` };
      }),
      updateStreak: (updated) => set(state => ({ userStreak: { ...state.userStreak, ...updated } })),
      associateFileToProject: (fileId, projectId) => set(state => ({
        files: state.files.map(f => f.id === fileId ? { ...f, projectId } : f)
      }))
    }),
    {
      name: 'clio-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);

