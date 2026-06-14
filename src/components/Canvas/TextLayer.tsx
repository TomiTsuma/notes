import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import type { TextElement } from '../../store/appStore';
import ReferenceModal from '../Modals/ReferenceModal';

type RefModalState = { visible: boolean; x: number; y: number; textId: string | null }

const TextLayer: React.FC = () => {
  const {
    activeDocumentId, annotations, updateTextElement, deleteTextElement,
    updateTextElementPosition, focusedTextId, setFocusedTextId,
  } = useAppStore();
  
  const textElements = activeDocumentId && annotations[activeDocumentId] ? annotations[activeDocumentId].textElements : [];
  
  const [refModal, setRefModal] = useState<RefModalState>({ visible: false, x: 0, y: 0, textId: null });
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  const [draggingEl, setDraggingEl] = useState<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusedTextId && textareaRefs.current[focusedTextId]) {
      textareaRefs.current[focusedTextId]?.focus();
    }
  }, [focusedTextId]);

  // Convert viewport coordinates to overlay-relative coordinates
  const getOverlayCoords = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: clientX, y: clientY };
    const rect = el.getBoundingClientRect();
    const scrollParent = el.closest('[data-scroll-container]') as HTMLElement | null;
    const scrollTop = scrollParent?.scrollTop ?? 0;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top + scrollTop,
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>, el: TextElement) => {
    if (!activeDocumentId) return;
    const val = e.target.value;
    updateTextElement(activeDocumentId, el.id, val);

    if (val.match(/\\ref $/)) {
      const rect = e.target.getBoundingClientRect();
      setRefModal({ visible: true, x: rect.left, y: rect.bottom, textId: el.id });
    }
  };

  const handleRefSelect = (paperTitle: string) => {
    if (refModal.textId && activeDocumentId) {
      const el = textElements.find(t => t.id === refModal.textId);
      if (el) {
        const newText = el.text.replace(/\\ref $/, `[${paperTitle}] `);
        updateTextElement(activeDocumentId, el.id, newText);
      }
    }
    setRefModal({ visible: false, x: 0, y: 0, textId: null });
  };

  const handleGripPointerDown = (e: React.PointerEvent, el: TextElement) => {
    e.stopPropagation();
    setDraggingEl(el.id);
    const coords = getOverlayCoords(e.clientX, e.clientY);
    dragStartPos.current = { x: coords.x - el.x, y: coords.y - el.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingEl && activeDocumentId) {
      const coords = getOverlayCoords(e.clientX, e.clientY);
      updateTextElementPosition(activeDocumentId, draggingEl, coords.x - dragStartPos.current.x, coords.y - dragStartPos.current.y);
    }
  };

  const handlePointerUp = () => setDraggingEl(null);

  return (
    <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {textElements.map(el => (
        <div 
          key={el.id}
          className="text-element"
          onPointerDown={e => e.stopPropagation()}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'absolute',
            left: el.x,
            top: el.y,
            pointerEvents: 'auto',
            padding: el.type === 'sticky' ? '28px 12px 12px 12px' : '4px',
            backgroundColor: el.type === 'sticky' ? '#fff8b5' : 'transparent',
            boxShadow: el.type === 'sticky' ? '0 1px 4px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)' : 'none',
            minWidth: '200px',
            minHeight: '100px',
            borderRadius: '6px',
            border: el.type === 'text' ? '1px dashed rgba(0,0,0,0.15)' : 'none',
            cursor: draggingEl === el.id ? 'grabbing' : 'default',
            outline: focusedTextId === el.id ? '2px solid rgba(10,122,255,0.3)' : 'none',
            transition: 'outline 0.15s ease',
          }}
        >
          {el.type === 'sticky' && (
            <div
              onPointerDown={e => handleGripPointerDown(e, el)}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '24px',
                backgroundColor: 'rgba(0,0,0,0.05)', borderTopLeftRadius: '4px', borderTopRightRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab',
              }}
            >
              <div style={{ width: '40px', height: '4px', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '2px' }} />
            </div>
          )}

          <button 
            onClick={(e) => { e.stopPropagation(); if (activeDocumentId) deleteTextElement(activeDocumentId, el.id); }}
            style={{
              position: 'absolute', top: '-10px', right: '-10px', width: '24px', height: '24px',
              borderRadius: '50%', backgroundColor: '#ff3b30', border: 'none', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
            title="Delete Note"
          >
            ✕
          </button>

          <textarea
            ref={node => { textareaRefs.current[el.id] = node; }}
            value={el.text}
            onChange={(e) => handleChange(e, el)}
            onFocus={() => setFocusedTextId(el.id)}
            onPointerDown={e => e.stopPropagation()}
            placeholder={el.type === 'sticky' ? 'Sticky Note...' : 'Type text...'}
            style={{
              width: '100%', height: '100%', background: 'transparent',
              border: 'none', outline: 'none', resize: 'both',
              fontFamily: 'Nunito', fontSize: '16px', color: '#1c1c1e',
              lineHeight: 1.5, overflow: 'auto', minHeight: '60px', cursor: 'text',
            }}
          />
        </div>
      ))}
      {refModal.visible && (
        <div style={{ pointerEvents: 'auto', zIndex: 100 }}>
          <ReferenceModal 
            x={refModal.x} y={refModal.y} 
            onSelect={handleRefSelect} 
            onClose={() => setRefModal({ visible: false, x: 0, y: 0, textId: null })} 
          />
        </div>
      )}
    </div>
  );
};

export default TextLayer;
