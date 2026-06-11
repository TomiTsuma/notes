import React from 'react';
import { useAppStore } from '../../store/appStore';
import CanvasTagBar from '../Canvas/CanvasTagBar';

interface DocumentHeaderProps {
  showSidebar: boolean;
  onToggleSidebar: () => void;
  showToolbar: boolean;
  onToggleToolbar: () => void;
  children?: React.ReactNode;
}

const DocumentHeader: React.FC<DocumentHeaderProps> = ({ 
  showSidebar, 
  onToggleSidebar, 
  showToolbar: _showToolbar, 
  onToggleToolbar: _onToggleToolbar,
  children
}) => {
  const { 
    files, 
    activeDocumentId, 
    isRecording, 
    toggleRecording, 
    toggleRightPanel, 
    showRightPanel,
    activeView,
  } = useAppStore();
  
  const file = activeDocumentId ? files.find(f => f.id === activeDocumentId) : null;
  const iconStroke = 'var(--text-primary)';
  
  const getHeaderTitle = () => {
    switch (activeView) {
      case 'home':
        return '🏠 Workspace Dashboard';
      case 'projects':
        return '📂 Projects Hub';
      case 'kanban':
        return '📋 Kanban Task Board';
      case 'calendar':
        return '📅 Calendar Planner';
      case 'canvas':
      default:
        return file ? `📝 Note: ${file.name}` : 'Select a notebook';
    }
  };

  return (
    <div 
      style={{ 
        height: '56px', 
        backgroundColor: 'var(--header-bg)', 
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 24px', 
        borderBottom: '1px solid var(--header-border)', 
        fontFamily: 'Nunito',
        zIndex: 10,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        <button 
          onClick={onToggleSidebar} 
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', color: 'var(--text-primary)', flexShrink: 0 }} 
          title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
          className="btn-animate"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px', flexShrink: 0 }}>
          {getHeaderTitle()}
        </span>
        {activeView === 'canvas' && <CanvasTagBar />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {children}
        {activeView === 'canvas' && (
          <>
            <button 
              onClick={toggleRecording}
              style={{ background: isRecording ? 'var(--danger-color)' : 'transparent', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
              title={isRecording ? 'Stop recording' : 'Start recording'}
              className="btn-animate"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isRecording ? 'white' : iconStroke} strokeWidth="2.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
            </button>
            <button 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}
              title="Download"
              className="btn-animate"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
          </>
        )}
        <button 
          onClick={toggleRightPanel}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center' }}
          title={showRightPanel ? 'Hide AI panel' : 'Show AI panel'}
          className="btn-animate"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showRightPanel ? 'var(--accent-color)' : iconStroke} strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
      </div>
    </div>
  );
};

export default DocumentHeader;
