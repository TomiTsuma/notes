import React, { useState, useEffect } from 'react';
import type { CalendarEvent } from '../../store/appStore';
import { EVENT_COLORS } from '../../utils/calendarUtils';

interface Props {
  date: string;
  projects: { id: string; name: string }[];
  editEvent?: CalendarEvent | null;
  onSubmit: (data: Omit<CalendarEvent, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

const EventFormModal: React.FC<Props> = ({ date, projects, editEvent, onSubmit, onClose }) => {
  const [title, setTitle] = useState(editEvent?.title || '');
  const [description, setDescription] = useState(editEvent?.description || '');
  const [startTime, setStartTime] = useState(editEvent?.startTime || '09:00');
  const [endTime, setEndTime] = useState(editEvent?.endTime || '10:00');
  const [projectId, setProjectId] = useState(editEvent?.projectId || '');
  const [color, setColor] = useState(editEvent?.color || EVENT_COLORS[0]);

  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title);
      setDescription(editEvent.description);
      setStartTime(editEvent.startTime);
      setEndTime(editEvent.endTime);
      setProjectId(editEvent.projectId || '');
      setColor(editEvent.color || EVENT_COLORS[0]);
    }
  }, [editEvent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description,
      date: editEvent?.date || date,
      startTime,
      endTime,
      projectId: projectId || null,
      color,
      completed: editEvent?.completed ?? false,
    });
  };

  return (
    <div className="event-modal-overlay" onClick={onClose}>
      <form className="event-modal-form glass-card" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 style={{ fontSize: '18px', fontWeight: 900 }}>{editEvent ? 'Edit Event' : 'Schedule Event'}</h3>
        <p style={{ fontSize: '12px', color: '#8e8e93', marginTop: -8, fontWeight: 600 }}>DATE: {editEvent?.date || date}</p>

        <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>TITLE</label>
        <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Event title"
          style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }} />

        <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>DESCRIPTION</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Details..."
          style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>START</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>END</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }} />
          </div>
        </div>

        <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>PROJECT</label>
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }}>
          <option value="">None</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>COLOR</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {EVENT_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: color === c ? '3px solid #1c1c1e' : '2px solid transparent', cursor: 'pointer' }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, background: '#f0f0f5', border: 'none', padding: 10, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button type="submit"
            style={{ flex: 2, background: 'linear-gradient(135deg, #0a7aff, #0062d6)', color: 'white', border: 'none', padding: 10, borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}>
            {editEvent ? 'Save' : 'Schedule'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventFormModal;
