import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import type { MindMapBoard, MindMapNode, MindMapEdge, MindMapNodeType, Stroke, Point } from '../../store/appStore';
import {
  lookupPaperByIdentifier,
  fetchAndUploadArxivPaper,
  fetchPaperBibtex,
  fetchPaperCitations,
} from '../../services/nextcloud';
import { Button, Icon, IconButton, Modal, TextField, Tag } from '../UI/clio';

type BoardTool = 'select' | 'hand' | 'connect' | 'idea' | 'sticky' | 'point' | 'paper' | 'pen' | 'highlighter' | 'eraser';

const NODE_TONES: Record<
  string,
  { bg: string; border: string; headerBg: string; accent: string; text: string; badgeBg: string }
> = {
  sky: {
    bg: '#f0f7ff',
    border: '#93c5fd',
    headerBg: '#dbeafe',
    accent: '#0a7aff',
    text: '#1e293b',
    badgeBg: 'rgba(10, 122, 255, 0.12)',
  },
  amber: {
    bg: '#fffbeb',
    border: '#fcd34d',
    headerBg: '#fef3c7',
    accent: '#d97706',
    text: '#292524',
    badgeBg: 'rgba(217, 119, 6, 0.14)',
  },
  rose: {
    bg: '#fff1f2',
    border: '#fda4af',
    headerBg: '#ffe4e6',
    accent: '#e11d48',
    text: '#1e293b',
    badgeBg: 'rgba(225, 29, 72, 0.12)',
  },
  sage: {
    bg: '#ecfdf5',
    border: '#6ee7b7',
    headerBg: '#d1fae5',
    accent: '#059669',
    text: '#1e293b',
    badgeBg: 'rgba(5, 150, 105, 0.12)',
  },
  lilac: {
    bg: '#f5f3ff',
    border: '#c4b5fd',
    headerBg: '#ede9fe',
    accent: '#7c3aed',
    text: '#1e293b',
    badgeBg: 'rgba(124, 58, 237, 0.12)',
  },
  stone: {
    bg: '#f8fafc',
    border: '#cbd5e1',
    headerBg: '#e2e8f0',
    accent: '#475569',
    text: '#1e293b',
    badgeBg: 'rgba(71, 85, 105, 0.12)',
  },
};

const INK_PALETTE = ['#1e293b', '#0a7aff', '#e11d48', '#059669', '#d97706', '#7c3aed'];

function getSvgPathFromPoints(points: Point[]): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${x} ${y} L ${x + 0.1} ${y}`;
  }
  const parts: string[] = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${points[i][0]} ${points[i][1]}`);
  }
  return parts.join(' ');
}

function getNodeCenter(node: MindMapNode): { x: number; y: number; w: number; h: number } {
  const w = node.width || (node.type === 'sticky' ? 220 : 260);
  const h = node.height || (node.type === 'sticky' ? 175 : node.type === 'paper' ? 165 : 145);
  return { x: node.x + w / 2, y: node.y + h / 2, w, h };
}

function computeEdgeGeometry(fromNode: MindMapNode, toNode: MindMapNode) {
  const c1 = getNodeCenter(fromNode);
  const c2 = getNodeCenter(toNode);
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;

  let sx = c1.x;
  let sy = c1.y;
  let tx = c2.x;
  let ty = c2.y;
  let c1x = c1.x;
  let c1y = c1.y;
  let c2x = c2.x;
  let c2y = c2.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const dir = dx >= 0 ? 1 : -1;
    sx = c1.x + dir * (c1.w / 2);
    sy = c1.y;
    tx = c2.x - dir * (c2.w / 2);
    ty = c2.y;
    const offset = Math.max(60, Math.abs(tx - sx) * 0.45);
    c1x = sx + dir * offset;
    c1y = sy;
    c2x = tx - dir * offset;
    c2y = ty;
  } else {
    const dir = dy >= 0 ? 1 : -1;
    sx = c1.x;
    sy = c1.y + dir * (c1.h / 2);
    tx = c2.x;
    ty = c2.y - dir * (c2.h / 2);
    const offset = Math.max(60, Math.abs(ty - sy) * 0.45);
    c1x = sx;
    c1y = sy + dir * offset;
    c2x = tx;
    c2y = ty - dir * offset;
  }

  const path = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
  const midX = 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * tx;
  const midY = 0.125 * sy + 0.375 * c1y + 0.375 * c2y + 0.125 * ty;

  return { path, sx, sy, tx, ty, midX, midY };
}

