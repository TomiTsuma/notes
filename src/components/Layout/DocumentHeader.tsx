import React from 'react';
import { useAppStore } from '../../store/appStore';
import logoUrl from '../../assets/logo.png';

interface DocumentHeaderProps {
  showSidebar: boolean;
  onToggleSidebar: () => void;
  showToolbar: boolean;
  onToggleToolbar: () => void;
}

const DocumentHeader: React.FC<DocumentHeaderProps> = ({ showSidebar, onToggleSidebar, showToolbar, onToggleToolbar }) => {
  const { files, activeDocumentId, isRecording, toggleRecording, toggleRightPanel, showRightPanel } = useAppStore();
  
  const file = activeDocumentId ? files.find(f => f.id === activeDocumentId) : null;
  const fileName = file ? file.name : 'Select a document';

  return (
    <div style={{ height: '56px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border-color)', fontFamily: 'Nunito' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onToggleSidebar} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center' }} title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <img src={logoUrl} alt="Clio" style={{ width: 22, height: 22, objectFit: 'contain' }} />
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>{fileName}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onToggleToolbar} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} title={showToolbar ? 'Hide toolbar' : 'Show toolbar'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2"><path d="M4 5h16M4 12h16M4 19h16"/></svg>
        </button>

        <button onClick={toggleRecording} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }} title="Voice recording">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke={isRecording ? '#e24361' : '#1c1c1e'}><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
          {isRecording && <span style={{ fontSize: '13px', color: '#e24361', fontWeight: 700 }}>Rec</span>}
        </button>

        <button onClick={() => { window.print(); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} title="Export via Print">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        </button>
        
        <button onClick={toggleRightPanel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} title="Document Properties">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={showRightPanel ? 'var(--accent-color)' : '#1c1c1e'} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
      </div>
    </div>
  );
};
export default DocumentHeader;
