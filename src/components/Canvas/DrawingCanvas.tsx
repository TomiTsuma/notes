import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Stroke, Point, TextElement } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';

// Minimum pointer travel (px) between captured samples. A pressure-sensitive stylus
// emits up to 240 samples/sec; keeping all of them bloats the persisted payload
// without adding visible detail.
const MIN_SAMPLE_DIST = 1.5;
const MIN_SAMPLE_DIST_HIGHLIGHTER = 2.5;

// Pointer may drift this far during the press-and-hold that arms straight-line mode.
const HOLD_SLOP = 8;

// Tools that lay down ink, and every tool the canvas handles itself (so the browser's
// own drag/scroll gestures get suppressed for them).
const INK_TOOLS = new Set(['pen', 'pencil', 'highlighter', 'ruler']);
const CANVAS_TOOLS = ['pen', 'pencil', 'highlighter', 'eraser', 'ruler', 'select', 'text', 'sticky'];

const EMPTY_STROKES: Stroke[] = [];
const EMPTY_TEXT_ELEMENTS: TextElement[] = [];

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

type Box = { x: number, y: number, w: number, h: number };

function snapLine(x0: number, y0: number, x1: number, y1: number, isShift: boolean): [number, number] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) return [x1, y1];

  if (isShift) {
    // Snap to nearest 45 degrees: 0, 45, 90, 135, 180, etc.
    const angle = Math.atan2(dy, dx);
    const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    return [
      Math.round(x0 + dist * Math.cos(snapAngle)),
      Math.round(y0 + dist * Math.sin(snapAngle)),
    ];
  }

  // Text-friendly smart snapping (aligns perfectly with notebook/document text lines):
  // If line is predominantly horizontal (within ~15° of horizontal): tan(15°) ≈ 0.27
  if (Math.abs(dy) <= Math.abs(dx) * 0.27) {
    return [x1, y0];
  }

  // If line is predominantly vertical (within ~15° of vertical)
  if (Math.abs(dx) <= Math.abs(dy) * 0.27) {
    return [x0, y1];
  }

  return [x1, y1];
}

function interpolateStrokePoints(stroke: Stroke): Point[] {
  if (stroke.points.length === 2 && (stroke.tool === 'highlighter' || stroke.tool === 'ruler')) {
    const [start, end] = stroke.points;
    const renderPoints: Point[] = [];
    const steps = 30;
    for (let j = 0; j <= steps; j++) {
      renderPoints.push([
        start[0] + (end[0] - start[0]) * (j / steps),
        start[1] + (end[1] - start[1]) * (j / steps),
        start[2],
      ]);
    }
    return renderPoints;
  }
  return stroke.points;
}

// Stroke objects are immutable once committed, so their path data can be cached by
// identity. Without this, every store change re-serialises every stroke on every page.
const pathCache = new WeakMap<object, string>();

function cachedStrokePath(stroke: Stroke): string {
  let d = pathCache.get(stroke);
  if (d === undefined) {
    d = getSvgPathFromPoints(interpolateStrokePoints(stroke));
    pathCache.set(stroke, d);
  }
  return d;
}

function buildStrokeElement(
  stroke: Stroke,
  key: string,
  isSelectedRender: boolean,
  offset: { x: number, y: number } | null,
): React.ReactElement | null {
  if (stroke.points.length === 0) return null;

  const transformStyle = offset ? `translate(${offset.x}px, ${offset.y}px)` : 'none';
  const filterVal = isSelectedRender ? 'drop-shadow(0px 0px 3px #007aff)' : 'none';
  const opacityVal = stroke.tool === 'highlighter' ? 0.35 : 1;

  // Single point (dot / tap) - render as a crisp circle so dots on 'i' and small pencil marks never disappear
  if (stroke.points.length === 1) {
    const [px, py] = stroke.points[0];
    return (
      <circle
        key={key}
        cx={px}
        cy={py}
        r={Math.max(stroke.size / 2, 1.5)}
        fill={stroke.color}
        opacity={opacityVal}
        style={{ transform: transformStyle, transition: 'none' }}
        filter={filterVal}
      />
    );
  }

  return (
    <path
      key={key}
      d={cachedStrokePath(stroke)}
      fill="none"
      stroke={stroke.color}
      strokeWidth={stroke.size}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacityVal}
      style={{ transform: transformStyle, transition: 'none' }}
      filter={filterVal}
    />
  );
}

