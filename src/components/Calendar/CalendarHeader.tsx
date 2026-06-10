import React from 'react';
import type { CalendarViewMode } from '../../store/appStore';
import { monthNames, dayNamesShort, getWeekDates, formatDateStr, parseDateStr } from '../../utils/calendarUtils';

interface Props {
  viewMode: CalendarViewMode;
  selectedDate: string;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onDateSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

const CalendarHeader: React.FC<Props> = ({ viewMode, selectedDate, onViewModeChange, onDateSelect, onPrev, onNext }) => {
  const anchor = parseDateStr(selectedDate);
  const weekDates = getWeekDates(anchor);
  const todayStr = formatDateStr(new Date());

  const title = viewMode === 'month'
    ? `${monthNames[anchor.getMonth()]} ${anchor.getFullYear()}`
    : viewMode === 'week'
      ? `${formatDateStr(weekDates[0]).slice(5).replace('-', '/')} – ${formatDateStr(weekDates[6]).slice(5).replace('-', '/')} ${anchor.getFullYear()}`
      : anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="calendar-header">
      <div className="calendar-header-top">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>{title}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="calendar-view-toggle">
            {(['day', 'week', 'month'] as CalendarViewMode[]).map(mode => (
              <button key={mode} className={viewMode === mode ? 'active' : ''} onClick={() => onViewModeChange(mode)}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={onPrev} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#0a7aff', fontWeight: 800 }}>◀</button>
          <button onClick={onNext} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#0a7aff', fontWeight: 800 }}>▶</button>
        </div>
      </div>

      <div className="calendar-date-strip">
        {weekDates.map((d, i) => {
          const ds = formatDateStr(d);
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDate;
          return (
            <button
              key={ds}
              className={`calendar-date-chip ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => onDateSelect(ds)}
            >
              <span className="day-name">{dayNamesShort[i]}</span>
              <span className="day-num">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarHeader;
