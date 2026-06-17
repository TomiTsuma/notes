import React, { useRef, useState, useCallback, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';
import { useAppStore } from '../../store/appStore';
import type { Stroke, Point } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke || stroke.length === 0) return '';
  const len = stroke.length;
  if (len === 1) {
    const [x, y] = stroke[0];
    return `M ${x} ${y} L ${x} ${y} Z`;
  }
  const d: string[] = ['M', stroke[0][0].toString(), stroke[0][1].toString()];
  for (let i = 1; i < len; i++) {
    const [px, py] = stroke[i - 1];
    const [cx, cy] = stroke[i];
    const mx = (px + cx) / 2;
    const my = (py + cy) / 2;
    d.push('Q', px.toString(), py.toString(), mx.toString(), my.toString());
  }
  const last = stroke[len - 1];
  d.push('L', last[0].toString(), last[1].toString());
  d.push('Z');
  return d.join(' ');
}

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

const DrawingCanvas: React.FC<{ documentId?: string }> = ({ documentId }) => {
  const { activeTool, brushColor, brushSize, activeDocumentId, annotations, setStrokes, translateStrokes, addTextElement, setFocusedTextId, deleteTextElement } = useAppStore();
  
  const effectiveDocId = documentId || activeDocumentId;
  const isActive = effectiveDocId === activeDocumentId;
  const strokes = effectiveDocId && annotations[effectiveDocId] ? annotations[effectiveDocId].strokes : [];
  const textElements = effectiveDocId && annotations[effectiveDocId] ? annotations[effectiveDocId].textElements : [];
  
  const currentStrokeRef = useRef<Point[]>([]);
  const isDrawingRef = useRef(false);
  const [_strokeVersion, setStrokeVersion] = useState(0); // triggers re-render for finalized strokes
  const [snapMode, setSnapMode] = useState(false);
  const [canvasDims, setCanvasDims] = useState({ w: 800, h: 1200 });
  
  // Lasso state
  const [lassoBox, setLassoBox] = useState<Box | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isDraggingLasso, setIsDraggingLasso] = useState(false);
  const [lassoOffset, setLassoOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{x: number, y: number} | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs to always have latest values in native event listeners
  const activeToolRef = useRef(activeTool);
  const brushColorRef = useRef(brushColor);
  const brushSizeRef = useRef(brushSize);
  const effectiveDocIdRef = useRef(effectiveDocId);
  const isActiveRef = useRef(isActive);
  const snapModeRef = useRef(snapMode);
  activeToolRef.current = activeTool;
  brushColorRef.current = brushColor;
  brushSizeRef.current = brushSize;
  effectiveDocIdRef.current = effectiveDocId;
  isActiveRef.current = isActive;
  snapModeRef.current = snapMode;

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
      if (tool !== 'pen' && tool !== 'highlighter' && tool !== 'ruler') return;

      const rl = rectRef.current.left;
      const rt = rectRef.current.top;
      const pts = currentStrokeRef.current;
      const prevLen = pts.length;

      if (snapModeRef.current && pts.length > 0) {
        const lastEvt = events[events.length - 1];
        pts.length = 1;
        pts.push([lastEvt.clientX - rl, lastEvt.clientY - rt, 0.5]);
      } else {
        for (const evt of events) {
          const x = evt.clientX - rl;
          const y = evt.clientY - rt;
          pts.push([x, y, 0.5]);
        }
      }

      if (pts.length < 2) return;

      const canvas = liveCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = tool === 'highlighter' ? brushSizeRef.current * 3 : brushSizeRef.current;

      if (tool === 'highlighter') {
        // Full redraw for highlighter (avoids alpha accumulation at joins)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = brushColorRef.current;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      } else {
        // Incremental draw for pen: draw only new segments from previous endpoint
        ctx.globalAlpha = 1;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = brushColorRef.current;
        // Start from the last point that was already drawn
        const startIdx = Math.max(0, prevLen - 1);
        ctx.beginPath();
        ctx.moveTo(pts[startIdx][0], pts[startIdx][1]);
        for (let i = startIdx + 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const tool = activeToolRef.current;
      if (!effectiveDocIdRef.current || !isActiveRef.current) return;

      const rl = rectRef.current.left;
      const rt = rectRef.current.top;

      // Handle eraser during pointer move
      if (tool === 'eraser' && e.buttons === 1) {
        const x = e.clientX - rl;
        const y = e.clientY - rt;
        const docId = effectiveDocIdRef.current;
        const bs = brushSizeRef.current;
        setStrokes(docId, prev =>
          prev.filter(stroke => !strokeHitTest(stroke, x, y, bs))
        );
        return;
      }

      if (!isDrawingRef.current) return;
      if (tool !== 'pen' && tool !== 'highlighter' && tool !== 'ruler') return;

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

    const onPointerUp = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

      // Process any remaining pending events before finalizing
      if (pendingEventsRef.current.length > 0) {
        processDrawingEvents();
      }

      const docId = effectiveDocIdRef.current;
      const active = isActiveRef.current;

      if (!docId || !active) { currentStrokeRef.current = []; clearCanvasNow(); return; }

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
        setStrokeVersion(v => v + 1);
      }
      currentStrokeRef.current = [];
      setSnapMode(false);

      // Clear canvas immediately - SVG will render on next React commit
      clearCanvasNow();
    };

    const clearCanvasNow = () => {
      rafPendingRef.current = false;
      pendingEventsRef.current = [];
      const canvas = liveCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    // Use window-level listeners for move/up to avoid pointer capture issues
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      ro.disconnect();
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
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const parentH = el.parentElement?.scrollHeight || el.offsetHeight;
      const w = Math.max(rect.width, 800);
      const h = Math.max(parentH, el.offsetHeight, 800);
      setCanvasDims({ w, h });
      // Resize live canvas to match
      const canvas = liveCanvasRef.current;
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
      }
    });
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [activeDocumentId]);

  const getCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const eraseAt = useCallback((x: number, y: number) => {
    if (!effectiveDocId || !isActive) return;
    setStrokes(effectiveDocId, prev =>
      prev.filter(stroke => !strokeHitTest(stroke, x, y, brushSize))
    );
    textElements.forEach(te => {
      const w = Math.max(80, te.text.length * 8);
      const h = te.type === 'sticky' ? 100 : 30;
      if (x >= te.x && x <= te.x + w && y >= te.y && y <= te.y + h) {
        deleteTextElement(effectiveDocId, te.id);
      }
    });
  }, [effectiveDocId, isActive, brushSize, setStrokes, textElements, deleteTextElement]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as Element).closest('.text-element')) return;
    // Don't use setPointerCapture - we listen on window for move/up
    if (!effectiveDocId || !isActive) return;
    // Use cached rect for coordinate consistency with pointermove
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

    if (activeTool !== 'pen' && activeTool !== 'highlighter' && activeTool !== 'eraser' && activeTool !== 'ruler') return;
    
    setLassoBox(null);
    setSelectedIndices([]);

    if (activeTool === 'eraser') {
      eraseAt(x, y);
      return;
    }

    isDrawingRef.current = true;
    currentStrokeRef.current = [[x, y, 0.5]];
    setSnapMode(activeTool === 'ruler');

    // Draw the initial dot immediately using a filled circle
    const canvas = liveCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const size = activeTool === 'highlighter' ? brushSize * 3 : brushSize;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = activeTool === 'highlighter' ? 0.35 : 1;
        ctx.fillStyle = brushColor;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    if (activeTool === 'highlighter') {
      holdTimeoutRef.current = setTimeout(() => {
        setSnapMode(true);
      }, 400); 
    }
  }, [activeTool, lassoBox, effectiveDocId, isActive, addTextElement, setFocusedTextId, eraseAt, brushColor, brushSize]);

  const handlePointerMoveReact = useCallback((e: React.PointerEvent) => {
    if (activeTool !== 'select' || isDrawingRef.current) return;
    if (!effectiveDocId || !isActive) return;
    const coords = getCoords(e.clientX, e.clientY);
    if (!coords) return;
    const { x, y } = coords;
    if (isDraggingLasso && dragStartRef.current && lassoBox) {
      setLassoOffset({ x: x - dragStartRef.current.x, y: y - dragStartRef.current.y });
    } else if (lassoBox) {
      setLassoBox({ ...lassoBox, w: x - lassoBox.x, h: y - lassoBox.y });
    }
  }, [activeTool, effectiveDocId, isActive, isDraggingLasso, lassoBox]);

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
        if (stroke.points.some(p => p[0] >= nx && p[0] <= nx + nw && p[1] >= ny && p[1] <= ny + nh)) {
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

  const renderStroke = (stroke: Stroke | { points: Point[], color: string, size: number, tool: string }, i: number | string, isSelectedRender: boolean = false) => {
    let renderPoints = stroke.points;
    if (stroke.points.length === 2 && (stroke.tool === 'highlighter' || stroke.tool === 'ruler')) {
      const [start, end] = stroke.points;
      renderPoints = [];
      const steps = 30; 
      for (let j = 0; j <= steps; j++) {
        renderPoints.push([
          start[0] + (end[0] - start[0]) * (j/steps),
          start[1] + (end[1] - start[1]) * (j/steps),
          start[2] 
        ]);
      }
    }
    
    if (renderPoints.length === 0) return null;

    const isSelected = isSelectedRender && isDraggingLasso;
    const transformStyle = isSelected ? `translate(${lassoOffset.x}px, ${lassoOffset.y}px)` : 'none';
    const filterVal = isSelectedRender ? 'drop-shadow(0px 0px 2px #007aff)' : 'none';

    // Pen: use SVG stroke for perfectly uniform width and round ends
    if (stroke.tool === 'pen') {
      const d = getSvgPathFromPoints(renderPoints);
      return (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.size}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: transformStyle, transition: 'none' }}
          filter={filterVal}
        />
      );
    }

    // Highlighter/ruler: use perfect-freehand filled outline
    const outlinePoints = getStroke(renderPoints, {
      size: stroke.size,
      thinning: 0,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: false,
    });
    const pathData = getSvgPathFromStroke(outlinePoints);

    return (
      <path
        key={i}
        d={pathData}
        fill={stroke.color}
        opacity={stroke.tool === 'highlighter' ? 0.35 : 1}
        style={{ 
          mixBlendMode: stroke.tool === 'highlighter' ? 'multiply' : 'normal',
          transform: transformStyle,
          transition: 'none'
        }}
        filter={filterVal}
      />
    );
  };

  const highlighters = strokes.map((s, i) => ({ s, i })).filter(({ s }) => s.tool === 'highlighter');
  const pens = strokes.map((s, i) => ({ s, i })).filter(({ s }) => s.tool === 'pen' || s.tool === 'ruler');

  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height: '100%', touchAction: 'none', pointerEvents: 'auto' }}
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
        <g className="highlighter-strokes">
          {highlighters.map(({ s, i }) => renderStroke(s, `hl-${i}`, selectedIndices.includes(i)))}
        </g>
        <g className="pen-strokes">
          {pens.map(({ s, i }) => renderStroke(s, `pen-${i}`, selectedIndices.includes(i)))}
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
      {/* Live canvas overlay for real-time drawing feedback */}
      <canvas
        ref={liveCanvasRef}
        width={canvasDims.w}
        height={canvasDims.h}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />
    </div>
  );
};

export default DrawingCanvas;