// Handing React the identical element object lets it bail out of reconciling that
// child, so appending a stroke costs one node instead of the whole page's worth.
const elementCache = new WeakMap<object, { key: string, el: React.ReactElement | null }>();

function cachedStrokeElement(stroke: Stroke, key: string): React.ReactElement | null {
  const hit = elementCache.get(stroke);
  if (hit && hit.key === key) return hit.el;
  const el = buildStrokeElement(stroke, key, false, null);
  elementCache.set(stroke, { key, el });
  return el;
}

function distancePointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function strokeHitTest(stroke: Stroke, x: number, y: number, brushSize: number): boolean {
  const points = interpolateStrokePoints(stroke);
  const radius = Math.max(24, stroke.size * 1.5, brushSize * 2);
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if (distancePointToSegment(x, y, x1, y1, x2, y2) <= radius) return true;
  }
  if (points.length === 1) {
    const [px, py] = points[0];
    return Math.hypot(px - x, py - y) <= radius;
  }
  return false;
}

const DrawingCanvas: React.FC<{ documentId?: string; width?: number; height?: number }> = ({ documentId, width: propWidth, height: propHeight }) => {
  const activeTool = useAppStore(s => s.activeTool);
  const brushColor = useAppStore(s => s.brushColor);
  const brushSize = useAppStore(s => s.brushSize);
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  const palmRejection = useAppStore(s => s.palmRejection);
  const markerStraightMode = useAppStore(s => s.markerStraightMode);
  const setStrokes = useAppStore(s => s.setStrokes);
  const translateStrokes = useAppStore(s => s.translateStrokes);
  const addTextElement = useAppStore(s => s.addTextElement);
  const setFocusedTextId = useAppStore(s => s.setFocusedTextId);
  const deleteTextElement = useAppStore(s => s.deleteTextElement);

  const effectiveDocId = documentId || activeDocumentId;

  // Subscribe to this page's slice only, so editing one notebook page does not
  // re-render and re-serialise every other page's strokes.
  const strokes = useAppStore(s => (effectiveDocId ? s.annotations[effectiveDocId]?.strokes : undefined)) ?? EMPTY_STROKES;
  const textElements = useAppStore(s => (effectiveDocId ? s.annotations[effectiveDocId]?.textElements : undefined)) ?? EMPTY_TEXT_ELEMENTS;

  const currentStrokeRef = useRef<Point[]>([]);
  const strokeStartRef = useRef<{ x: number, y: number } | null>(null);
  const lastPointerPosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const isShiftRef = useRef(false);
  const isDrawingRef = useRef(false);
  const isErasingRef = useRef(false);
  const snapModeRef = useRef(false);
  const holdAnchorRef = useRef<{ x: number, y: number } | null>(null);
  const [canvasDims, setCanvasDims] = useState({ w: propWidth || 800, h: propHeight || 1200 });
  
  // Lasso state
  const [lassoBox, setLassoBox] = useState<Box | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isDraggingLasso, setIsDraggingLasso] = useState(false);
  const [lassoOffset, setLassoOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{x: number, y: number} | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const livePenPathRef = useRef<SVGPathElement>(null);
  const liveHlPathRef = useRef<SVGPathElement>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const drawingPointerIdRef = useRef<number | null>(null);
  
  // Refs to always have latest values in native event listeners
  const activeToolRef = useRef(activeTool);
  const brushColorRef = useRef(brushColor);
  const brushSizeRef = useRef(brushSize);
  const effectiveDocIdRef = useRef(effectiveDocId);
  const palmRejectionRef = useRef(palmRejection);
  const markerStraightModeRef = useRef(markerStraightMode);
  activeToolRef.current = activeTool;
  brushColorRef.current = brushColor;
  brushSizeRef.current = brushSize;
  effectiveDocIdRef.current = effectiveDocId;
  palmRejectionRef.current = palmRejection;
  markerStraightModeRef.current = markerStraightMode;

  const triggerSnap = useCallback(() => {
    if (!isDrawingRef.current) return;
    const pts = currentStrokeRef.current;
    if (pts.length < 1) return;
    const start = strokeStartRef.current || { x: pts[0][0], y: pts[0][1] };
    const cur = lastPointerPosRef.current;
    const dist = Math.hypot(cur.x - start.x, cur.y - start.y);
    if (dist < 8) return;

    snapModeRef.current = true;
    const [sx, sy] = snapLine(start.x, start.y, cur.x, cur.y, isShiftRef.current);
    pts.length = 1;
    pts.push([sx, sy, 0.5]);

    const tool = activeToolRef.current;
    const liveEl = tool === 'highlighter' ? liveHlPathRef.current : livePenPathRef.current;
    if (liveEl) {
      const size = tool === 'highlighter' ? brushSizeRef.current * 3 : brushSizeRef.current;
      liveEl.setAttribute('d', getSvgPathFromPoints(pts));
      liveEl.setAttribute('stroke', brushColorRef.current);
      liveEl.setAttribute('stroke-width', String(size));
    }
    holdTimeoutRef.current = null;
  }, []);

  const triggerSnapRef = useRef(triggerSnap);
  triggerSnapRef.current = triggerSnap;

  // Cached rect ref - updated on resize AND scroll
  const rectRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const rafPendingRef = useRef(false);
  const pendingEventsRef = useRef<PointerEvent[]>([]);

  // Native pointer event handling for reliable, real-time stroke capture
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Update cached rect on resize AND scroll
    const updateRect = () => {
      const r = el.getBoundingClientRect();
      rectRef.current.left = r.left;
      rectRef.current.top = r.top;
      rectRef.current.width = r.width;
      rectRef.current.height = r.height;
    };
    updateRect();
    const ro = new ResizeObserver(updateRect);
    ro.observe(el);
    // Listen for scroll on all ancestor elements
    const scrollHandler = () => updateRect();
    const scrollTargets: EventTarget[] = [];
    let scrollTarget: HTMLElement | null = el;
    while (scrollTarget) {
      scrollTarget.addEventListener('scroll', scrollHandler, { passive: true });
      scrollTargets.push(scrollTarget);
      scrollTarget = scrollTarget.parentElement;
    }
    window.addEventListener('scroll', scrollHandler, { passive: true });
    scrollTargets.push(window);

    // Process coalesced events and draw incrementally
    const processDrawingEvents = () => {
      rafPendingRef.current = false;
      const events = pendingEventsRef.current;
      pendingEventsRef.current = [];
      if (events.length === 0) return;

      const tool = activeToolRef.current;
      if (!INK_TOOLS.has(tool)) return;

      const rl = rectRef.current.left;
      const rt = rectRef.current.top;
      const pts = currentStrokeRef.current;
      const prevLen = pts.length;
      const lastEvt = events[events.length - 1];
      const curX = lastEvt.clientX - rl;
      const curY = lastEvt.clientY - rt;
      lastPointerPosRef.current = { x: curX, y: curY };
      const isShift = lastEvt.shiftKey || isShiftRef.current;

      if (isShift && !snapModeRef.current) {
        snapModeRef.current = true;
      }

      // Draw-and-hold straight line snap (like Apple Notes / GoodNotes / Procreate):
      // When holding still at the end of a stroke for 320ms, snap to a straight line!
      if (!snapModeRef.current && (tool === 'highlighter' || tool === 'pen')) {
        const anchor = holdAnchorRef.current;
        const distFromAnchor = anchor ? Math.hypot(curX - anchor.x, curY - anchor.y) : Infinity;
        if (distFromAnchor > HOLD_SLOP) {
          holdAnchorRef.current = { x: curX, y: curY };
          if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
          }
          holdTimeoutRef.current = setTimeout(() => triggerSnapRef.current(), 320);
        }
      }

      if (snapModeRef.current && pts.length > 0) {
        const start = strokeStartRef.current || { x: pts[0][0], y: pts[0][1] };
        const [sx, sy] = snapLine(start.x, start.y, curX, curY, isShift);
        pts.length = 1;
        pts.push([sx, sy, 0.5]);
      } else {
        const minDistSq = (tool === 'highlighter' ? MIN_SAMPLE_DIST_HIGHLIGHTER : MIN_SAMPLE_DIST) ** 2;
        for (const evt of events) {
          const x = evt.clientX - rl;
          const y = evt.clientY - rt;
          const last = pts[pts.length - 1];
          if (last) {
            const dx = x - last[0];
            const dy = y - last[1];
            if (dx * dx + dy * dy < minDistSq) continue;
          }
          pts.push([x, y, 0.5]);
        }
      }

      if (pts.length < 2 || pts.length === prevLen) return;

      const liveEl = tool === 'highlighter' ? liveHlPathRef.current : livePenPathRef.current;
      if (!liveEl) return;
      const size = tool === 'highlighter' ? brushSizeRef.current * 3 : brushSizeRef.current;
      liveEl.setAttribute('d', getSvgPathFromPoints(pts));
      liveEl.setAttribute('stroke', brushColorRef.current);
      liveEl.setAttribute('stroke-width', String(size));
    };

    const onPointerMove = (e: PointerEvent) => {
      if (palmRejectionRef.current && e.pointerType === 'touch') return;
      const tool = activeToolRef.current;
      if (!effectiveDocIdRef.current) return;

      const rl = rectRef.current.left;
      const rt = rectRef.current.top;

      // Erase only while a drag that began on this canvas is in progress, and only
      // commit when a stroke was actually hit — otherwise every move re-renders.
      if (tool === 'eraser') {
        if (!isErasingRef.current || e.pointerId !== drawingPointerIdRef.current) return;
        const x = e.clientX - rl;
        const y = e.clientY - rt;
        const docId = effectiveDocIdRef.current;
        const bs = brushSizeRef.current;
        setStrokes(docId, prev => {
          const next = prev.filter(stroke => !strokeHitTest(stroke, x, y, bs));
          return next.length === prev.length ? prev : next;
        });
        return;
      }

      if (!isDrawingRef.current) return;
      if (e.pointerId !== drawingPointerIdRef.current) return;
      if (!INK_TOOLS.has(tool)) return;

      // Collect all coalesced events for this frame
      const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ce of coalesced) {
        pendingEventsRef.current.push(ce);
      }

      // Batch drawing via requestAnimationFrame for smooth rendering
      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(processDrawingEvents);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (palmRejectionRef.current && e.pointerType === 'touch') return;
      if (e.pointerId !== drawingPointerIdRef.current) return;
      if (isErasingRef.current) {
        isErasingRef.current = false;
        drawingPointerIdRef.current = null;
        return;
      }
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      drawingPointerIdRef.current = null;

      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
      holdAnchorRef.current = null;

      // Process any remaining pending events before finalizing
      if (pendingEventsRef.current.length > 0) {
        processDrawingEvents();
      }

      const docId = effectiveDocIdRef.current;
      if (!docId) { currentStrokeRef.current = []; clearCanvasNow(); return; }

      const tool = activeToolRef.current;
      if (tool === 'eraser' || tool === 'select' || tool === 'text' || tool === 'sticky') {
        currentStrokeRef.current = [];
        clearCanvasNow();
        return;
      }

      const finalPts = currentStrokeRef.current;
      if (finalPts.length > 0) {
        const strokeTool: Stroke['tool'] = tool === 'highlighter' ? 'highlighter' : tool === 'ruler' ? 'ruler' : 'pen';
        const color = brushColorRef.current;
        const size = tool === 'highlighter' ? brushSizeRef.current * 3 : brushSizeRef.current;
        setStrokes(docId, prev => [...prev, { points: [...finalPts], color, size, tool: strokeTool }]);
      }
      currentStrokeRef.current = [];
      snapModeRef.current = false;

      // Clear canvas immediately - SVG will render on next React commit
      clearCanvasNow();
    };

    const clearCanvasNow = () => {
      rafPendingRef.current = false;
      pendingEventsRef.current = [];
      livePenPathRef.current?.setAttribute('d', '');
      liveHlPathRef.current?.setAttribute('d', '');
    };

    // Keyboard Shift listeners to snap straight lines interactively
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftRef.current = true;
        if (isDrawingRef.current && (activeToolRef.current === 'highlighter' || activeToolRef.current === 'pen')) {
          triggerSnapRef.current();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftRef.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Native pointerdown / touchstart listeners with passive: false to prevent browser drag/scroll gestures
    const onNativePointerDown = (e: PointerEvent) => {
      updateRect();
      if ((e.target as Element).closest?.('.text-element')) return;
      const tool = activeToolRef.current;
      if (CANVAS_TOOLS.includes(tool)) {
        if (e.cancelable) e.preventDefault();
      }
    };

    const onNativeTouchStart = (e: TouchEvent) => {
      updateRect();
      if ((e.target as Element).closest?.('.text-element')) return;
      const tool = activeToolRef.current;
      if (CANVAS_TOOLS.includes(tool)) {
        if (e.cancelable) e.preventDefault();
      }
    };

    el.addEventListener('pointerdown', onNativePointerDown, { passive: false });
    el.addEventListener('touchstart', onNativeTouchStart, { passive: false });

    // Use window-level listeners for move/up to avoid pointer capture issues
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      el.removeEventListener('pointerdown', onNativePointerDown);
      el.removeEventListener('touchstart', onNativeTouchStart);
      for (const t of scrollTargets) {
        t.removeEventListener('scroll', scrollHandler);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [setStrokes]);

  // Track container dimensions for accurate SVG coordinate system
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateCanvasDimensions = () => {
      const rect = el.getBoundingClientRect();
      const parentH = el.parentElement?.scrollHeight || el.offsetHeight;
      const w = propWidth || (rect.width > 0 ? rect.width : 800);
      const h = propHeight || (rect.height > 0 ? Math.max(rect.height, parentH) : 800);
      setCanvasDims({ w, h });
    };
    updateCanvasDimensions();
    const ro = new ResizeObserver(updateCanvasDimensions);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener('resize', updateCanvasDimensions);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, [activeDocumentId, propWidth, propHeight]);

  const getCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const eraseAt = useCallback((x: number, y: number) => {
    if (!effectiveDocId) return;
    setStrokes(effectiveDocId, prev => {
      const next = prev.filter(stroke => !strokeHitTest(stroke, x, y, brushSize));
      return next.length === prev.length ? prev : next;
    });
    textElements.forEach(te => {
      const w = Math.max(80, te.text.length * 8);
      const h = te.type === 'sticky' ? 100 : 30;
      if (x >= te.x && x <= te.x + w && y >= te.y && y <= te.y + h) {
        deleteTextElement(effectiveDocId, te.id);
      }
    });
  }, [effectiveDocId, brushSize, setStrokes, textElements, deleteTextElement]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (palmRejection && e.pointerType === 'touch') return;
    if ((e.target as Element).closest('.text-element')) return;
    // Don't use setPointerCapture - we listen on window for move/up
    if (!effectiveDocId) return;

    // Claim the page here rather than waiting for this same pointerdown to bubble up
    // to the page container, which would discard the stroke that activated the page.
    if (effectiveDocId !== activeDocumentId) {
      useAppStore.setState({ activeDocumentId: effectiveDocId });
    }

    if (CANVAS_TOOLS.includes(activeTool)) {
      if (e.cancelable) e.preventDefault();
    }

    // Always fetch fresh rect to guarantee zero coordinate offset
    const el = containerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      rectRef.current.left = r.left;
      rectRef.current.top = r.top;
      rectRef.current.width = r.width;
      rectRef.current.height = r.height;
    }
    const rl = rectRef.current.left;
    const rt = rectRef.current.top;
    const x = e.clientX - rl;
    const y = e.clientY - rt;
    
    if (activeTool === 'select') {
      if (lassoBox && x >= Math.min(lassoBox.x, lassoBox.x + lassoBox.w) && x <= Math.max(lassoBox.x, lassoBox.x + lassoBox.w) 
          && y >= Math.min(lassoBox.y, lassoBox.y + lassoBox.h) && y <= Math.max(lassoBox.y, lassoBox.y + lassoBox.h)) {
        setIsDraggingLasso(true);
        dragStartRef.current = { x, y };
      } else {
        setLassoBox({ x, y, w: 0, h: 0 });
        setSelectedIndices([]);
        setIsDraggingLasso(false);
      }
      return;
    }

    if (activeTool === 'text' || activeTool === 'sticky') {
      const newId = uuidv4();
      addTextElement(effectiveDocId, {
        id: newId,
        x,
        y,
        text: '',
        type: activeTool
      });
      setFocusedTextId(newId);
      setLassoBox(null);
      setSelectedIndices([]);
      return;
    }

    if (!INK_TOOLS.has(activeTool) && activeTool !== 'eraser') return;
    
    setLassoBox(null);
    setSelectedIndices([]);

    if (activeTool === 'eraser') {
      isErasingRef.current = true;
      drawingPointerIdRef.current = e.pointerId;
      eraseAt(x, y);
      return;
    }

    const isShift = e.shiftKey || isShiftRef.current;
    const isStraightMarker = activeTool === 'highlighter' && markerStraightMode;
    const isSnap = activeTool === 'ruler' || isStraightMarker || isShift;
    snapModeRef.current = isSnap;
    strokeStartRef.current = { x, y };
    lastPointerPosRef.current = { x, y };
    holdAnchorRef.current = { x, y };

    isDrawingRef.current = true;
    drawingPointerIdRef.current = e.pointerId;
    currentStrokeRef.current = [[x, y, 0.5]];

    // Show the initial dot immediately; a zero-length path with a round cap is a dot
    const liveEl = activeTool === 'highlighter' ? liveHlPathRef.current : livePenPathRef.current;
    if (liveEl) {
      const size = activeTool === 'highlighter' ? brushSize * 3 : brushSize;
      liveEl.setAttribute('d', `M ${x} ${y} L ${x} ${y}`);
      liveEl.setAttribute('stroke', brushColor);
      liveEl.setAttribute('stroke-width', String(size));
    }
    
    if (!isSnap && (activeTool === 'highlighter' || activeTool === 'pen')) {
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = setTimeout(() => triggerSnapRef.current(), 380);
    }
  }, [activeTool, lassoBox, effectiveDocId, activeDocumentId, addTextElement, setFocusedTextId, eraseAt, brushColor, brushSize, palmRejection, markerStraightMode]);

  const handlePointerMoveReact = useCallback((e: React.PointerEvent) => {
    if (activeTool !== 'select' || isDrawingRef.current) return;
    if (!effectiveDocId) return;
    const coords = getCoords(e.clientX, e.clientY);
    if (!coords) return;
    const { x, y } = coords;
    if (isDraggingLasso && dragStartRef.current && lassoBox) {
      setLassoOffset({ x: x - dragStartRef.current.x, y: y - dragStartRef.current.y });
    } else if (lassoBox) {
      setLassoBox({ ...lassoBox, w: x - lassoBox.x, h: y - lassoBox.y });
    }
  }, [activeTool, effectiveDocId, isDraggingLasso, lassoBox]);

  const handlePointerUpReact = useCallback(() => {
    if (activeTool !== 'select') return;
    if (isDraggingLasso && lassoBox) {
      translateStrokes(effectiveDocId!, selectedIndices, lassoOffset.x, lassoOffset.y);
      setLassoBox({ x: lassoBox.x + lassoOffset.x, y: lassoBox.y + lassoOffset.y, w: lassoBox.w, h: lassoBox.h });
      setLassoOffset({ x: 0, y: 0 });
      setIsDraggingLasso(false);
    } else if (lassoBox && !isDraggingLasso) {
      const nx = lassoBox.w < 0 ? lassoBox.x + lassoBox.w : lassoBox.x;
      const ny = lassoBox.h < 0 ? lassoBox.y + lassoBox.h : lassoBox.y;
      const nw = Math.abs(lassoBox.w);
      const nh = Math.abs(lassoBox.h);
      setLassoBox({ x: nx, y: ny, w: nw, h: nh });
      const selected: number[] = [];
      strokes.forEach((stroke, idx) => {
        const testPoints = interpolateStrokePoints(stroke);
        if (testPoints.some(p => p[0] >= nx && p[0] <= nx + nw && p[1] >= ny && p[1] <= ny + nh)) {
          selected.push(idx);
        }
      });
      setSelectedIndices(selected);
    }
    dragStartRef.current = null;
  }, [activeTool, effectiveDocId, lassoBox, isDraggingLasso, lassoOffset, selectedIndices, strokes, translateStrokes]);
  
  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    };
  }, []);

  const { highlighterEls, penEls } = useMemo(() => {
    const selected = new Set(selectedIndices);
    const highlighterEls: (React.ReactElement | null)[] = [];
    const penEls: (React.ReactElement | null)[] = [];
    strokes.forEach((s, i) => {
      const isHighlighter = s.tool === 'highlighter';
      const key = isHighlighter ? `hl-${i}` : `pen-${i}`;
      const isSel = selected.has(i);
      const el = isSel
        ? buildStrokeElement(s, key, true, isDraggingLasso ? lassoOffset : null)
        : cachedStrokeElement(s, key);
      (isHighlighter ? highlighterEls : penEls).push(el);
    });
    return { highlighterEls, penEls };
  }, [strokes, selectedIndices, isDraggingLasso, lassoOffset]);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        touchAction: 'none',
        pointerEvents: 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        zIndex: 10,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMoveReact}
      onPointerUp={handlePointerUpReact}
    >
      {/* SVG layer for finalized strokes */}
      <svg
        width={canvasDims.w}
        height={canvasDims.h}
        viewBox={`0 0 ${canvasDims.w} ${canvasDims.h}`}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
      >
        <g className="highlighter-strokes" style={{ mixBlendMode: 'multiply' }}>
          {highlighterEls}
          <path ref={liveHlPathRef} d="" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.35} />
        </g>
        <g className="pen-strokes">
          {penEls}
          <path ref={livePenPathRef} d="" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Lasso selection box layer */}
        {activeTool === 'select' && lassoBox && (
          <rect 
            x={lassoBox.w < 0 ? lassoBox.x + lassoBox.w : lassoBox.x}
            y={lassoBox.h < 0 ? lassoBox.y + lassoBox.h : lassoBox.y}
            width={Math.abs(lassoBox.w)}
            height={Math.abs(lassoBox.h)}
            fill="rgba(0, 122, 255, 0.1)"
            stroke="#007aff"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            style={{ transform: isDraggingLasso ? `translate(${lassoOffset.x}px, ${lassoOffset.y}px)` : 'none' }}
          />
        )}
      </svg>
    </div>
  );
};

export default DrawingCanvas;
