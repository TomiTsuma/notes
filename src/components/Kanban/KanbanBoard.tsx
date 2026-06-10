import React, { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent, useDroppable, useDraggable } from '@dnd-kit/core';
import { useAppStore } from '../../store/appStore';
import type { KanbanTask } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';
import TaskDetailModal from './TaskDetailModal';
import './KanbanBoard.css';

const columns: { id: KanbanTask['status']; label: string; color: string; bg: string }[] = [
  { id: 'todo', label: 'Not Started', color: '#8e8e93', bg: 'rgba(142, 142, 147, 0.12)' },
  { id: 'inprogress', label: 'Pending', color: '#ff2d55', bg: 'rgba(255, 45, 85, 0.1)' },
  { id: 'done', label: 'Completed', color: '#34c759', bg: 'rgba(52, 199, 89, 0.1)' },
  { id: 'review', label: 'Under Review', color: '#af52de', bg: 'rgba(175, 82, 222, 0.1)' },
];

const priorityLabel = (p: KanbanTask['priority']) => {
  if (p === 'high') return { text: 'Urgent', color: '#ff2d55', bg: 'rgba(255,45,85,0.1)' };
  if (p === 'medium') return { text: 'Medium', color: '#af52de', bg: 'rgba(175,82,222,0.1)' };
  return { text: 'Low', color: '#34c759', bg: 'rgba(52,199,89,0.1)' };
};

const TaskCard: React.FC<{ task: KanbanTask; onClick: () => void; isDragging?: boolean }> = ({ task, onClick, isDragging }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const pri = priorityLabel(task.priority);
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`kanban-task-card ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="kanban-task-id">🔗 WEB-{task.id.slice(-4).toUpperCase()}</span>
        <span className="kanban-priority-badge" style={{ color: pri.color, background: pri.bg }}>{pri.text}</span>
      </div>
      <div className="kanban-task-title">{task.title}</div>
      {task.description && <div className="kanban-task-sub">{task.description.slice(0, 60)}{task.description.length > 60 ? '…' : ''}</div>}
      <div className="kanban-task-footer">
        <span>{task.dueDate ? `📅 Due: ${task.dueDate}` : ''}</span>
        <span>💬 0</span>
      </div>
    </div>
  );
};

const KanbanColumn: React.FC<{
  col: typeof columns[0];
  tasks: KanbanTask[];
  onAdd: () => void;
  onTaskClick: (t: KanbanTask) => void;
  activeId: string | null;
}> = ({ col, tasks, onAdd, onTaskClick, activeId }) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div ref={setNodeRef} className={`kanban-column ${isOver ? 'drag-over' : ''}`}>
      <div className="kanban-column-header">
        <span className="kanban-column-title">{col.label}</span>
        <span className="kanban-count-pill" style={{ color: col.color, background: col.bg }}>{tasks.length}</span>
      </div>
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} isDragging={activeId === task.id} />
      ))}
      <button className="kanban-add-btn" onClick={onAdd}>+ New Page</button>
    </div>
  );
};

const KanbanBoard: React.FC = () => {
  const {
    projects, kanbanTasks, addKanbanTask, updateKanbanTask, deleteKanbanTask,
    selectedProjectId, setSelectedProjectId,
  } = useAppStore();

  const [activeProjId, setActiveProjId] = useState(selectedProjectId || projects[0]?.id || '');
  const [showAddCol, setShowAddCol] = useState<KanbanTask['status'] | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<KanbanTask['priority']>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [detailTask, setDetailTask] = useState<KanbanTask | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const currentProj = projects.find(p => p.id === activeProjId);
  const projectTasks = kanbanTasks.filter(t => t.projectId === currentProj?.id);
  const activeTask = activeId ? projectTasks.find(t => t.id === activeId) : null;

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
      createdAt: new Date().toISOString(),
    });
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('medium');
    setTaskDueDate('');
    setShowAddCol(null);
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const taskId = String(e.active.id);
    const overId = e.over?.id as KanbanTask['status'] | undefined;
    if (overId && columns.some(c => c.id === overId)) {
      updateKanbanTask(taskId, { status: overId });
    }
  };

  return (
    <div className="workspace-view-container">
      <div className="kanban-page">
        <div className="kanban-header">
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900 }}>Welcome Back!</h1>
            <p style={{ fontSize: 13, color: '#8e8e93', marginTop: 4 }}>Track and manage your research tasks.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {projects.length > 0 && (
              <div className="kanban-project-tabs">
                {projects.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => { setActiveProjId(proj.id); setSelectedProjectId(proj.id); }}
                    style={{
                      border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      background: activeProjId === proj.id ? proj.color : 'transparent',
                      color: activeProjId === proj.id ? '#fff' : '#48484a',
                    }}
                  >{proj.name}</button>
                ))}
              </div>
            )}
            <button className="kanban-create-btn" onClick={() => setShowAddCol('todo')}>+ Create Task</button>
          </div>
        </div>

        {currentProj ? (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="kanban-board">
              {columns.map(col => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  tasks={projectTasks.filter(t => t.status === col.id)}
                  onAdd={() => setShowAddCol(col.id)}
                  onTaskClick={setDetailTask}
                  activeId={activeId}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask ? <TaskCard task={activeTask} onClick={() => {}} isDragging /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <p style={{ textAlign: 'center', color: '#8e8e93', padding: 40 }}>Create a project to use the Kanban board.</p>
        )}
      </div>

      {showAddCol && (
        <div className="event-modal-overlay" onClick={() => setShowAddCol(null)}>
          <form className="event-modal-form glass-card" onClick={e => e.stopPropagation()} onSubmit={e => handleAddTask(e, showAddCol)}>
            <h3 style={{ fontSize: 18, fontWeight: 900 }}>New Task</h3>
            <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Task title" required
              style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }} />
            <textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Description" rows={3}
              style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontFamily: 'inherit' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <select value={taskPriority} onChange={e => setTaskPriority(e.target.value as KanbanTask['priority'])}
                style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)}
                style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowAddCol(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#f0f0f5', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#1c1c1e', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Add Task</button>
            </div>
          </form>
        </div>
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          projectName={currentProj?.name}
          onClose={() => setDetailTask(null)}
          onUpdate={u => updateKanbanTask(detailTask.id, u)}
          onDelete={() => { deleteKanbanTask(detailTask.id); setDetailTask(null); }}
        />
      )}
    </div>
  );
};

export default KanbanBoard;
