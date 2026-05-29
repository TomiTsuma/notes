import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';

const HomeDashboard: React.FC = () => {
  const { 
    projects, 
    files, 
    kanbanTasks, 
    calendarEvents, 
    userStreak, 
    setActiveView, 
    setActiveDocument, 
    setSelectedProjectId,
    addProject
  } = useAppStore();

  const [showAddProjModal, setShowAddProjModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjColor, setNewProjColor] = useState('#0a7aff');

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvents = calendarEvents.filter(ev => ev.date === todayStr);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    
    addProject({
      id: `proj-${uuidv4().substring(0, 8)}`,
      name: newProjName,
      description: newProjDesc,
      color: newProjColor,
      createdAt: new Date().toISOString()
    });

    setNewProjName('');
    setNewProjDesc('');
    setShowAddProjModal(false);
  };

  const colorsOption = ['#0a7aff', '#34c759', '#af52de', '#ff9500', '#ff2d55', '#5856d6', '#00c48c'];

  // Format date nicely
  const getGreetingDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <div className="workspace-view-container" style={{ gap: '28px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      
      {/* Top Banner Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0a7aff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
            {getGreetingDate()}
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#1c1c1e', letterSpacing: '-1px' }}>
            Welcome back, TomiTsuma! 👋
          </h1>
          <p style={{ fontSize: '15px', color: '#48484a', marginTop: '2px', fontWeight: 500 }}>
            Here is your productivity outline for today. All systems are online.
          </p>
        </div>

        <button 
          onClick={() => setShowAddProjModal(true)}
          style={{
            background: 'linear-gradient(135deg, #0a7aff, #0062d6)',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(10, 122, 255, 0.25)'
          }}
          className="btn-animate"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Project
        </button>
      </div>

      {/* Grid for Dashboard Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Streak Stats Card (inspired by streak_stats_ui.jpeg) */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '15px', color: '#1c1c1e', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔥 Active Streak
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, backgroundColor: 'rgba(255, 149, 0, 0.12)', color: '#ff9500', padding: '4px 10px', borderRadius: '8px' }}>
              Consistency
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', margin: '8px 0' }}>
            <div style={{ 
              fontSize: '44px', 
              fontWeight: 900, 
              background: 'linear-gradient(135deg, #ff9500, #ff2d55)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-2px'
            }}>
              {userStreak.streakCount} Days
            </div>
            <div style={{ fontSize: '13px', color: '#48484a', fontWeight: 600, lineHeight: 1.4 }}>
              Keep writing and completing tasks to grow your active streak streak!
            </div>
          </div>

          {/* Daily Weekday Bubbles */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
              const active = idx < userStreak.streakCount % 7 || userStreak.streakCount > 5;
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: active ? '#ff9500' : 'rgba(0,0,0,0.04)',
                    color: active ? '#fff' : '#8e8e93',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '11px',
                    boxShadow: active ? '0 2px 8px rgba(255, 149, 0, 0.3)' : 'none'
                  }}>
                    ✓
                  </div>
                  <span style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 700 }}>{day}</span>
                </div>
              );
            })}
          </div>

          {/* Stats Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
            <div style={{ backgroundColor: 'rgba(10, 122, 255, 0.05)', borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#0a7aff' }}>{userStreak.totalTasksCompleted}</div>
              <div style={{ fontSize: '11px', color: '#48484a', fontWeight: 700, marginTop: '2px' }}>Tasks Done</div>
            </div>
            <div style={{ backgroundColor: 'rgba(52, 199, 89, 0.05)', borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#34c759' }}>{userStreak.totalNotesCreated}</div>
              <div style={{ fontSize: '11px', color: '#48484a', fontWeight: 700, marginTop: '2px' }}>Notes Logged</div>
            </div>
          </div>
        </div>

        {/* Daily Schedule Agenda */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifySelf: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontWeight: 800, fontSize: '15px', color: '#1c1c1e', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📅 Today's Agenda
            </span>
            <button 
              onClick={() => setActiveView('calendar')}
              style={{ background: 'transparent', border: 'none', color: '#0a7aff', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
              className="btn-animate"
            >
              Open Calendar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', maxHeight: '200px' }}>
            {todayEvents.map(ev => {
              const proj = projects.find(p => p.id === ev.projectId);
              return (
                <div key={ev.id} style={{ display: 'flex', gap: '12px', padding: '10px 12px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.4)', borderLeft: `4px solid ${proj?.color || '#0a7aff'}` }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#1c1c1e', minWidth: '42px' }}>
                    {ev.startTime}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1c1c1e' }}>{ev.title}</div>
                    <div style={{ fontSize: '11px', color: '#8e8e93', marginTop: '2px' }}>{ev.description || 'No description'}</div>
                  </div>
                </div>
              );
            })}
            
            {todayEvents.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px', color: '#8e8e93', fontStyle: 'italic', fontSize: '13px', gap: '8px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                No events scheduled for today
              </div>
            )}
          </div>
        </div>

        {/* Quick Tools & Reminders */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#1c1c1e' }}>💡 Task Summary</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.02)' }}>
              <span style={{ color: '#ff2d55' }}>🔴 To Do Pending</span>
              <span>{kanbanTasks.filter(t => t.status === 'todo').length} Tasks</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.02)' }}>
              <span style={{ color: '#0a7aff' }}>🔵 In Progress</span>
              <span>{kanbanTasks.filter(t => t.status === 'inprogress').length} Tasks</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.02)' }}>
              <span style={{ color: '#34c759' }}>🟢 Completed Tasks</span>
              <span>{kanbanTasks.filter(t => t.status === 'done').length} Tasks</span>
            </div>
          </div>

          <button 
            onClick={() => setActiveView('kanban')}
            style={{
              width: '100%',
              backgroundColor: 'rgba(10, 122, 255, 0.08)',
              border: 'none',
              borderRadius: '12px',
              padding: '10px',
              color: '#0a7aff',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              marginTop: 'auto'
            }}
            className="btn-animate"
          >
            Launch Kanban Board
          </button>
        </div>

      </div>

      {/* Projects Section Grid */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1c1c1e' }}>📂 Active Projects</h2>
          <button 
            onClick={() => setActiveView('projects')}
            style={{ background: 'transparent', border: 'none', color: '#0a7aff', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
            className="btn-animate"
          >
            Manage All Hubs
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {projects.map(proj => {
            const projectNotes = files.filter(f => f.projectId === proj.id);
            const projectTasks = kanbanTasks.filter(t => t.projectId === proj.id);
            const completedTasks = projectTasks.filter(t => t.status === 'done').length;
            const progress = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;

            return (
              <div 
                key={proj.id} 
                className="glass-card glass-card-hover" 
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', cursor: 'pointer' }}
                onClick={() => {
                  setSelectedProjectId(proj.id);
                  setActiveView('projects');
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: proj.color }} />
                  <span style={{ fontSize: '11px', color: '#8e8e93', fontWeight: 700 }}>
                    {projectNotes.length} notes
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1c1c1e', marginBottom: '4px' }}>{proj.name}</h3>
                  <p style={{ fontSize: '12px', color: '#48484a', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '36px', lineHeight: 1.4 }}>
                    {proj.description || 'No description provided.'}
                  </p>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#48484a', marginBottom: '6px' }}>
                    <span>Kanban Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', backgroundColor: proj.color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Quick Create Card */}
          <div 
            style={{ 
              border: '2px dashed rgba(0,0,0,0.1)', 
              backgroundColor: 'rgba(255,255,255,0.25)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '24px', 
              gap: '12px', 
              minHeight: '180px',
              cursor: 'pointer' 
            }}
            onClick={() => setShowAddProjModal(true)}
            className="glass-card btn-animate"
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#8e8e93', fontWeight: 600 }}>+</div>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#48484a' }}>Add New Project</span>
          </div>
        </div>
      </div>

      {/* Recent Notebooks Row */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1c1c1e', marginBottom: '14px' }}>📝 Recent Notebooks</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {files.slice(-4).reverse().map(file => {
            const proj = projects.find(p => p.id === file.projectId);
            return (
              <div 
                key={file.id} 
                className="glass-card glass-card-hover" 
                style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                onClick={() => {
                  setActiveDocument(file.id);
                  setActiveView('canvas');
                }}
              >
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '10px', 
                  backgroundColor: proj ? `${proj.color}15` : 'rgba(0,0,0,0.04)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: proj?.color || '#8e8e93' 
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#1c1c1e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8e8e93', marginTop: '2px', fontWeight: 600 }}>
                    {file.type.toUpperCase()} • {proj ? proj.name : 'Inbox'}
                  </div>
                </div>
              </div>
            );
          })}

          {files.length === 0 && (
            <div style={{ gridColumn: '1/-1', color: '#8e8e93', fontStyle: 'italic', fontSize: '13px', padding: '10px' }}>
              No notes logged. Head over to the Canvas or drag in files to start!
            </div>
          )}
        </div>
      </div>

      {/* Add Project Modal Popup */}
      {showAddProjModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <form 
            onSubmit={handleCreateProject}
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: '#ffffff',
              boxShadow: '0 24px 64px rgba(0,0,0,0.15)'
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#1c1c1e', letterSpacing: '-0.5px' }}>Create New Project</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#48484a' }}>PROJECT NAME</label>
              <input 
                value={newProjName}
                onChange={e => setNewProjName(e.target.value)}
                placeholder="e.g. Molecular Research"
                style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '14px', width: '100%' }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#48484a' }}>DESCRIPTION</label>
              <textarea 
                value={newProjDesc}
                onChange={e => setNewProjDesc(e.target.value)}
                placeholder="Optional description detailing aims..."
                rows={3}
                style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '14px', fontFamily: 'inherit', width: '100%', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#48484a' }}>TAG COLOR</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {colorsOption.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewProjColor(color)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: newProjColor === color ? '2.5px solid #1c1c1e' : 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button"
                onClick={() => setShowAddProjModal(false)}
                style={{ flex: 1, backgroundColor: '#f0f0f5', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: '#48484a' }}
              >
                Cancel
              </button>
              <button 
                type="submit"
                style={{ flex: 2, background: 'linear-gradient(135deg, #0a7aff, #0062d6)', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
              >
                Create Hub
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
};

export default HomeDashboard;
