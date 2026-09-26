import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { ToolDock, ToolPopover, PEN_COLORS } from './clio';

// The palette's swatches are design tokens ('pen-black'), but a stroke needs a real
// colour: an invalid SVG stroke value resolves to `none`, so the ink never paints.
const resolvePenToken = (token: string) =>
  token.startsWith('#')
    ? token
    : getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim() || token;

const ToolPalette: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    brushColor,
    setBrushColor,
    brushSize,
    setBrushSize,
    undo,
    clearAnnotations,
    activeDocumentId,
    activeView,
    addNotebookPage,
    palmRejection,
  } = useAppStore();

  const [showPopover, setShowPopover] = useState(false);
  const swatchToken = PEN_COLORS.find((t) => resolvePenToken(t) === brushColor) ?? brushColor;

  if (activeView !== 'canvas') return null;

  const handleSelectTool = (toolId: string) => {
    setActiveTool(toolId as any);
    if (['pen', 'pencil', 'highlighter'].includes(toolId)) {
      setShowPopover((prev) => !prev);
    } else {
      setShowPopover(false);
    }
  };

  const handleClear = () => {
    if (activeDocumentId && confirm('Clear all annotations on this page?')) {
      clearAnnotations(activeDocumentId);
    }
  };

  const handleAddPage = () => {
    if (activeDocumentId) {
      addNotebookPage(activeDocumentId);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {showPopover && (
        <div style={{ pointerEvents: 'auto', marginBottom: 4 }}>
          <ToolPopover
            tool={activeTool}
            size={brushSize}
            color={swatchToken}
            palmRejection={palmRejection}
            onSizeChange={(s) => setBrushSize(s)}
            onColorChange={(c) => setBrushColor(resolvePenToken(c))}
          />
        </div>
      )}

      <div style={{ pointerEvents: 'auto' }}>
        <ToolDock
          active={activeTool}
          color={swatchToken}
          onSelect={handleSelectTool}
          onUndo={undo}
          onClear={handleClear}
          onAddPage={handleAddPage}
        />
      </div>
    </div>
  );
};

export default ToolPalette;
