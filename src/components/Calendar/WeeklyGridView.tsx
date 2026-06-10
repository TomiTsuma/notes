import React, { useMemo } from 'react';
import type { ScheduleItem } from './calendarTypes';
import { getWeekDates, formatDateStr, parseDateStr, timeToMinutes, formatTime12 } from '../../utils/calendarUtils';

const START_HOUR = 6;
const END_HOUR = 18;
const SLOT_HEIGHT = 48;

interface Props {
  selectedDate: string;
  items: ScheduleItem[];
  onSelect: (item: ScheduleItem) => void;
  onDayClick: (date: string) => void;
}

const WeeklyGridView: React.FC<Props> = ({ selectedDate, items, onSelect, onDayClick }) => {
  const weekDates = getWeekDates(parseDateStr(selectedDate));
  const todayStr = formatDateStr(new Date());
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const totalHeight = hours.length * SLOT_HEIGHT;

  const nowLineTop = useMemo(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    return ((mins - START_HOUR * 60) / 60) * SLOT_HEIGHT;
  }, []);

  const isThisWeek = weekDates.some(d => formatDateStr(d) === todayStr);

  return (
    <div className="weekly-grid glass-card" style={{ padding: 16, background: 'rgba(255,255,255,0.45)', flex: 1, minHeight: 400 }}>
      <div className="weekly-grid-header">
        <div />
        {weekDates.map(d => {
          const ds = formatDateStr(d);
          const isToday = ds === todayStr;
          return (
            <button
              key={ds}
              className={`weekly-day-header ${isToday ? 'today' : ''}`}
              onClick={() => onDayClick(ds)}
              style={{ border: 'none', cursor: 'pointer' }}
            >
              {d.getDate()} – {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d.getDay() === 0 ? 6 : d.getDay() - 1]}
            </button>
          );
        })}
      </div>
      <div className="weekly-grid-body" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <div>
          {hours.map(h => (
            <div key={h} className="weekly-time-label" style={{ height: SLOT_HEIGHT }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {weekDates.map(d => {
          const ds = formatDateStr(d);
          const dayItems = items.filter(it => it.date === ds);
          return (
            <div key={ds} className="weekly-day-col" style={{ height: totalHeight }}>
              {dayItems.map(item => {
                const top = ((timeToMinutes(item.startTime) - START_HOUR * 60) / 60) * SLOT_HEIGHT;
                const height = Math.max(((timeToMinutes(item.endTime) - timeToMinutes(item.startTime)) / 60) * SLOT_HEIGHT, 28);
                return (
                  <div
                    key={item.id}
                    className="weekly-event-card"
                    style={{ top, height, backgroundColor: item.color }}
                    onClick={() => onSelect(item)}
                  >
                    <div>{item.title}</div>
                    <div className="event-time">{formatTime12(item.startTime)} – {formatTime12(item.endTime)}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {isThisWeek && nowLineTop > 0 && nowLineTop < totalHeight && (
          <div
            className="weekly-now-line"
            style={{ top: nowLineTop + 40 }}
            data-time={new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          />
        )}
      </div>
    </div>
  );
};

export default WeeklyGridView;
