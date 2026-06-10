import React, { useState } from 'react';
import type { KanbanTask } from '../../store/appStore';

interface Props {
  task: KanbanTask;
  projectName?: string;
  onClose: () => void;
  onUpdate: (updated: Partial<KanbanTask>) => void;
  onDelete: () => void;
}

const TaskDetailModal: React.FC<Props> = ({ task, projectName, onClose, onUpdate, onDelete }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [status, setStatus] = useState(task.status);

  const handleSave = () => {
    onUpdate({ title, description, priority, dueDate: dueDate || undefined, status });
    onClose();
  };

  return (
    <div className="event-modal-overlay" onClick={onClose}>
      <div className="event-modal-form glass-card" onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 900 }}>Task Details</h3>
        <p style={{ fontSize: 11, color: '#8e8e93', fontWeight: 700 }}>ID: {task.id}</p>

        <label style={{ fontSize: 11, fontWeight: 800 }}>TITLE</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 13 }} />

        <label style={{ fontSize: 11, fontWeight: 800 }}>DESCRIPTION</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
          style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 800 }}>PRIORITY</label>
            <select value={priority} onChange={e => setPriority(e.target.value as KanbanTask['priority'])}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 800 }}>STATUS</label>
            <select value={status} onChange={e => setStatus(e.target.value as KanbanTask['status'])}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}>
              <option value="todo">Not Started</option>
              <option value="inprogress">Pending</option>
              <option value="done">Completed</option>
              <option value="review">Under Review</option>
            </select>
          </div>
        </div>

        <label style={{ fontSize: 11, fontWeight: 800 }}>DUE DATE</label>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 13 }} />

        {projectName && (
          <p style={{ fontSize: 12, color: '#48484a' }}>Project: <strong>{projectName}</strong></p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={() => { if (confirm('Delete this task?')) onDelete(); }}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'rgba(255,45,85,0.1)', color: '#ff2d55', fontWeight: 800, cursor: 'pointer' }}>Delete</button>
          <button onClick={onClose}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#f0f0f5', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave}
            style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#1c1c1e', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
