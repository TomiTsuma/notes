import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';

const ProjectsSection: React.FC = () => {
  const { 
    projects, 
    files, 
    kanbanTasks, 
    selectedProjectId, 
    setSelectedProjectId, 
    deleteProject, 
    updateProject,
    addFile,
    setActiveDocument,
    setActiveView,
    associateFileToProject
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('');
  
  const [newNoteName, setNewNoteName] = useState('');
  const [newNoteType, setNewNoteType] = useState<'md' | 'txt'>('md');
  const [showNoteForm, setShowNoteForm] = useState(false);

  const activeProj = projects.find(p => p.id === selectedProjectId) || projects[0] || null;

  // Set edit defaults when active project changes
  const startEditing = () => {
    if (!activeProj) return;
    setEditName(activeProj.name);
    setEditDesc(activeProj.description);
    setEditColor(activeProj.color);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!activeProj) return;
    updateProject(activeProj.id, {
      name: editName,
      description: editDesc,
      color: editColor
    });
    setIsEditing(false);
  };

  const handleAddNewNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteName.trim() || !activeProj) return;

    const noteNameWithExt = newNoteName.endsWith(`.${newNoteType}`) ? newNoteName : `${newNoteName}.${newNoteType}`;
    const newNoteId = `note-${uuidv4().substring(0, 8)}`;
    
    // Create base64 encoded empty initial note content
    const initialContent = `# ${newNoteName}\nCreated under project *${activeProj.name}* on ${new Date().toLocaleDateString()}.\n\nStart typing notes here...`;
    const base64Data = `data:text/plain;base64,${btoa(initialContent)}`;

    addFile({
      id: newNoteId,
      name: noteNameWithExt,
      type: newNoteType,
      folderId: null,
      projectId: activeProj.id,
      dataUrl: base64Data
    });

    setNewNoteName('');
    setShowNoteForm(false);
    setActiveDocument(newNoteId);
    setActiveView('canvas');
  };

  const handleDeleteProj = () => {
    if (!activeProj) return;
    if (confirm(`Are you sure you want to delete project '${activeProj.name}'? Linked notes will be moved to the Inbox.`)) {
      deleteProject(activeProj.id);
    }
  };

  const projectNotes = activeProj ? files.filter(f => f.projectId === activeProj.id) : [];
  const inboxNotes = files.filter(f => !f.projectId);
  const projectTasks = activeProj ? kanbanTasks.filter(t => t.projectId === activeProj.id) : [];

  const colors = ['#0a7aff', '#34c759', '#af52de', '#ff9500', '#ff2d55', '#5856d6', '#00c48c'];

  return (
    <div className="workspace-view-container" style={{ display: 'flex', flexDirection: 'row', gap: '24px', padding: '32px' }}>
      
      {/* Left panel: projects list */}
      <div 
        className="glass-card" 
        style={{ 
          width: '280px', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '20px', 
          gap: '16px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1c1c1e' }}>Projects</h3>
          <button 
            onClick={() => setActiveView('home')}
            style={{ border: 'none', background: 'transparent', color: '#0a7aff', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
          >
            + Create
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
          {projects.map(proj => {
            const isSelected = activeProj?.id === proj.id;
            return (
              <div
                key={proj.id}
                onClick={() => {
                  setSelectedProjectId(proj.id);
                  setIsEditing(false);
                }}
                className="btn-animate"
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: isSelected ? `1.5px solid ${proj.color}` : '1.5px solid transparent',
                  backgroundColor: isSelected ? `${proj.color}10` : 'rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: proj.color }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1c1c1e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {proj.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8e8e93', marginTop: '2px' }}>
                    {files.filter(f => f.projectId === proj.id).length} notes
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: project details and notebook linking */}
      {activeProj ? (
        <div 
          className="glass-card" 
          style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            padding: '32px', 
            gap: '24px',
            overflowY: 'auto'
          }}
        >
          
          {/* Project Details Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '20px' }}>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <input 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ fontSize: '24px', fontWeight: 900, borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', padding: '6px 12px', maxWidth: '300px' }}
                />
                <textarea 
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={2}
                  style={{ fontSize: '14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', padding: '6px 12px', resize: 'none', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {colors.map(c => (
                    <button 
                      key={c}
                      onClick={() => setEditColor(c)}
                      style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: c, border: editColor === c ? '2.5px solid #1c1c1e' : 'none', cursor: 'pointer', padding: 0 }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button onClick={() => setIsEditing(false)} style={{ border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', backgroundColor: '#f0f0f5', color: '#1c1c1e' }}>Cancel</button>
                  <button onClick={handleSaveEdit} style={{ border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', backgroundColor: activeProj.color, color: 'white' }}>Save Changes</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: activeProj.color }} />
                  <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#1c1c1e', letterSpacing: '-0.5px' }}>{activeProj.name}</h2>
                </div>
                <p style={{ fontSize: '14px', color: '#48484a', marginTop: '8px', lineHeight: 1.5, maxWidth: '600px' }}>
                  {activeProj.description || 'No description provided for this project.'}
                </p>
                <div style={{ fontSize: '11px', color: '#8e8e93', fontWeight: 700, marginTop: '12px' }}>
                  CREATED ON {new Date(activeProj.createdAt).toLocaleDateString()}
                </div>
              </div>
            )}

            {!isEditing && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={startEditing}
                  style={{ border: 'none', background: 'rgba(0,0,0,0.03)', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, color: '#48484a', cursor: 'pointer' }}
                  className="btn-animate"
                >
                  Edit details
                </button>
                <button 
                  onClick={handleDeleteProj}
                  style={{ border: 'none', background: 'rgba(255, 45, 85, 0.08)', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, color: '#ff2d55', cursor: 'pointer' }}
                  className="btn-animate"
                >
                  Delete project
                </button>
              </div>
            )}
          </div>

          {/* Quick Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#8e8e93', textTransform: 'uppercase' }}>Notebooks</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#1c1c1e', marginTop: '6px' }}>{projectNotes.length}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#8e8e93', textTransform: 'uppercase' }}>Kanban Tasks</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#1c1c1e', marginTop: '6px' }}>{projectTasks.length}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  setSelectedProjectId(activeProj.id);
                  setActiveView('kanban');
                }}
                style={{ border: 'none', background: activeProj.color, color: 'white', fontWeight: 800, fontSize: '12px', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer' }}
                className="btn-animate"
              >
                Go to Kanban Board →
              </button>
            </div>
          </div>

          {/* Notebooks Sub-section */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1c1c1e' }}>Linked Notes & Files</h3>
              <button 
                onClick={() => setShowNoteForm(true)}
                style={{ border: 'none', background: 'rgba(10, 122, 255, 0.08)', color: '#0a7aff', fontWeight: 800, fontSize: '12px', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer' }}
                className="btn-animate"
              >
                + Add Note
              </button>
            </div>

            {/* Note Creation Mini Form */}
            {showNoteForm && (
              <form onSubmit={handleAddNewNote} className="glass-card" style={{ padding: '20px', display: 'flex', gap: '12px', flexDirection: 'column', marginBottom: '16px', border: '1px solid rgba(0,0,0,0.08)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 800 }}>Create Project Note</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    value={newNoteName}
                    onChange={e => setNewNoteName(e.target.value)}
                    placeholder="Note title (e.g. Brainstorming)"
                    required
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }}
                  />
                  <select 
                    value={newNoteType}
                    onChange={e => setNewNoteType(e.target.value as any)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px', backgroundColor: '#fff' }}
                  >
                    <option value="md">Markdown (.md)</option>
                    <option value="txt">Plain Text (.txt)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
                  <button type="button" onClick={() => setShowNoteForm(false)} style={{ border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: '#f0f0f5' }}>Cancel</button>
                  <button type="submit" style={{ border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: activeProj.color, color: 'white' }}>Create</button>
                </div>
              </form>
            )}

            {/* Notes Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {projectNotes.map(file => (
                <div 
                  key={file.id}
                  className="glass-card glass-card-hover"
                  style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(0,0,0,0.03)' }}
                  onClick={() => {
                    setActiveDocument(file.id);
                    setActiveView('canvas');
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: `${activeProj.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeProj.color }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#1c1c1e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                      <div style={{ fontSize: '10px', color: '#8e8e93', marginTop: '2px', fontWeight: 600 }}>{file.type.toUpperCase()} File</div>
                    </div>
                  </div>
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remove note '${file.name}' from project '${activeProj.name}'?`)) {
                        associateFileToProject(file.id, null);
                      }
                    }}
                    style={{
                      fontSize: '11px',
                      color: '#8e8e93',
                      alignSelf: 'flex-end',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                    title="Unlink from project"
                  >
                    Unlink
                  </div>
                </div>
              ))}

              {projectNotes.length === 0 && (
                <div style={{ gridColumn: '1/-1', padding: '32px', textAlign: 'center', color: '#8e8e93', fontStyle: 'italic', fontSize: '13px' }}>
                  No notes linked to this project yet. Link a file from the list below or click '+ Add Note'.
                </div>
              )}
            </div>
          </div>

          {/* Linking Existing Unsorted Inbox Notes */}
          {inboxNotes.length > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#48484a', marginBottom: '12px' }}>📥 Link Unsorted Inbox Notes</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {inboxNotes.map(file => (
                  <button
                    key={file.id}
                    onClick={() => associateFileToProject(file.id, activeProj.id)}
                    style={{
                      backgroundColor: '#fff',
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#1c1c1e',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    className="btn-animate"
                  >
                    <span>📎 {file.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : (
        <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8e8e93', fontStyle: 'italic' }}>
          No active projects found. Head to the Dashboard to create one!
        </div>
      )}

    </div>
  );
};

export default ProjectsSection;