const MindMapView: React.FC = () => {
  const {
    mindMapBoards,
    activeMindMapId,
    setActiveMindMapId,
    addMindMapBoard,
    updateMindMapBoard,
    deleteMindMapBoard,
    files,
    papers,
    projects,
    addFile,
    setActiveDocument,
    setActiveView,
    setTargetPdfPage,
    nextcloudSyncPath,
  } = useAppStore();

  const activeBoard: MindMapBoard | undefined = useMemo(() => {
    if (mindMapBoards.length === 0) return undefined;
    return mindMapBoards.find((b) => b.id === activeMindMapId) || mindMapBoards[0];
  }, [mindMapBoards, activeMindMapId]);

  const [tool, setTool] = useState<BoardTool>('select');
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 40 });
  const [zoom, setZoom] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Connecting state
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectCursorWorld, setConnectCursorWorld] = useState<{ x: number; y: number } | null>(null);

  // Freehand ink settings
  const [inkColor, setInkColor] = useState<string>('#0a7aff');
  const [inkSize, setInkSize] = useState<number>(4);
  const [liveStrokePoints, setLiveStrokePoints] = useState<Point[]>([]);

  // Modals
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardProjectId, setNewBoardProjectId] = useState<string>('');

  const [showPaperModal, setShowPaperModal] = useState(false);
  const [paperModalTargetNodeId, setPaperModalTargetNodeId] = useState<string | null>(null);
  const [paperFilter, setPaperFilter] = useState('');
  const [externalPaperQuery, setExternalPaperQuery] = useState('');
  const [isLookingUpExternal, setIsLookingUpExternal] = useState(false);
  const [isImportingExternal, setIsImportingExternal] = useState(false);
  const [externalPreview, setExternalPreview] = useState<{
    title: string;
    authors: string;
    arxivId: string | null;
    doi: string | null;
  } | null>(null);
  const [externalError, setExternalError] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Interaction refs
  const interactionRef = useRef<{
    mode: 'none' | 'pan' | 'drag-node' | 'connect-drag' | 'draw' | 'erase';
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    nodeId?: string;
    startNodeX?: number;
    startNodeY?: number;
    strokePoints?: Point[];
  }>({
    mode: 'none',
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // Ensure a board is always available
  useEffect(() => {
    if (mindMapBoards.length === 0) {
      const id = 'board-' + Date.now();
      addMindMapBoard({
        id,
        name: 'Research Mind Map',
        nodes: [],
        edges: [],
        strokes: [],
        updatedAt: new Date().toISOString(),
      });
    } else if (!activeMindMapId || !mindMapBoards.some((b) => b.id === activeMindMapId)) {
      setActiveMindMapId(mindMapBoards[0].id);
    }
  }, [mindMapBoards.length, activeMindMapId]);

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const z = zoomRef.current || 1;
    return {
      x: (clientX - rect.left - panRef.current.x) / z,
      y: (clientY - rect.top - panRef.current.y) / z,
    };
  }, []);

  const updateBoard = useCallback(
    (updater: (board: MindMapBoard) => Partial<MindMapBoard>) => {
      if (!activeBoard) return;
      updateMindMapBoard(activeBoard.id, updater(activeBoard));
    },
    [activeBoard, updateMindMapBoard]
  );

  // Add a node at world coordinates
  const addNodeAt = useCallback(
    (type: MindMapNodeType, worldX: number, worldY: number, extra?: Partial<MindMapNode>): string => {
      const id = 'mm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const defaultTone =
        type === 'idea' ? 'sky' : type === 'sticky' ? 'amber' : type === 'paper' ? 'rose' : 'lilac';
      const defaultTitle =
        type === 'idea'
          ? 'New Idea'
          : type === 'sticky'
          ? 'Sticky Note'
          : type === 'paper'
          ? 'Linked Paper'
          : 'Key Point';
      const defaultContent =
        type === 'idea'
          ? 'Double-click or type to elaborate on this concept…'
          : type === 'sticky'
          ? '• Jot down quick thoughts…'
          : type === 'paper'
          ? 'Notes or takeaways from this paper…'
          : '• Observation / scribble point';

      const w = type === 'sticky' ? 220 : 260;
      const newNode: MindMapNode = {
        id,
        type,
        x: Math.round(worldX - w / 2),
        y: Math.round(worldY - 60),
        width: w,
        title: defaultTitle,
        content: defaultContent,
        color: defaultTone,
        ...extra,
      };

      updateBoard((b) => ({
        nodes: [...b.nodes, newNode],
      }));
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
      return id;
    },
    [updateBoard]
  );

  // Sprout a connected child idea node in a direction ('top' | 'right' | 'bottom' | 'left')
  const handleSproutChild = useCallback(
    (parentNode: MindMapNode, direction: 'top' | 'right' | 'bottom' | 'left') => {
      if (!activeBoard) return;
      const offsetMap = {
        right: { dx: 340, dy: 0 },
        left: { dx: -340, dy: 0 },
        bottom: { dx: 0, dy: 230 },
        top: { dx: 0, dy: -230 },
      };
      const { dx, dy } = offsetMap[direction];
      const newId = 'mm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const childNode: MindMapNode = {
        id: newId,
        type: 'idea',
        x: parentNode.x + dx,
        y: parentNode.y + dy,
        width: 250,
        title: 'Connected Idea',
        content: 'Elaborate on this branch…',
        color: parentNode.color || 'sky',
      };
      const newEdge: MindMapEdge = {
        id: 'edge-' + Date.now(),
        fromNodeId: parentNode.id,
        toNodeId: newId,
        color: NODE_TONES[parentNode.color]?.accent || '#0a7aff',
        style: 'solid',
      };
      updateBoard((b) => ({
        nodes: [...b.nodes, childNode],
        edges: [...b.edges, newEdge],
      }));
      setSelectedNodeId(newId);
      setSelectedEdgeId(null);
    },
    [activeBoard, updateBoard]
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, patch: Partial<MindMapNode>) => {
      updateBoard((b) => ({
        nodes: b.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
      }));
    },
    [updateBoard]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      updateBoard((b) => ({
        nodes: b.nodes.filter((n) => n.id !== nodeId),
        edges: b.edges.filter((e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId),
      }));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [updateBoard, selectedNodeId]
  );

  const handleUpdateEdge = useCallback(
    (edgeId: string, patch: Partial<MindMapEdge>) => {
      updateBoard((b) => ({
        edges: b.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
      }));
    },
    [updateBoard]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      updateBoard((b) => ({
        edges: b.edges.filter((e) => e.id !== edgeId),
      }));
      if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
    },
    [updateBoard, selectedEdgeId]
  );

  const createEdgeBetween = useCallback(
    (fromId: string, toId: string) => {
      if (!activeBoard || fromId === toId) return;
      const exists = activeBoard.edges.some(
        (e) =>
          (e.fromNodeId === fromId && e.toNodeId === toId) ||
          (e.fromNodeId === toId && e.toNodeId === fromId)
      );
      if (exists) return;
      const fromNode = activeBoard.nodes.find((n) => n.id === fromId);
      const accent = fromNode ? NODE_TONES[fromNode.color]?.accent || '#0a7aff' : '#0a7aff';
      const newEdge: MindMapEdge = {
        id: 'edge-' + Date.now(),
        fromNodeId: fromId,
        toNodeId: toId,
        color: accent,
        style: 'solid',
      };
      updateBoard((b) => ({
        edges: [...b.edges, newEdge],
      }));
      setSelectedEdgeId(newEdge.id);
      setSelectedNodeId(null);
    },
    [activeBoard, updateBoard]
  );

  // Fit all nodes into viewport
  const handleFitView = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !activeBoard || activeBoard.nodes.length === 0) {
      setPan({ x: 60, y: 40 });
      setZoom(1);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    activeBoard.nodes.forEach((n) => {
      const w = n.width || 260;
      const h = n.height || 160;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w);
      maxY = Math.max(maxY, n.y + h);
    });
    const boardW = Math.max(400, maxX - minX + 160);
    const boardH = Math.max(300, maxY - minY + 160);
    const rect = el.getBoundingClientRect();
    const nextZoom = Math.max(0.35, Math.min(1.4, Math.min(rect.width / boardW, rect.height / boardH)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({
      x: Math.round(rect.width / 2 - centerX * nextZoom),
      y: Math.round(rect.height / 2 - centerY * nextZoom),
    });
  }, [activeBoard]);

  // Erase stroke at world coords
  const eraseStrokeAt = useCallback(
    (wx: number, wy: number) => {
      if (!activeBoard || activeBoard.strokes.length === 0) return;
      const radius = 20 / (zoomRef.current || 1);
      const remaining = activeBoard.strokes.filter((s) => {
        return !s.points.some(([px, py]) => Math.hypot(px - wx, py - wy) <= Math.max(radius, s.size));
      });
      if (remaining.length !== activeBoard.strokes.length) {
        updateBoard(() => ({ strokes: remaining }));
      }
    },
    [activeBoard, updateBoard]
  );

  // Canvas pointer handlers
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-mm-ui]')) return;
    const nodeEl = (e.target as HTMLElement).closest('[data-mm-node-id]') as HTMLElement | null;
    const portEl = (e.target as HTMLElement).closest('[data-mm-port-node]') as HTMLElement | null;

    // 1. Port drag to connect ideas
    if (portEl) {
      e.stopPropagation();
      e.preventDefault();
      const fromId = portEl.getAttribute('data-mm-port-node')!;
      const w = clientToWorld(e.clientX, e.clientY);
      setConnectingFromId(fromId);
      setConnectCursorWorld(w);
      interactionRef.current = {
        mode: 'connect-drag',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        nodeId: fromId,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // 2. Freehand Pen / Highlighter / Eraser tools
    if (tool === 'pen' || tool === 'highlighter') {
      e.preventDefault();
      const w = clientToWorld(e.clientX, e.clientY);
      const pts: Point[] = [[w.x, w.y, 0.5]];
      setLiveStrokePoints(pts);
      interactionRef.current = {
        mode: 'draw',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        strokePoints: pts,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (tool === 'eraser') {
      e.preventDefault();
      const w = clientToWorld(e.clientX, e.clientY);
      eraseStrokeAt(w.x, w.y);
      interactionRef.current = {
        mode: 'erase',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // 3. Creation tools on canvas click
    if (!nodeEl && (tool === 'idea' || tool === 'sticky' || tool === 'point')) {
      const w = clientToWorld(e.clientX, e.clientY);
      addNodeAt(tool, w.x, w.y);
      setTool('select');
      return;
    }

    if (!nodeEl && tool === 'paper') {
      setPaperModalTargetNodeId(null);
      setShowPaperModal(true);
      setTool('select');
      return;
    }

    // 4. Clicking on a node
    if (nodeEl) {
      const clickedNodeId = nodeEl.getAttribute('data-mm-node-id')!;
      if (tool === 'connect') {
        if (!connectingFromId) {
          setConnectingFromId(clickedNodeId);
          setSelectedNodeId(clickedNodeId);
        } else if (connectingFromId !== clickedNodeId) {
          createEdgeBetween(connectingFromId, clickedNodeId);
          setConnectingFromId(null);
          setConnectCursorWorld(null);
        }
        return;
      }

      setSelectedNodeId(clickedNodeId);
      setSelectedEdgeId(null);

      // Don't start dragging the card if user clicked inside an input/textarea/button
      const tagName = (e.target as HTMLElement).tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) {
        return;
      }

      const targetNode = activeBoard?.nodes.find((n) => n.id === clickedNodeId);
      if (targetNode) {
        interactionRef.current = {
          mode: 'drag-node',
          pointerId: e.pointerId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startPanX: pan.x,
          startPanY: pan.y,
          nodeId: clickedNodeId,
          startNodeX: targetNode.x,
          startNodeY: targetNode.y,
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }

    // 5. Clicking empty canvas -> Pan
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectingFromId(null);
    setConnectCursorWorld(null);
    interactionRef.current = {
      mode: 'pan',
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = interactionRef.current;
    if (tool === 'connect' && connectingFromId && state.mode === 'none') {
      setConnectCursorWorld(clientToWorld(e.clientX, e.clientY));
      return;
    }
    if (state.mode === 'none' || state.pointerId !== e.pointerId) return;

    if (state.mode === 'pan') {
      const dx = e.clientX - state.startClientX;
      const dy = e.clientY - state.startClientY;
      setPan({ x: state.startPanX + dx, y: state.startPanY + dy });
      return;
    }

    if (state.mode === 'drag-node' && state.nodeId && state.startNodeX !== undefined && state.startNodeY !== undefined) {
      const z = zoomRef.current || 1;
      const dx = (e.clientX - state.startClientX) / z;
      const dy = (e.clientY - state.startClientY) / z;
      handleUpdateNode(state.nodeId, {
        x: Math.round(state.startNodeX + dx),
        y: Math.round(state.startNodeY + dy),
      });
      return;
    }

    if (state.mode === 'connect-drag') {
      setConnectCursorWorld(clientToWorld(e.clientX, e.clientY));
      return;
    }

    if (state.mode === 'draw' && state.strokePoints) {
      const w = clientToWorld(e.clientX, e.clientY);
      const last = state.strokePoints[state.strokePoints.length - 1];
      if (!last || Math.hypot(w.x - last[0], w.y - last[1]) >= 2) {
        state.strokePoints.push([w.x, w.y, 0.5]);
        setLiveStrokePoints([...state.strokePoints]);
      }
      return;
    }

    if (state.mode === 'erase') {
      const w = clientToWorld(e.clientX, e.clientY);
      eraseStrokeAt(w.x, w.y);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = interactionRef.current;
    if (state.pointerId !== e.pointerId) return;

    if (state.mode === 'connect-drag' && state.nodeId) {
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      const targetNodeEl = elUnder?.closest('[data-mm-node-id]') as HTMLElement | null;
      const toId = targetNodeEl?.getAttribute('data-mm-node-id');
      if (toId && toId !== state.nodeId) {
        createEdgeBetween(state.nodeId, toId);
      }
      setConnectingFromId(null);
      setConnectCursorWorld(null);
    } else if (state.mode === 'draw' && state.strokePoints && state.strokePoints.length > 0) {
      const newStroke: Stroke = {
        points: [...state.strokePoints],
        color: inkColor,
        size: tool === 'highlighter' ? inkSize * 3.2 : inkSize,
        tool: tool === 'highlighter' ? 'highlighter' : 'pen',
      };
      updateBoard((b) => ({
        strokes: [...b.strokes, newStroke],
      }));
      setLiveStrokePoints([]);
    }

    interactionRef.current = {
      mode: 'none',
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startPanX: 0,
      startPanY: 0,
    };
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const nextZoom = Math.max(0.25, Math.min(2.5, Number((zoom * factor).toFixed(3))));
      const nextPanX = cursorX - ((cursorX - pan.x) / zoom) * nextZoom;
      const nextPanY = cursorY - ((cursorY - pan.y) / zoom) * nextZoom;
      setZoom(nextZoom);
      setPan({ x: nextPanX, y: nextPanY });
    } else {
      setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handleDoubleClickCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-mm-node-id]') || (e.target as HTMLElement).closest('[data-mm-ui]')) {
      return;
    }
    const w = clientToWorld(e.clientX, e.clientY);
    addNodeAt('idea', w.x, w.y);
  };

  const handleOpenLinkedPaper = (node: MindMapNode) => {
    if (node.linkedFileId) {
      const found = files.find((f) => f.id === node.linkedFileId);
      if (found) {
        setActiveDocument(found.id);
        setActiveView('canvas');
        if (node.linkedPage && node.linkedPage > 0) {
          setTargetPdfPage({ docId: found.id, page: node.linkedPage });
        }
        return;
      }
    }
    if (node.linkedPaperTitle) {
      const byName = files.find(
        (f) =>
          f.name.toLowerCase() === node.linkedPaperTitle!.toLowerCase() ||
          f.name.toLowerCase().includes(node.linkedPaperTitle!.toLowerCase())
      );
      if (byName) {
        setActiveDocument(byName.id);
        setActiveView('canvas');
        if (node.linkedPage && node.linkedPage > 0) {
          setTargetPdfPage({ docId: byName.id, page: node.linkedPage });
        }
        return;
      }
    }
    alert('Paper PDF is not yet downloaded locally. Use "Link Paper" to import it via arXiv ID or DOI.');
  };

  // Radial / Hierarchical Auto-Layout for the active Mind Map board
  const handleAutoLayout = () => {
    if (!activeBoard || activeBoard.nodes.length === 0) return;
    const nodes = [...activeBoard.nodes];
    const centerX = 480;
    const centerY = 320;
    nodes[0] = { ...nodes[0], x: centerX - 130, y: centerY - 70 };
    const rest = nodes.slice(1);
    const ringCapacity = 6;
    rest.forEach((n, idx) => {
      const ring = Math.floor(idx / ringCapacity) + 1;
      const idxInRing = idx % ringCapacity;
      const totalInRing = Math.min(ringCapacity, rest.length - (ring - 1) * ringCapacity);
      const angle = (2 * Math.PI * idxInRing) / Math.max(1, totalInRing) - Math.PI / 2;
      const radiusX = 360 * ring;
      const radiusY = 250 * ring;
      nodes[idx + 1] = {
        ...n,
        x: Math.round(centerX - 130 + Math.cos(angle) * radiusX),
        y: Math.round(centerY - 70 + Math.sin(angle) * radiusY),
      };
    });
    updateBoard(() => ({ nodes }));
  };

  // AI Cluster Generation (sprouts 4 connected synthesis nodes around the selected or root node)
  const handleAiGenerateCluster = () => {
    if (!activeBoard) return;
    const anchor =
      activeBoard.nodes.find((n) => n.id === selectedNodeId) ||
      activeBoard.nodes[0];
    if (!anchor) return;

    const topic = anchor.title || activeBoard.name;
    const specs: { title: string; content: string; color: string; dx: number; dy: number; edgeLabel: string }[] = [
      {
        title: `Problem & Motivation (${topic.slice(0, 22)})`,
        content: 'Core research bottleneck, assumptions in prior literature, and why existing methods fall short.',
        color: 'sky',
        dx: -340,
        dy: -190,
        edgeLabel: 'motivates',
      },
      {
        title: `Methodology & Architecture`,
        content: 'Key mathematical formulation, model pipeline, representation design, and training objective.',
        color: 'amber',
        dx: 340,
        dy: -190,
        edgeLabel: 'proposes',
      },
      {
        title: `Empirical Findings & Metrics`,
        content: 'Primary benchmarks, ablation insights, quantitative speed/accuracy gains over baselines.',
        color: 'sage',
        dx: -340,
        dy: 210,
        edgeLabel: 'evaluates',
      },
      {
        title: `Limitations & Future Directions`,
        content: 'Failure modes, scaling constraints, and follow-up experiments to explore next.',
        color: 'lilac',
        dx: 340,
        dy: 210,
        edgeLabel: 'extends to',
      },
    ];

    const newNodes: MindMapNode[] = [];
    const newEdges: MindMapEdge[] = [];
    specs.forEach((sp, idx) => {
      const id = `mm-ai-${Date.now()}-${idx}`;
      newNodes.push({
        id,
        type: 'idea',
        x: Math.round(anchor.x + sp.dx),
        y: Math.round(anchor.y + sp.dy),
        width: 260,
        title: sp.title,
        content: sp.content,
        color: sp.color,
      });
      newEdges.push({
        id: `edge-ai-${Date.now()}-${idx}`,
        fromNodeId: anchor.id,
        toNodeId: id,
        label: sp.edgeLabel,
        color: NODE_TONES[sp.color]?.accent || '#0a7aff',
        style: 'solid',
      });
    });

    updateBoard((b) => ({
      nodes: [...b.nodes, ...newNodes],
      edges: [...b.edges, ...newEdges],
    }));
  };

  // Export Mind Map board as a structured Markdown literature review (.md)
  const handleExportMarkdown = () => {
    if (!activeBoard) return;
    const lines: string[] = [
      `# ${activeBoard.name}`,
      ``,
      `_Exported from Chlio Mind Map on ${new Date().toLocaleDateString()}_`,
      ``,
      `## Nodes (${activeBoard.nodes.length})`,
      ``,
    ];
    for (const n of activeBoard.nodes) {
      lines.push(`### ${n.title || 'Untitled'} (${n.type.toUpperCase()})`);
      if (n.linkedPaperTitle) {
        lines.push(`- **Linked Paper**: ${n.linkedPaperTitle}${n.linkedPage ? ` (Page ${n.linkedPage})` : ''}`);
      }
      if (n.content) {
        lines.push(`${n.content}`);
      }
      lines.push(``);
    }
    if (activeBoard.edges.length > 0) {
      lines.push(`## Connections (${activeBoard.edges.length})`, ``);
      for (const e of activeBoard.edges) {
        const from = activeBoard.nodes.find((n) => n.id === e.fromNodeId)?.title || e.fromNodeId;
        const to = activeBoard.nodes.find((n) => n.id === e.toNodeId)?.title || e.toNodeId;
        lines.push(`- **${from}** --(${e.label || 'connects to'})--> **${to}**`);
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBoard.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Mind Map board as standalone SVG diagram (.svg)
  const handleExportSvg = () => {
    if (!activeBoard) return;
    const xs = activeBoard.nodes.map((n) => n.x);
    const ys = activeBoard.nodes.map((n) => n.y);
    const minX = Math.min(0, ...xs) - 80;
    const minY = Math.min(0, ...ys) - 80;
    const maxX = Math.max(1200, ...xs.map((x) => x + 320)) + 80;
    const maxY = Math.max(800, ...ys.map((y) => y + 220)) + 80;
    const width = maxX - minX;
    const height = maxY - minY;

    const escapeXml = (s: string) =>
      String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const edgeEls = activeBoard.edges
      .map((e) => {
        const fn = activeBoard.nodes.find((n) => n.id === e.fromNodeId);
        const tn = activeBoard.nodes.find((n) => n.id === e.toNodeId);
        if (!fn || !tn) return '';
        const g = computeEdgeGeometry(fn, tn);
        return `<path d="${g.path}" fill="none" stroke="${e.color || '#64748b'}" stroke-width="2.5" />`;
      })
      .join('\n');

    const nodeEls = activeBoard.nodes
      .map((n) => {
        const tone = NODE_TONES[n.color] || NODE_TONES.sky;
        const w = n.width || 260;
        const h = 140;
        return `<g transform="translate(${n.x}, ${n.y})">
          <rect width="${w}" height="${h}" rx="12" fill="${tone.bg}" stroke="${tone.border}" stroke-width="2" />
          <text x="14" y="28" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0f172a">${escapeXml(n.title.slice(0, 36))}</text>
          <text x="14" y="54" font-family="sans-serif" font-size="12" fill="#334155">${escapeXml(n.content.slice(0, 50))}</text>
        </g>`;
      })
      .join('\n');

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
      <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#f8fafc" />
      ${edgeEls}
      ${nodeEls}
    </svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBoard.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAttachPaperToBoard = (paperItem: { fileId?: string; title: string; authors: string }) => {
    if (paperModalTargetNodeId) {
      handleUpdateNode(paperModalTargetNodeId, {
        linkedFileId: paperItem.fileId,
        linkedPaperTitle: paperItem.title,
        linkedPaperAuthors: paperItem.authors,
      });
    } else {
      const rect = viewportRef.current?.getBoundingClientRect();
      const centerW = clientToWorld(
        (rect?.left || 0) + (rect?.width || 800) / 2,
        (rect?.top || 0) + (rect?.height || 600) / 2
      );
      addNodeAt('paper', centerW.x, centerW.y, {
        title: paperItem.title.replace(/\.pdf$/i, ''),
        content: `Linked Reference · ${paperItem.authors}`,
        color: 'rose',
        linkedFileId: paperItem.fileId,
        linkedPaperTitle: paperItem.title,
        linkedPaperAuthors: paperItem.authors,
      });
    }
    setShowPaperModal(false);
    setPaperModalTargetNodeId(null);
  };

  const handleLookupExternalPaper = async () => {
    if (!externalPaperQuery.trim()) return;
    setIsLookingUpExternal(true);
    setExternalError(null);
    setExternalPreview(null);
    try {
      const info = await lookupPaperByIdentifier(externalPaperQuery.trim());
      setExternalPreview({
        title: info.title,
        authors: info.authors,
        arxivId: info.arxivId,
        doi: info.doi,
      });
    } catch (err: any) {
      setExternalError(err?.message || 'Paper lookup failed.');
    } finally {
      setIsLookingUpExternal(false);
    }
  };

  const handleImportAndLinkExternalPaper = async () => {
    if (!externalPaperQuery.trim()) return;
    setIsImportingExternal(true);
    setExternalError(null);
    try {
      const downloaded = await fetchAndUploadArxivPaper(externalPaperQuery.trim(), nextcloudSyncPath || '/');
      const newFileId = 'file-' + Date.now();
      addFile({
        id: newFileId,
        name: downloaded.filename,
        type: 'pdf',
        folderId: null,
        dataUrl: downloaded.dataUrl,
        remotePath: downloaded.remotePath,
      });
      // Switch back to mindmap view since addFile defaults to 'canvas'
      setActiveView('mindmap');
      const idLabel = downloaded.arxivId
        ? `arXiv:${downloaded.arxivId}`
        : downloaded.doi
        ? `DOI:${downloaded.doi}`
        : downloaded.authors;
      handleAttachPaperToBoard({
        fileId: newFileId,
        title: downloaded.title || downloaded.filename,
        authors: `${downloaded.authors}${idLabel && idLabel !== downloaded.authors ? ` · ${idLabel}` : ''}`,
      });
      setExternalPaperQuery('');
      setExternalPreview(null);
    } catch (err: any) {
      // If PDF is behind a paywall, still allow linking metadata if preview exists
      if (externalPreview) {
        handleAttachPaperToBoard({
          title: externalPreview.title,
          authors: `${externalPreview.authors}${externalPreview.doi ? ` · DOI:${externalPreview.doi}` : ''}`,
        });
        setExternalPaperQuery('');
        setExternalPreview(null);
      } else {
        setExternalError(err?.message || 'Failed to download paper PDF.');
      }
    } finally {
      setIsImportingExternal(false);
    }
  };

  const handleCreateBoard = () => {
    if (!newBoardName.trim()) return;
    const id = 'board-' + Date.now();
    addMindMapBoard({
      id,
      name: newBoardName.trim(),
      projectId: newBoardProjectId || null,
      nodes: [
        {
          id: 'mm-root-' + Date.now(),
          type: 'idea',
          x: 380,
          y: 220,
          width: 260,
          title: newBoardName.trim(),
          content: 'Central topic — click + handles on any side to branch out ideas, or link papers.',
          color: 'sky',
        },
      ],
      edges: [],
      strokes: [],
      updatedAt: new Date().toISOString(),
    });
    setNewBoardName('');
    setNewBoardProjectId('');
    setShowNewBoardModal(false);
  };

  const availablePapers = useMemo(() => {
    const pdfFiles = files
      .filter((f) => f.type === 'pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map((f) => ({
        fileId: f.id,
        title: f.name.replace(/\.pdf$/i, ''),
        authors: 'Workspace PDF',
      }));
    const catalog = papers
      .filter((p) => !pdfFiles.some((f) => f.title.toLowerCase().includes(p.title.toLowerCase())))
      .map((p) => ({
        fileId: undefined,
        title: p.title,
        authors: p.authors,
      }));
    const all = [...pdfFiles, ...catalog];
    const q = paperFilter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((item) => item.title.toLowerCase().includes(q) || item.authors.toLowerCase().includes(q));
  }, [files, papers, paperFilter]);

  const selectedNode = activeBoard?.nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedEdge = activeBoard?.edges.find((e) => e.id === selectedEdgeId) || null;
  const connectingSourceNode = activeBoard?.nodes.find((n) => n.id === connectingFromId) || null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--surface)',
      }}
    >
      {/* Top Board Bar */}
      <div
        data-mm-ui
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface-raised)',
          gap: 12,
          flexWrap: 'wrap',
          zIndex: 30,
        }}
      >
        {/* Left: Board selector & project badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="mindmap" size={18} style={{ color: 'var(--accent)' }} />
            <select
              value={activeBoard?.id || ''}
              onChange={(e) => {
                setActiveMindMapId(e.target.value);
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
              style={{
                fontSize: 14,
                fontWeight: 700,
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              {mindMapBoards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <Button icon="plus" onClick={() => setShowNewBoardModal(true)}>
            New Board
          </Button>

          {activeBoard && mindMapBoards.length > 1 && (
            <IconButton
              icon="trash"
              label="Delete current board"
              onClick={() => {
                if (confirm(`Delete mind map board "${activeBoard.name}"?`)) {
                  deleteMindMapBoard(activeBoard.id);
                }
              }}
            />
          )}

          {/* Project Association Selector */}
          {activeBoard && (
            <select
              value={activeBoard.projectId || ''}
              onChange={(e) => updateBoard(() => ({ projectId: e.target.value || null }))}
              style={{
                fontSize: 12,
                padding: '4px 8px',
                borderRadius: 'var(--radius-xs)',
                border: '1px dashed var(--line-strong)',
                background: 'transparent',
                color: 'var(--ink-2)',
                cursor: 'pointer',
              }}
              title="Link board to project"
            >
              <option value="">No project linked</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  Project: {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: Quick Add & Search & Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Filter nodes on board…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              height: 30,
              padding: '0 10px',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              width: 170,
            }}
          />

          <Button
            icon="plus"
            onClick={() => {
              const rect = viewportRef.current?.getBoundingClientRect();
              const c = clientToWorld((rect?.left || 0) + (rect?.width || 800) / 2, (rect?.top || 0) + (rect?.height || 600) / 2);
              addNodeAt('idea', c.x + (Math.random() - 0.5) * 80, c.y + (Math.random() - 0.5) * 80);
            }}
          >
            Idea
          </Button>
          <Button
            icon="sticky"
            onClick={() => {
              const rect = viewportRef.current?.getBoundingClientRect();
              const c = clientToWorld((rect?.left || 0) + (rect?.width || 800) / 2, (rect?.top || 0) + (rect?.height || 600) / 2);
              addNodeAt('sticky', c.x + (Math.random() - 0.5) * 80, c.y + (Math.random() - 0.5) * 80);
            }}
          >
            Sticky
          </Button>
          <Button
            variant="primary"
            icon="pdf"
            onClick={() => {
              setPaperModalTargetNodeId(null);
              setShowPaperModal(true);
            }}
          >
            Link Paper
          </Button>
          <Button
            variant="ai"
            icon="spark"
            onClick={handleAiGenerateCluster}
          >
            AI Expand
          </Button>
          <Button
            icon="grid"
            onClick={handleAutoLayout}
          >
            Auto-Layout
          </Button>
          <Button
            icon="download"
            onClick={handleExportMarkdown}
          >
            .MD
          </Button>
          <Button
            icon="download"
            onClick={handleExportSvg}
          >
            .SVG
          </Button>
        </div>
      </div>

      {/* Main Infinite Canvas Area */}
      <div
        ref={viewportRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClickCanvas}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor:
            tool === 'hand'
              ? 'grab'
              : tool === 'pen' || tool === 'highlighter' || tool === 'eraser'
              ? 'crosshair'
              : tool === 'connect'
              ? 'pointer'
              : 'default',
          backgroundColor: 'var(--bg-canvas, #f5f5f7)',
          backgroundImage: 'radial-gradient(circle, rgba(120, 120, 128, 0.28) 1.25px, transparent 1.25px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* World Coordinate Plane */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* SVG Layer for Connections & Freehand Scribbles */}
          <svg
            width={1}
            height={1}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <defs>
              <marker
                id="mm-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
              </marker>
            </defs>

            {/* Highlighter scribbles */}
            <g style={{ mixBlendMode: 'multiply' }}>
              {(activeBoard?.strokes || [])
                .filter((s) => s.tool === 'highlighter')
                .map((s, idx) => (
                  <path
                    key={`mm-hl-${idx}`}
                    d={getSvgPathFromPoints(s.points)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.size}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.35}
                  />
                ))}
              {liveStrokePoints.length > 0 && tool === 'highlighter' && (
                <path
                  d={getSvgPathFromPoints(liveStrokePoints)}
                  fill="none"
                  stroke={inkColor}
                  strokeWidth={inkSize * 3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.35}
                />
              )}
            </g>

            {/* Connection Edges */}
            {(activeBoard?.edges || []).map((edge) => {
              const fromNode = activeBoard?.nodes.find((n) => n.id === edge.fromNodeId);
              const toNode = activeBoard?.nodes.find((n) => n.id === edge.toNodeId);
              if (!fromNode || !toNode) return null;
              const geom = computeEdgeGeometry(fromNode, toNode);
              const isSelected = selectedEdgeId === edge.id;
              const strokeColor = edge.color || '#64748b';

              return (
                <g key={edge.id} style={{ pointerEvents: 'auto' }}>
                  {/* Invisible wider hit target */}
                  <path
                    d={geom.path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    style={{ cursor: 'pointer' }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                    }}
                  />
                  <path
                    d={geom.path}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 3.5 : 2.2}
                    strokeDasharray={edge.style === 'dashed' ? '7 5' : undefined}
                    markerEnd="url(#mm-arrow)"
                    style={{
                      cursor: 'pointer',
                      filter: isSelected ? 'drop-shadow(0 0 4px rgba(10,122,255,0.45))' : undefined,
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                    }}
                  />
                  {edge.label && (
                    <g
                      transform={`translate(${geom.midX}, ${geom.midY})`}
                      style={{ cursor: 'pointer' }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                    >
                      <rect
                        x={-Math.max(36, edge.label.length * 3.8)}
                        y={-11}
                        width={Math.max(72, edge.label.length * 7.6)}
                        height={22}
                        rx={11}
                        fill="#ffffff"
                        stroke={strokeColor}
                        strokeWidth={1.2}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={600}
                        fill="#334155"
                        style={{ fontFamily: 'var(--font-sans)' }}
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Live Connection Drag Line */}
            {connectingSourceNode && connectCursorWorld && (
              <line
                x1={getNodeCenter(connectingSourceNode).x}
                y1={getNodeCenter(connectingSourceNode).y}
                x2={connectCursorWorld.x}
                y2={connectCursorWorld.y}
                stroke="#0a7aff"
                strokeWidth={2.5}
                strokeDasharray="6 4"
              />
            )}

            {/* Pen scribbles */}
            <g>
              {(activeBoard?.strokes || [])
                .filter((s) => s.tool !== 'highlighter')
                .map((s, idx) => (
                  <path
                    key={`mm-pen-${idx}`}
                    d={getSvgPathFromPoints(s.points)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.size}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              {liveStrokePoints.length > 0 && tool === 'pen' && (
                <path
                  d={getSvgPathFromPoints(liveStrokePoints)}
                  fill="none"
                  stroke={inkColor}
                  strokeWidth={inkSize}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>
          </svg>

          {/* Nodes Layer */}
          {(activeBoard?.nodes || []).map((node) => {
            const tone = NODE_TONES[node.color] || NODE_TONES.sky;
            const isSelected = selectedNodeId === node.id;
            const isConnectSource = connectingFromId === node.id;
            const q = searchQuery.trim().toLowerCase();
            const isDimmed =
              q.length > 0 &&
              !node.title.toLowerCase().includes(q) &&
              !node.content.toLowerCase().includes(q) &&
              !(node.linkedPaperTitle || '').toLowerCase().includes(q);

            const w = node.width || (node.type === 'sticky' ? 220 : 260);

            return (
              <div
                key={node.id}
                data-mm-node-id={node.id}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: w,
                  backgroundColor: tone.bg,
                  border: `2px solid ${isSelected || isConnectSource ? tone.accent : tone.border}`,
                  borderRadius: node.type === 'sticky' ? '4px 4px 16px 4px' : 14,
                  boxShadow: isSelected
                    ? `0 10px 28px rgba(0,0,0,0.14), 0 0 0 3px ${tone.badgeBg}`
                    : '0 4px 14px rgba(0,0,0,0.07)',
                  color: tone.text,
                  zIndex: isSelected ? 10 : 4,
                  opacity: isDimmed ? 0.3 : 1,
                  transition: 'box-shadow 0.15s ease, opacity 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Node Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 12px',
                    backgroundColor: tone.headerBg,
                    borderTopLeftRadius: node.type === 'sticky' ? 2 : 12,
                    borderTopRightRadius: node.type === 'sticky' ? 2 : 12,
                    cursor: 'grab',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: tone.accent,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Icon
                      name={
                        node.type === 'paper'
                          ? 'pdf'
                          : node.type === 'sticky'
                          ? 'sticky'
                          : node.type === 'point'
                          ? 'list'
                          : 'bulb'
                      }
                      size={12}
                    />
                    {node.type === 'paper'
                      ? 'Paper Reference'
                      : node.type === 'sticky'
                      ? 'Sticky Note'
                      : node.type === 'point'
                      ? 'Scribble Point'
                      : 'Idea Node'}
                  </span>

                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleDeleteNode(node.id);
                    }}
                    title="Delete node"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontSize: 13,
                      lineHeight: 1,
                      padding: '2px 4px',
                      borderRadius: 4,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Node Body */}
                <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="text"
                    value={node.title}
                    onChange={(ev) => handleUpdateNode(node.id, { title: ev.target.value })}
                    placeholder="Title…"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 700,
                      fontSize: 14,
                      color: '#0f172a',
                      outline: 'none',
                      width: '100%',
                      fontFamily: 'var(--font-sans)',
                    }}
                  />

                  <textarea
                    value={node.content}
                    onChange={(ev) => handleUpdateNode(node.id, { content: ev.target.value })}
                    placeholder="Write notes, bullet points, or hypotheses…"
                    rows={node.type === 'sticky' ? 4 : 3}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      color: '#334155',
                      outline: 'none',
                      resize: 'vertical',
                      width: '100%',
                      fontFamily: 'var(--font-sans)',
                    }}
                  />

                  {/* Visual PDF Excerpt / Snippet Image (from Lasso-to-Mind-Map) */}
                  {node.snippetDataUrl && (
                    <div
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleOpenLinkedPaper(node);
                      }}
                      title="Click to jump to this excerpt page in the PDF"
                      style={{
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: `1px solid ${tone.border}`,
                        background: '#ffffff',
                        cursor: 'pointer',
                        maxHeight: 150,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={node.snippetDataUrl}
                        alt={node.title}
                        style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
                      />
                    </div>
                  )}

                  {/* Linked Paper Chip */}
                  {(node.linkedPaperTitle || node.type === 'paper') && (
                    <div
                      style={{
                        marginTop: 4,
                        padding: '6px 8px',
                        borderRadius: 8,
                        backgroundColor: 'rgba(255,255,255,0.78)',
                        border: `1px solid ${tone.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={node.linkedPaperTitle || node.title}
                          >
                            📄 {node.linkedPaperTitle || node.title}
                          </div>
                          {node.linkedPaperAuthors && (
                            <div
                              style={{
                                fontSize: 10,
                                color: '#64748b',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {node.linkedPaperAuthors}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleOpenLinkedPaper(node);
                          }}
                          style={{
                            border: 'none',
                            background: tone.accent,
                            color: '#ffffff',
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '4px 8px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          Open PDF{node.linkedPage ? ` (p.${node.linkedPage})` : ''}
                        </button>
                      </div>

                      {/* Deep-Link Page Number + BibTeX & Citation Graph actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 4,
                          borderTop: '1px dashed rgba(0,0,0,0.08)',
                          paddingTop: 5,
                        }}
                      >
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#475569',
                          }}
                        >
                          <span>Page:</span>
                          <input
                            type="number"
                            min={1}
                            placeholder="1"
                            value={node.linkedPage || ''}
                            onChange={(ev) => {
                              const val = parseInt(ev.target.value, 10);
                              handleUpdateNode(node.id, { linkedPage: isNaN(val) ? undefined : val });
                            }}
                            style={{
                              width: 38,
                              padding: '1px 4px',
                              fontSize: 10,
                              borderRadius: 4,
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#0f172a',
                            }}
                          />
                        </label>

                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button
                            onClick={async (ev) => {
                              ev.stopPropagation();
                              try {
                                const pTitle = node.linkedPaperTitle || node.title;
                                const pArxiv = (pTitle + ' ' + node.content).match(/\d{4}\.\d{4,5}/)?.[0];
                                const pDoi = (pTitle + ' ' + node.content).match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0];
                                const res = await fetchPaperBibtex({
                                  title: pTitle,
                                  authors: node.linkedPaperAuthors || 'Unknown',
                                  arxivId: pArxiv,
                                  doi: pDoi,
                                });
                                await navigator.clipboard?.writeText(res.bibtex);
                                alert(`Copied BibTeX to clipboard:\n\n${res.bibtex}`);
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            style={{
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#334155',
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                            title="Copy BibTeX citation"
                          >
                            BibTeX
                          </button>

                          <button
                            onClick={async (ev) => {
                              ev.stopPropagation();
                              try {
                                const pTitle = node.linkedPaperTitle || node.title;
                                const pArxiv = (pTitle + ' ' + node.content).match(/\d{4}\.\d{4,5}/)?.[0];
                                const pDoi = (pTitle + ' ' + node.content).match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0];
                                const res = await fetchPaperCitations({
                                  title: pTitle,
                                  arxivId: pArxiv,
                                  doi: pDoi,
                                });
                                const items = [
                                  ...(res.references || []).slice(0, 3).map((r) => ({ ...r, rel: 'cites' })),
                                  ...(res.citations || []).slice(0, 2).map((c) => ({ ...c, rel: 'cited by' })),
                                ];
                                if (items.length === 0) {
                                  alert('No open citation graph connections found for this paper.');
                                  return;
                                }
                                const spawnedNodes: MindMapNode[] = [];
                                const spawnedEdges: MindMapEdge[] = [];
                                items.forEach((it, idx) => {
                                  const angle = (2 * Math.PI * idx) / items.length;
                                  const nid = `mm-cit-${Date.now()}-${idx}`;
                                  spawnedNodes.push({
                                    id: nid,
                                    type: 'paper',
                                    x: Math.round(node.x + Math.cos(angle) * 340),
                                    y: Math.round(node.y + Math.sin(angle) * 230),
                                    width: 250,
                                    title: it.title,
                                    content: `${it.authors}${it.year ? ` (${it.year})` : ''}${it.arxivId ? ` · arXiv:${it.arxivId}` : ''}`,
                                    color: it.rel === 'cites' ? 'sky' : 'sage',
                                    linkedPaperTitle: it.title,
                                    linkedPaperAuthors: it.authors,
                                  });
                                  spawnedEdges.push({
                                    id: `edge-cit-${Date.now()}-${idx}`,
                                    fromNodeId: it.rel === 'cites' ? node.id : nid,
                                    toNodeId: it.rel === 'cites' ? nid : node.id,
                                    label: it.rel,
                                    color: it.rel === 'cites' ? '#0a7aff' : '#059669',
                                    style: 'dashed',
                                  });
                                });
                                updateBoard((b) => ({
                                  nodes: [...b.nodes, ...spawnedNodes],
                                  edges: [...b.edges, ...spawnedEdges],
                                }));
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            style={{
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#0a7aff',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                            title="Fetch Cited & Citing papers and add them as connected nodes"
                          >
                            + Citations
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4 Connection / Sprout Handles (Top, Right, Bottom, Left) */}
                {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
                  const posStyle: React.CSSProperties =
                    side === 'top'
                      ? { top: -10, left: '50%', transform: 'translateX(-50%)' }
                      : side === 'bottom'
                      ? { bottom: -10, left: '50%', transform: 'translateX(-50%)' }
                      : side === 'left'
                      ? { left: -10, top: '50%', transform: 'translateY(-50%)' }
                      : { right: -10, top: '50%', transform: 'translateY(-50%)' };

                  return (
                    <div
                      key={side}
                      data-mm-port-node={node.id}
                      onDoubleClick={(ev) => {
                        ev.stopPropagation();
                        handleSproutChild(node, side);
                      }}
                      title="Drag to connect to another node, or double-click to sprout a connected idea"
                      style={{
                        position: 'absolute',
                        ...posStyle,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        border: `2px solid ${tone.accent}`,
                        color: tone.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'crosshair',
                        opacity: isSelected || tool === 'connect' ? 1 : 0.65,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                      }}
                    >
                      +
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Selected Node Floating Inspector */}
        {selectedNode && (
          <div
            data-mm-ui
            style={{
              position: 'absolute',
              top: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-float)',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              zIndex: 25,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>Color:</span>
            {Object.keys(NODE_TONES).map((toneKey) => (
              <button
                key={toneKey}
                onClick={() => handleUpdateNode(selectedNode.id, { color: toneKey })}
                title={toneKey}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: NODE_TONES[toneKey].accent,
                  border: selectedNode.color === toneKey ? '2.5px solid var(--ink)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}

            <div style={{ width: 1, height: 18, background: 'var(--line)' }} />

            <Button
              icon="plus"
              onClick={() => handleSproutChild(selectedNode, 'right')}
            >
              Branch Idea
            </Button>

            <Button
              icon="link"
              onClick={() => {
                setConnectingFromId(selectedNode.id);
                setTool('connect');
              }}
            >
              Connect To…
            </Button>

            <Button
              icon="pdf"
              onClick={() => {
                setPaperModalTargetNodeId(selectedNode.id);
                setShowPaperModal(true);
              }}
            >
              {selectedNode.linkedPaperTitle ? 'Change Linked Paper' : 'Attach Paper'}
            </Button>
          </div>
        )}

        {/* Selected Connection Edge Inspector */}
        {selectedEdge && (
          <div
            data-mm-ui
            style={{
              position: 'absolute',
              top: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-float)',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              zIndex: 25,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>Connection Label:</span>
            <input
              type="text"
              value={selectedEdge.label || ''}
              onChange={(e) => handleUpdateEdge(selectedEdge.id, { label: e.target.value })}
              placeholder="e.g. supports, extends, cites…"
              style={{
                height: 28,
                padding: '0 8px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--line)',
              }}
            />
            <Button
              onClick={() =>
                handleUpdateEdge(selectedEdge.id, {
                  style: selectedEdge.style === 'dashed' ? 'solid' : 'dashed',
                })
              }
            >
              {selectedEdge.style === 'dashed' ? 'Solid Line' : 'Dashed Line'}
            </Button>
            <Button icon="trash" onClick={() => handleDeleteEdge(selectedEdge.id)}>
              Remove Link
            </Button>
          </div>
        )}

        {/* Freehand Ink Palette Bar (shown when Pen or Highlighter is active) */}
        {(tool === 'pen' || tool === 'highlighter') && (
          <div
            data-mm-ui
            style={{
              position: 'absolute',
              bottom: 84,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-float)',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              zIndex: 25,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>Ink:</span>
            {INK_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setInkColor(c)}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: inkColor === c ? '2.5px solid var(--ink)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
            <div style={{ width: 1, height: 18, background: 'var(--line)' }} />
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Size:</span>
            {[2, 4, 7].map((sz) => (
              <button
                key={sz}
                onClick={() => setInkSize(sz)}
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: inkSize === sz ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: inkSize === sz ? 'var(--accent-soft)' : 'transparent',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                }}
              >
                {sz}px
              </button>
            ))}
          </div>
        )}

        {/* Bottom Miro-style Floating Tool Dock */}
        <div
          data-mm-ui
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--surface-raised)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-float)',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            zIndex: 25,
          }}
        >
          {(
            [
              { id: 'select', icon: 'cursor', label: 'Select / Move' },
              { id: 'hand', icon: 'hand', label: 'Pan Board' },
              { id: 'idea', icon: 'bulb', label: 'Add Idea Node' },
              { id: 'sticky', icon: 'sticky', label: 'Add Sticky Note' },
              { id: 'point', icon: 'list', label: 'Add Scribble Point' },
              { id: 'connect', icon: 'link', label: 'Connect Ideas' },
              { id: 'paper', icon: 'pdf', label: 'Link Paper' },
              { id: 'pen', icon: 'pencil', label: 'Freehand Scribble Pen' },
              { id: 'highlighter', icon: 'edit3', label: 'Board Highlighter' },
              { id: 'eraser', icon: 'eraser', label: 'Erase Scribbles' },
            ] as const
          ).map((item) => {
            const active = tool === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'paper') {
                    setPaperModalTargetNodeId(selectedNodeId);
                    setShowPaperModal(true);
                  } else {
                    setTool(item.id);
                    if (item.id !== 'connect') {
                      setConnectingFromId(null);
                      setConnectCursorWorld(null);
                    }
                  }
                }}
                title={item.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 11px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--ink)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                <Icon name={item.icon} size={16} />
                <span>{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom-Right Zoom & Fit Controls */}
        <div
          data-mm-ui
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            backgroundColor: 'var(--surface-raised)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 25,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <button
            onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.15).toFixed(2))))}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 6px', color: 'var(--ink)' }}
            title="Zoom Out"
          >
            −
          </button>
          <span style={{ minWidth: 44, textAlign: 'center', color: 'var(--ink)' }}>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 6px', color: 'var(--ink)' }}
            title="Zoom In"
          >
            +
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--line)' }} />
          <button
            onClick={handleFitView}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '4px 6px',
              color: 'var(--accent)',
              fontWeight: 700,
              fontSize: 11.5,
            }}
            title="Fit all nodes in view"
          >
            Fit View
          </button>
        </div>
      </div>

      {/* New Mind Map Board Modal */}
      {showNewBoardModal && (
        <Modal
          title="Create New Mind Map Board"
          description="Create an infinite canvas board for brainstorming, connecting ideas, and linking research papers."
          onClose={() => setShowNewBoardModal(false)}
          footer={
            <>
              <Button onClick={() => setShowNewBoardModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateBoard} disabled={!newBoardName.trim()}>
                Create Board
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <TextField
              label="Board Name"
              placeholder="e.g. Transformer Architecture Literature Map"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}>
                Associate with Project (optional)
              </div>
              <select
                value={newBoardProjectId}
                onChange={(e) => setNewBoardProjectId(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                }}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}

      {/* Link Paper Modal (Local Workspace Papers + Direct arXiv / DOI Lookup) */}
      {showPaperModal && (
        <Modal
          title={paperModalTargetNodeId ? 'Attach Paper to Node' : 'Add Linked Paper to Board'}
          description="Select a paper from your workspace or look up any paper via arXiv ID or DOI."
          onClose={() => {
            setShowPaperModal(false);
            setPaperModalTargetNodeId(null);
          }}
          footer={
            <Button
              onClick={() => {
                setShowPaperModal(false);
                setPaperModalTargetNodeId(null);
              }}
            >
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Section 1: Existing Workspace Papers */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>
                Workspace Papers ({availablePapers.length})
              </div>
              <input
                type="text"
                placeholder="Filter workspace papers by title or author…"
                value={paperFilter}
                onChange={(e) => setPaperFilter(e.target.value)}
                style={{
                  width: '100%',
                  height: 34,
                  padding: '0 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--line)',
                  marginBottom: 8,
                  fontSize: 13,
                }}
              />
              <div
                style={{
                  maxHeight: 170,
                  overflowY: 'auto',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm)',
                  divideY: '1px solid var(--line)',
                } as React.CSSProperties}
              >
                {availablePapers.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleAttachPaperToBoard(p)}
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--line)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{p.authors}</div>
                    </div>
                    <Tag tone="sky">Link</Tag>
                  </div>
                ))}
                {availablePapers.length === 0 && (
                  <div style={{ padding: 12, fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center' }}>
                    No matching local papers. Search via arXiv ID or DOI below.
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Search & Import by arXiv ID or DOI */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>
                Search & Link by arXiv ID or DOI
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="e.g. 2512.02667 or 10.1038/nature14539"
                  value={externalPaperQuery}
                  onChange={(e) => {
                    setExternalPaperQuery(e.target.value);
                    if (externalPreview) setExternalPreview(null);
                  }}
                  style={{
                    flex: 1,
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--line)',
                    fontSize: 13,
                  }}
                />
                <Button onClick={handleLookupExternalPaper} disabled={isLookingUpExternal || !externalPaperQuery.trim()}>
                  {isLookingUpExternal ? 'Searching…' : 'Search'}
                </Button>
                <Button
                  variant="primary"
                  icon="arxiv"
                  onClick={handleImportAndLinkExternalPaper}
                  disabled={isImportingExternal || !externalPaperQuery.trim()}
                >
                  {isImportingExternal ? 'Importing…' : 'Import & Link'}
                </Button>
              </div>
              {externalError && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{externalError}</div>
              )}
              {externalPreview && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-inset)',
                    border: '1px solid var(--line)',
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{externalPreview.title}</div>
                  <div style={{ color: 'var(--ink-2)', marginTop: 2 }}>{externalPreview.authors}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11 }} className="cl-mono cl-faint">
                    {externalPreview.arxivId && <span>arXiv:{externalPreview.arxivId}</span>}
                    {externalPreview.doi && <span>DOI:{externalPreview.doi}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MindMapView;

