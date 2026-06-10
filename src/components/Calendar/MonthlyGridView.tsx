import React, { useMemo } from 'react';
import type { ScheduleItem } from './calendarTypes';
import { parseDateStr, formatDateStr } from '../../utils/calendarUtils';

interface Props {
  selectedDate: string;
  items: ScheduleItem[];
  onDayClick: (date: string) => void;
  onSelect: (item: ScheduleItem) => void;
}

const MonthlyGridView: React.FC<Props> = ({ selectedDate, items, onDayClick, onSelect }) => {
  const anchor = parseDateStr(selectedDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startDayIdx = new Date(year, month, 1).getDay();
  const todayStr = formatDateStr(new Date());

  const cells = useMemo(() => {
    const result: React.ReactNode[] = [];
    for (let i = 0; i < startDayIdx; i++) {
      result.push(<div key={`pad-${i}`} style={{ minHeight: 90, opacity: 0.3 }} />);
    }
    for (let day = 1; day <= totalDays; day++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayItems = items.filter(it => it.date === ds);
      const isToday = ds === todayStr;
      result.push(
        <div
          key={ds}
          className={`monthly-day-cell ${isToday ? 'today' : ''}`}
          onClick={() => onDayClick(ds)}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? '#0a7aff' : '#48484a', marginBottom: 6 }}>{day}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
            {dayItems.slice(0, 3).map(it => (
              <div
                key={it.id}
                className="monthly-event-dot"
                style={{ backgroundColor: `${it.color}99`, color: '#1c1c1e' }}
                onClick={e => { e.stopPropagation(); onSelect(it); }}
              >
                {it.startTime} {it.title}
              </div>
            ))}
            {dayItems.length > 3 && (
              <span style={{ fontSize: 9, color: '#8e8e93', fontWeight: 700 }}>+{dayItems.length - 3} more</span>
            )}
          </div>
        </div>
      );
    }
    return result;
  }, [year, month, totalDays, startDayIdx, items, todayStr, onDayClick, onSelect]);

  return (
    <div className="glass-card" style={{ padding: 12, background: 'rgba(255,255,255,0.35)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: 6, marginBottom: 8 }}>
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
          <div key={d} style={{ fontSize: 11, fontWeight: 800, color: '#8e8e93' }}>{d}</div>
        ))}
      </div>
      <div className="monthly-grid">{cells}</div>
    </div>
  );
};

export default MonthlyGridView;
