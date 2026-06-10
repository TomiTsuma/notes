import React, { useMemo } from 'react';
import type { ScheduleItem } from './calendarTypes';
import { timeToMinutes, formatTime12 } from '../../utils/calendarUtils';

const START_HOUR = 6;
const END_HOUR = 22;
const PX_PER_MIN = 1.2;

interface Props {
  date: string;
  items: ScheduleItem[];
  onSelect: (item: ScheduleItem) => void;
  onToggleComplete: (item: ScheduleItem) => void;
}

const DailyTimelineView: React.FC<Props> = ({ items, onSelect, onToggleComplete }) => {
  const dayItems = useMemo(() =>
    items.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [items]
  );

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const totalHeight = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN;

  return (
    <div className="daily-timeline glass-card" style={{ padding: '16px 0', background: 'rgba(255,255,255,0.4)' }}>
      <div className="daily-timeline-rail" style={{ height: totalHeight }}>
        {hours.map(h => (
          <div key={h} className="daily-timeline-slot-label" style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }}>
            {h}:00
          </div>
        ))}
      </div>
      <div className="daily-timeline-body" style={{ height: totalHeight }}>
        {dayItems.map(item => {
          const top = (timeToMinutes(item.startTime) - START_HOUR * 60) * PX_PER_MIN;
          const height = Math.max((timeToMinutes(item.endTime) - timeToMinutes(item.startTime)) * PX_PER_MIN, 36);
          return (
            <div
              key={item.id}
              className="daily-event-pill"
              style={{ top, height, backgroundColor: item.color }}
              onClick={() => onSelect(item)}
            >
              <div className="pill-icon">{item.source === 'task' ? '✓' : '◷'}</div>
              <div className="pill-info">
                <div className="pill-time">{formatTime12(item.startTime)} · {Math.round((timeToMinutes(item.endTime) - timeToMinutes(item.startTime)))}m</div>
                <div className="pill-title">{item.title}</div>
              </div>
              <button
                className={`daily-event-check ${item.completed ? 'done' : ''}`}
                style={{ top: '50%', transform: 'translateY(-50%)' }}
                onClick={e => { e.stopPropagation(); onToggleComplete(item); }}
              >
                {item.completed ? '✓' : ''}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyTimelineView;
