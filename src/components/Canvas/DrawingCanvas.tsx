import React, { useRef, useState, useCallback, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';
import { useAppStore } from '../../store/appStore';
import type { Stroke, Point } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke || stroke.length === 0) return '';
  const d = stroke.reduce(
    (acc: string[], [x0, y0]: number[], i: number, arr: number[][]) => {
      const nextPoint = arr[(i + 1) % arr.length];
      if (!nextPoint) return acc;
      const [x1, y1] = nextPoint;
      acc.push(x0.toString(), y0.toString(), ((x0 + x1) / 2).toString(), ((y0 + y1) / 2).toString());
      return acc;
    },
    ['M', ...stroke[0].map(n => n.toString()), 'Q']
  );
  d.push('Z');
  return d.join(' ');
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
  
  // Use documentId prop for rendering (each notebook page shows its own strokes),
  // fall back to global activeDocumentId for non-notebook contexts
  const effectiveDocId = documentId || activeDocumentId;
  const isActive = effectiveDocId === activeDocumentId;
  const strokes = effectiveDocId && annotations[effectiveDocId] ? annotations[effectiveDocId].strokes : [];
  const textElements = effectiveDocId && annotations[effectiveDocId] ? annotations[effectiveDocId].textElements : [];
  
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [snapMode, setSnapMode] = useState(false);
  const [canvasDims, setCanvasDims] = useState({ w: 800, h: 1200 });
  
  // Lasso state
  const [lassoBox, setLassoBox] = useState<Box | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isDraggingLasso, setIsDraggingLasso] = useState(false);
  const [lassoOffset, setLassoOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{x: number, y: number} | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track container dimensions for accurate SVG coordinate system
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const parentH = el.parentElement?.scrollHeight || el.offsetHeight;
      setCanvasDims({ w: Math.max(rect.width, 800), h: Math.max(parentH, el.offsetHeight, 800) });
    });
    ro.observe(el);
    // Also observe parent for height changes (PDF pages loading)
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
    (e.target as Element).setPointerCapture(e.pointerId);
    // Only respond to pointer events on the active page
    if (!effectiveDocId || !isActive) return;
    const coords = getCoords(e.clientX, e.clientY);
    if (!coords) return;
    const { x, y } = coords;
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
    
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

    setCurrentStroke([[x, y, pressure]]);
    setSnapMode(activeTool === 'ruler');
    
    if (activeTool === 'highlighter') {
      holdTimeoutRef.current = setTimeout(() => {
        setSnapMode(true);
      }, 400); 
    }
  }, [activeTool, lassoBox, effectiveDocId, isActive, addTextElement, setFocusedTextId, eraseAt]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons !== 1) return;
    if (!effectiveDocId || !isActive) return;

    const coords = getCoords(e.clientX, e.clientY);
    if (!coords) return;
    const { x, y } = coords;
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
    
    if (activeTool === 'select') {
      if (isDraggingLasso && dragStartRef.current && lassoBox) {
        setLassoOffset({ x: x - dragStartRef.current.x, y: y - dragStartRef.current.y });
      } else if (lassoBox) {
        setLassoBox({ ...lassoBox, w: x - lassoBox.x, h: y - lassoBox.y });
      }
      return;
    }

    if (activeTool === 'eraser') {
      eraseAt(x, y);
    } else if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'ruler') {
      if (activeTool === 'highlighter' && !snapMode) {
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = setTimeout(() => {
          setSnapMode(true);
        }, 400);
      }
      
      setCurrentStroke(prev => {
        if (snapMode && prev.length > 0) {
          return [prev[0], [x, y, pressure]]; // Straight line bounding
        }
        return [...prev, [x, y, pressure]];
      });
    }
  }, [activeTool, snapMode, effectiveDocId, isActive, setStrokes, isDraggingLasso, lassoBox, eraseAt]);

  const handlePointerUp = useCallback(() => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (!effectiveDocId || !isActive) return;

    if (activeTool === 'select') {
      if (isDraggingLasso && lassoBox) {
        translateStrokes(effectiveDocId, selectedIndices, lassoOffset.x, lassoOffset.y);
        setLassoBox({ 
          x: lassoBox.x + lassoOffset.x, 
          y: lassoBox.y + lassoOffset.y, 
          w: lassoBox.w, 
          h: lassoBox.h 
        });
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
      return;
    }

    if (activeTool === 'eraser') return;
    
    if (currentStroke.length > 0) {
      const tool: Stroke['tool'] = activeTool === 'highlighter' ? 'highlighter' : activeTool === 'ruler' ? 'ruler' : 'pen';
      setStrokes(effectiveDocId, prev => [...prev, {
        points: currentStroke,
        color: brushColor,
        size: activeTool === 'highlighter' ? brushSize * 3 : brushSize,
        tool,
      }]);
      setCurrentStroke([]);
      setSnapMode(false);
    }
  }, [currentStroke, brushColor, brushSize, activeTool, effectiveDocId, isActive, setStrokes, lassoBox, isDraggingLasso, lassoOffset, selectedIndices, strokes, translateStrokes]);
  
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
    
    const pathData = getSvgPathFromStroke(getStroke(renderPoints, {
      size: stroke.size,
      thinning: stroke.tool === 'highlighter' ? -0.5 : 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: renderPoints[0]?.[2] === 0.5
    }));

    return (
      <path
        key={i}
        d={pathData}
        fill={stroke.color}
        opacity={stroke.tool === 'highlighter' ? 0.35 : 1}
        style={{ 
          mixBlendMode: stroke.tool === 'highlighter' ? 'multiply' : 'normal',
          transform: isSelectedRender && isDraggingLasso ? `translate(${lassoOffset.x}px, ${lassoOffset.y}px)` : 'none',
          transition: 'none'
        }}
        filter={isSelectedRender ? 'drop-shadow(0px 0px 2px #007aff)' : 'none'}
      />
    );
  };

  const highlighters = strokes.map((s, i) => ({ s, i })).filter(({ s }) => s.tool === 'highlighter');
  const pens = strokes.map((s, i) => ({ s, i })).filter(({ s }) => s.tool === 'pen' || s.tool === 'ruler');

  const activeStrokeData = currentStroke.length > 0 && activeTool !== 'select' ? {
    points: currentStroke,
    color: brushColor,
    size: activeTool === 'highlighter' ? brushSize * 3 : brushSize,
    tool: activeTool
  } : null;

  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height: '100%', touchAction: 'none', pointerEvents: 'auto' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <svg
        width={canvasDims.w}
        height={canvasDims.h}
        viewBox={`0 0 ${canvasDims.w} ${canvasDims.h}`}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <g className="highlighter-strokes">
          {highlighters.map(({ s, i }) => renderStroke(s, `hl-${i}`, selectedIndices.includes(i)))}
          {activeStrokeData && activeStrokeData.tool === 'highlighter' && renderStroke(activeStrokeData, 'hl-active')}
        </g>
        <g className="pen-strokes">
          {pens.map(({ s, i }) => renderStroke(s, `pen-${i}`, selectedIndices.includes(i)))}
          {activeStrokeData && (activeStrokeData.tool === 'pen' || activeStrokeData.tool === 'ruler') && renderStroke(activeStrokeData, 'pen-active')}
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
