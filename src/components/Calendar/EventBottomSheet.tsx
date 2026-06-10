import React, { useMemo } from 'react';
import type { ScheduleItem } from './calendarTypes';
import { formatTime12, timeToMinutes } from '../../utils/calendarUtils';

interface Props {
  item: ScheduleItem | null;
  projects: { id: string; name: string; color: string }[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}

const EventBottomSheet: React.FC<Props> = ({ item, projects, onClose, onEdit, onDelete, onToggleComplete }) => {
  const remaining = useMemo(() => {
    if (!item) return '';
    const now = new Date();
    const endMins = timeToMinutes(item.endTime);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const diff = endMins - nowMins;
    if (diff <= 0) return 'Ended';
    if (diff < 60) return `${diff}m remaining`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m remaining`;
  }, [item]);

  if (!item) return null;

  const proj = projects.find(p => p.id === item.projectId);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 199 }} onClick={onClose} />
      <div className={`event-bottom-sheet open`}>
        <div className="event-bottom-sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 12, color: '#8e8e93', fontWeight: 700 }}>
              {formatTime12(item.startTime)} – {formatTime12(item.endTime)}
            </p>
            <p style={{ fontSize: 11, color: item.source === 'task' ? '#ff9500' : '#8e8e93', fontWeight: 800, marginTop: 4 }}>
              {remaining}{item.source === 'task' ? ' · Task' : ''}
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 900, marginTop: 8 }}>{item.title}</h2>
            {item.description && (
              <p style={{ fontSize: 13, color: '#48484a', marginTop: 8 }}>{item.description}</p>
            )}
            {proj && (
              <span style={{ display: 'inline-block', marginTop: 10, padding: '4px 10px', borderRadius: 8, background: proj.color, color: 'white', fontSize: 11, fontWeight: 800 }}>
                {proj.name}
              </span>
            )}
          </div>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: `4px solid ${item.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={onToggleComplete} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: item.completed ? item.color : 'transparent', color: item.completed ? 'white' : '#8e8e93', cursor: 'pointer', fontSize: 18 }}>
              {item.completed ? '✓' : '○'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {item.source === 'event' && (
            <button onClick={onEdit} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#f0f0f5', fontWeight: 800, cursor: 'pointer' }}>Edit</button>
          )}
          {item.source === 'event' && (
            <button onClick={onDelete} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: 'rgba(255,45,85,0.1)', color: '#ff2d55', fontWeight: 800, cursor: 'pointer' }}>Delete</button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#1c1c1e', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </>
  );
};

export default EventBottomSheet;
