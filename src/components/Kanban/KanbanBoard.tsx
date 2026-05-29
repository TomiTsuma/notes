import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { KanbanTask } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';

const KanbanBoard: React.FC = () => {
  const { 
    projects, 
    kanbanTasks, 
    addKanbanTask, 
    updateKanbanTask, 
    deleteKanbanTask,
    selectedProjectId,
    setSelectedProjectId
  } = useAppStore();

  const [activeProjId, setActiveProjId] = useState<string>(selectedProjectId || projects[0]?.id || '');
  const [showAddTaskForm, setShowAddTaskForm] = useState<string | null>(null); // column status
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');

  const currentProj = projects.find(p => p.id === activeProjId) || projects[0] || null;

  // Filter tasks for the active project
  const projectTasks = kanbanTasks.filter(t => t.projectId === currentProj?.id);

  const columns: { id: KanbanTask['status']; label: string; color: string; bg: string }[] = [
    { id: 'todo', label: 'To Do', color: '#ff2d55', bg: 'rgba(255, 45, 85, 0.08)' },
    { id: 'inprogress', label: 'In Progress', color: '#0a7aff', bg: 'rgba(10, 122, 255, 0.08)' },
    { id: 'review', label: 'In Review', color: '#ff9500', bg: 'rgba(255, 149, 0, 0.08)' },
    { id: 'done', label: 'Done', color: '#34c759', bg: 'rgba(52, 199, 89, 0.08)' }
  ];

  const handleAddTask = (e: React.FormEvent, status: KanbanTask['status']) => {
    e.preventDefault();
    if (!taskTitle.trim() || !currentProj) return;

    addKanbanTask({
      id: `task-${uuidv4().substring(0, 8)}`,
      projectId: currentProj.id,
      title: taskTitle,
      description: taskDesc,
      status,
      priority: taskPriority,
      dueDate: taskDueDate || undefined,
      createdAt: new Date().toISOString()
    });

    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('medium');
    setTaskDueDate('');
    setShowAddTaskForm(null);
  };

  const handleMoveTask = (taskId: string, direction: 'prev' | 'next', currentStatus: KanbanTask['status']) => {
    const statusOrder: KanbanTask['status'][] = ['todo', 'inprogress', 'review', 'done'];
    const idx = statusOrder.indexOf(currentStatus);
    let nextIdx = idx;
    
    if (direction === 'prev' && idx > 0) nextIdx = idx - 1;
    if (direction === 'next' && idx < statusOrder.length - 1) nextIdx = idx + 1;

    if (nextIdx !== idx) {
      updateKanbanTask(taskId, { status: statusOrder[nextIdx] });
    }
  };

  const getPriorityColor = (p: KanbanTask['priority']) => {
    switch (p) {
      case 'high': return '#ff2d55';
      case 'medium': return '#ff9500';
      case 'low':
      default: return '#34c759';
    }
  };

  return (
    <div className="workspace-view-container" style={{ gap: '24px', width: '100%' }}>
      
      {/* Top Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#1c1c1e', letterSpacing: '-0.5px' }}>Kanban Task Board</h1>
          <p style={{ fontSize: '13px', color: '#8e8e93', fontWeight: 600, marginTop: '2px' }}>
            Organize tasks, map dependencies, and track completion states.
          </p>
        </div>

        {/* Project Selector Tab row */}
        {projects.length > 0 && (
          <div className="glass-card" style={{ display: 'flex', padding: '6px', gap: '4px', overflowX: 'auto', maxWidth: '100%' }}>
            {projects.map(proj => {
              const active = activeProjId === proj.id;
              return (
                <button
                  key={proj.id}
                  onClick={() => {
                    setActiveProjId(proj.id);
                    setSelectedProjectId(proj.id);
                  }}
                  style={{
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: active ? '#fff' : '#48484a',
                    background: active ? proj.color : 'transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: active ? `0 2px 8px ${proj.color}40` : 'none',
                    transition: 'all 0.25s'
                  }}
                  className="btn-animate"
                >
                  {proj.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {currentProj ? (
        /* Board Columns Grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          alignItems: 'start',
          flex: 1
        }}>
          {columns.map(col => {
            const colTasks = projectTasks.filter(t => t.status === col.id);
            const isAdding = showAddTaskForm === col.id;

            return (
              <div 
                key={col.id} 
                className="glass-card" 
                style={{ 
                  padding: '16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.4)'
                }}
              >
                
                {/* Column Title Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color }} />
                    <span style={{ fontWeight: 800, fontSize: '14px', color: '#1c1c1e' }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: col.color, backgroundColor: col.bg, padding: '3px 8px', borderRadius: '8px' }}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Create Quick Task Form */}
                {isAdding ? (
                  <form 
                    onSubmit={(e) => handleAddTask(e, col.id)}
                    className="glass-card"
                    style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}
                  >
                    <input
                      value={taskTitle}
                      onChange={e => setTaskTitle(e.target.value)}
                      placeholder="Task title..."
                      required
                      autoFocus
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '12px', width: '100%' }}
                    />
                    <textarea
                      value={taskDesc}
                      onChange={e => setTaskDesc(e.target.value)}
                      placeholder="Details..."
                      rows={2}
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '11px', width: '100%', resize: 'none', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
                      <select
                        value={taskPriority}
                        onChange={e => setTaskPriority(e.target.value as any)}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '11px', background: '#fff' }}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <input
                        type="date"
                        value={taskDueDate}
                        onChange={e => setTaskDueDate(e.target.value)}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '11px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end', marginTop: '4px' }}>
                      <button type="button" onClick={() => setShowAddTaskForm(null)} style={{ border: 'none', background: '#f0f0f5', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button type="submit" style={{ border: 'none', background: currentProj.color, color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                        Add
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowAddTaskForm(col.id)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '10px',
                      border: '1.5px dashed rgba(0,0,0,0.08)',
                      background: 'rgba(255,255,255,0.2)',
                      color: col.color,
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    className="btn-animate"
                  >
                    <span>+ New Task</span>
                  </button>
                )}

                {/* Column Cards Container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '56vh', padding: '2px' }}>
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      className="glass-card"
                      style={{
                        padding: '14px',
                        background: '#ffffff',
                        border: '1px solid rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ 
                          fontSize: '9px', 
                          fontWeight: 800, 
                          color: getPriorityColor(task.priority), 
                          backgroundColor: `${getPriorityColor(task.priority)}12`, 
                          padding: '2px 6px', 
                          borderRadius: '6px',
                          textTransform: 'uppercase' 
                        }}>
                          {task.priority}
                        </span>
                        
                        <button
                          onClick={() => {
                            if (confirm(`Delete task '${task.title}'?`)) deleteKanbanTask(task.id);
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#8e8e93', fontSize: '14px', cursor: 'pointer', padding: 0 }}
                          title="Delete task"
                        >
                          ×
                        </button>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#1c1c1e', marginBottom: '4px' }}>{task.title}</h4>
                        {task.description && (
                          <p style={{ fontSize: '11px', color: '#48484a', lineHeight: 1.4 }}>{task.description}</p>
                        )}
                      </div>

                      {/* Footer: Due date badge & arrow navigators */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 600 }}>
                          {task.dueDate ? `📅 ${task.dueDate}` : ''}
                        </span>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          {col.id !== 'todo' && (
                            <button
                              onClick={() => handleMoveTask(task.id, 'prev', task.status)}
                              style={{ width: '22px', height: '22px', border: 'none', borderRadius: '6px', background: 'rgba(0,0,0,0.03)', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              title="Move back"
                            >
                              ◀
                            </button>
                          )}
                          {col.id !== 'done' && (
                            <button
                              onClick={() => handleMoveTask(task.id, 'next', task.status)}
                              style={{ width: '22px', height: '22px', border: 'none', borderRadius: '6px', background: 'rgba(0,0,0,0.03)', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              title="Move forward"
                            >
                              ▶
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '40px', display: 'flex', justifyContent: 'center', color: '#8e8e93', fontStyle: 'italic' }}>
          No projects found. Please create a project to load Kanban boards.
        </div>
      )}

    </div>
  );
};

export default KanbanBoard;
