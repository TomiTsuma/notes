import React, { useRef, useState, useCallback, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';
import { useAppStore } from '../../store/appStore';
import type { Stroke, Point } from '../../store/appStore';

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

const DrawingCanvas: React.FC = () => {
  const { activeTool, brushColor, brushSize, activeDocumentId, annotations, setStrokes, translateStrokes } = useAppStore();
  
  const strokes = activeDocumentId && annotations[activeDocumentId] ? annotations[activeDocumentId].strokes : [];
  
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [snapMode, setSnapMode] = useState(false);
  
  // Lasso State
  const [lassoBox, setLassoBox] = useState<Box | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isDraggingLasso, setIsDraggingLasso] = useState(false);
  const [lassoOffset, setLassoOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{x: number, y: number} | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    if (!activeDocumentId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
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

    if (activeTool !== 'pen' && activeTool !== 'highlighter' && activeTool !== 'eraser' && activeTool !== 'ruler') return;
    
    setLassoBox(null);
    setSelectedIndices([]);

    setCurrentStroke([[x, y, pressure]]);
    setSnapMode(activeTool === 'ruler');
    
    if (activeTool === 'highlighter') {
      holdTimeoutRef.current = setTimeout(() => {
        setSnapMode(true);
      }, 400); 
    }
  }, [activeTool, lassoBox, activeDocumentId]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons !== 1) return;
    if (!activeDocumentId) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (activeTool === 'select') {
      if (isDraggingLasso && dragStartRef.current && lassoBox) {
        setLassoOffset({ x: x - dragStartRef.current.x, y: y - dragStartRef.current.y });
      } else if (lassoBox) {
        setLassoBox({ ...lassoBox, w: x - lassoBox.x, h: y - lassoBox.y });
      }
      return;
    }

    if (activeTool === 'eraser') {
      setStrokes(activeDocumentId, prev => prev.filter(stroke => {
        return !stroke.points.some(p => Math.hypot(p[0] - x, p[1] - y) < 20);
      }));
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
  }, [activeTool, snapMode, activeDocumentId, setStrokes, isDraggingLasso, lassoBox]);

  const handlePointerUp = useCallback(() => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (!activeDocumentId) return;

    if (activeTool === 'select') {
      if (isDraggingLasso && lassoBox) {
        translateStrokes(activeDocumentId, selectedIndices, lassoOffset.x, lassoOffset.y);
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
      setStrokes(activeDocumentId, prev => [...prev, {
        points: currentStroke,
        color: brushColor,
        size: activeTool === 'highlighter' ? 24 : brushSize,
        tool: activeTool === 'highlighter' ? 'highlighter' : 'pen'
      }]);
      setCurrentStroke([]);
      setSnapMode(false);
    }
  }, [currentStroke, brushColor, brushSize, activeTool, activeDocumentId, setStrokes, lassoBox, isDraggingLasso, lassoOffset, selectedIndices, strokes, translateStrokes]);
  
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
  const pens = strokes.map((s, i) => ({ s, i })).filter(({ s }) => s.tool === 'pen');

  const activeStrokeData = currentStroke.length > 0 && activeTool !== 'select' ? {
    points: currentStroke,
    color: brushColor,
    size: activeTool === 'highlighter' ? 24 : brushSize,
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
      <svg style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
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
