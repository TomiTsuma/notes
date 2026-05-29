import React from 'react';
import { useAppStore } from '../../store/appStore';

interface DocumentHeaderProps {
  showSidebar: boolean;
  onToggleSidebar: () => void;
  showToolbar: boolean;
  onToggleToolbar: () => void;
}

const DocumentHeader: React.FC<DocumentHeaderProps> = ({ 
  showSidebar, 
  onToggleSidebar, 
  showToolbar, 
  onToggleToolbar 
}) => {
  const { 
    files, 
    activeDocumentId, 
    isRecording, 
    toggleRecording, 
    toggleRightPanel, 
    showRightPanel,
    // Dynamic titles
    activeView
  } = useAppStore();
  
  const file = activeDocumentId ? files.find(f => f.id === activeDocumentId) : null;
  
  // Get active view label
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
        backgroundColor: 'rgba(255, 255, 255, 0.45)', 
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 24px', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.3)', 
        fontFamily: 'Nunito',
        zIndex: 10
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button 
          onClick={onToggleSidebar} 
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center' }} 
          title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
          className="btn-animate"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <span style={{ fontSize: '15px', fontWeight: 800, color: '#1c1c1e', letterSpacing: '-0.2px' }}>
          {getHeaderTitle()}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        
        {/* Render note specific tools ONLY when on Canvas view */}
        {activeView === 'canvas' && (
          <>
            <button 
              onClick={onToggleToolbar} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} 
              title={showToolbar ? 'Hide toolbar' : 'Show toolbar'}
              className="btn-animate"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2.5"><path d="M4 5h16M4 12h16M4 19h16"/></svg>
            </button>

            <button 
              onClick={toggleRecording} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }} 
              title="Voice recording transcription helper"
              className="btn-animate"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" stroke={isRecording ? '#ff2d55' : '#1c1c1e'}><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
              {isRecording && <span style={{ fontSize: '12px', color: '#ff2d55', fontWeight: 800, animation: 'pulse 1s infinite' }}>REC</span>}
            </button>

            <button 
              onClick={() => { window.print(); }} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} 
              title="Export Notebook via Print"
              className="btn-animate"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
          </>
        )}

        {/* Global Properties toggle (works everywhere, showing summarizer/chat!) */}
        <button 
          onClick={toggleRightPanel} 
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} 
          title="Toggle AI Side Panel"
          className="btn-animate"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showRightPanel ? '#0a7aff' : '#1c1c1e'} strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
      </div>
    </div>
  );
};

export default DocumentHeader;
