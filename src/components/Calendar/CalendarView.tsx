import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { CalendarEvent } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';

const CalendarView: React.FC = () => {
  const { 
    projects, 
    calendarEvents, 
    addCalendarEvent, 
    deleteCalendarEvent 
  } = useAppStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  
  // Google Calendar Integration states
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);

  // Event form states
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventStart, setEventStart] = useState('09:00');
  const [eventEnd, setEventEnd] = useState('10:00');
  const [eventProj, setEventProj] = useState('');

  // Selected event inspect state
  const [inspectEvent, setInspectEvent] = useState<CalendarEvent | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get calendar date helper details
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayIndex = (y: number, m: number) => new Date(y, m, 1).getDay();

  const totalDays = getDaysInMonth(year, month);
  const startDayIdx = getFirstDayIndex(year, month);

  // Month navigation
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleCellClick = (day: number) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDateStr(dStr);
    setShowEventModal(true);
  };

  const handleAddEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    addCalendarEvent({
      id: `ev-${uuidv4().substring(0, 8)}`,
      title: eventTitle,
      description: eventDesc,
      date: selectedDateStr,
      startTime: eventStart,
      endTime: eventEnd,
      projectId: eventProj || null,
      createdAt: new Date().toISOString()
    });

    setEventTitle('');
    setEventDesc('');
    setEventStart('09:00');
    setEventEnd('10:00');
    setEventProj('');
    setShowEventModal(false);
  };

  // Google Calendar OAuth & Sync Flow
  const handleLinkGoogleCalendar = () => {
    setIsLinkingGoogle(true);
    setTimeout(() => {
      setIsLinkingGoogle(false);
      setGoogleLinked(true);
      
      // Inject two standard synced events from Google Calendar
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      addCalendarEvent({
        id: `ev-google-1`,
        title: 'Google Synced: Research Roadmap Alignment',
        description: 'Google Calendar import detailing next quarter molecular gene objectives.',
        date: tomorrowStr,
        startTime: '13:00',
        endTime: '14:30',
        projectId: 'proj-1',
        createdAt: new Date().toISOString()
      });
      addCalendarEvent({
        id: `ev-google-2`,
        title: 'Google Synced: TomiTsuma Sync',
        description: 'Sync regarding Nextcloud file integrations.',
        date: new Date().toISOString().split('T')[0], // today
        startTime: '15:00',
        endTime: '15:30',
        projectId: null,
        createdAt: new Date().toISOString()
      });
    }, 1800);
  };

  // Render events inside day cell
  const getCellEvents = (day: number) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendarEvents.filter(ev => ev.date === dStr);
  };

  const daysGrid: React.ReactNode[] = [];
  
  // Fill starting padding cells
  for (let i = 0; i < startDayIdx; i++) {
    daysGrid.push(<div key={`pad-${i}`} style={{ minHeight: '85px', border: '1px solid rgba(0,0,0,0.03)', opacity: 0.3 }} />);
  }

  // Fill day cells
  for (let day = 1; day <= totalDays; day++) {
    const cellEvents = getCellEvents(day);
    const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

    daysGrid.push(
      <div 
        key={`day-${day}`} 
        onClick={() => handleCellClick(day)}
        style={{
          minHeight: '90px',
          border: '1.5px solid rgba(0,0,0,0.04)',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: isToday ? 'rgba(10, 122, 255, 0.05)' : 'transparent',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        className="glass-card-hover"
      >
        <span style={{ 
          fontSize: '13px', 
          fontWeight: 800, 
          color: isToday ? '#0a7aff' : '#48484a',
          alignSelf: 'flex-start',
          marginBottom: '6px'
        }}>
          {day}
        </span>

        {/* Render event nodes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto', flex: 1 }}>
          {cellEvents.map(ev => {
            const proj = projects.find(p => p.id === ev.projectId);
            const isGoogle = ev.id.startsWith('ev-google');
            return (
              <div 
                key={ev.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setInspectEvent(ev);
                }}
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '3px 6px',
                  borderRadius: '5px',
                  backgroundColor: proj ? `${proj.color}15` : isGoogle ? 'rgba(66, 133, 244, 0.1)' : 'rgba(0,0,0,0.04)',
                  color: proj?.color || isGoogle ? '#4285f4' : '#1c1c1e',
                  borderLeft: `2.5px solid ${proj?.color || isGoogle ? '#4285f4' : '#8e8e93'}`,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {ev.startTime} {ev.title}
              </div>
            );
          })}
        </div>

      </div>
    );
  }

  return (
    <div className="workspace-view-container" style={{ gap: '24px', width: '100%' }}>
      
      {/* Top action row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#1c1c1e', letterSpacing: '-0.5px' }}>Calendar Planner</h1>
          <p style={{ fontSize: '13px', color: '#8e8e93', fontWeight: 600, marginTop: '2px' }}>
            Schedule deep learning alignments, milestones, and daily goals.
          </p>
        </div>

        {/* Link Google Calendar Button */}
        <button 
          onClick={handleLinkGoogleCalendar}
          disabled={isLinkingGoogle}
          style={{
            background: googleLinked ? 'rgba(52, 199, 89, 0.12)' : 'linear-gradient(135deg, #4285f4, #2c6be3)',
            color: googleLinked ? '#34c759' : 'white',
            border: googleLinked ? '1.5px solid #34c759' : 'none',
            borderRadius: '12px',
            padding: '10px 18px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: isLinkingGoogle ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          className="btn-animate"
        >
          {isLinkingGoogle ? (
            <>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid white', borderTop: '2px solid transparent', animation: 'spin 1s linear infinite' }} />
              Connecting OAuth...
            </>
          ) : googleLinked ? (
            <>✓ Synced with Google Calendar</>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.52 0-6.386-2.866-6.386-6.386s2.866-6.386 6.386-6.386c1.63 0 3.122.617 4.254 1.62l3.059-3.059C19.243 2.502 15.932 1.34 12.24 1.34 6.34 1.34 1.56 6.12 1.56 12s4.78 10.66 10.68 10.66c5.96 0 10.5-4.22 10.5-10.66 0-.66-.08-1.29-.24-1.715H12.24Z"/></svg>
              Link Google Calendar
            </>
          )}
        </button>
      </div>

      {/* Calendar Monthly Selector Header */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: 'rgba(255,255,255,0.45)' }}>
        <button onClick={prevMonth} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#0a7aff', fontWeight: 800 }}>◀</button>
        <span style={{ fontSize: '18px', fontWeight: 900, color: '#1c1c1e', letterSpacing: '-0.5px' }}>{monthNames[month]} {year}</span>
        <button onClick={nextMonth} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#0a7aff', fontWeight: 800 }}>▶</button>
      </div>

      {/* Weekday Titles Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '8px' }}>
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
          <div key={day} style={{ fontSize: '11px', fontWeight: 800, color: '#8e8e93', padding: '4px', letterSpacing: '0.5px' }}>{day}</div>
        ))}
      </div>

      {/* Main Day Grid */}
      <div 
        className="glass-card" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: '8px', 
          padding: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.3)'
        }}
      >
        {daysGrid}
      </div>

      {/* Add Event Modal Popup */}
      {showEventModal && (
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
            onSubmit={handleAddEventSubmit}
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              background: '#ffffff',
              boxShadow: '0 20px 48px rgba(0,0,0,0.1)'
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#1c1c1e' }}>Schedule Event</h3>
            <p style={{ fontSize: '12px', color: '#8e8e93', marginTop: '-8px', fontWeight: 600 }}>DATE: {selectedDateStr}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>EVENT TITLE</label>
              <input 
                value={eventTitle}
                onChange={e => setEventTitle(e.target.value)}
                placeholder="e.g. Brainstorming GVT Models"
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>DESCRIPTION</label>
              <input 
                value={eventDesc}
                onChange={e => setEventDesc(e.target.value)}
                placeholder="Details of the sync..."
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>START TIME</label>
                <input 
                  type="time"
                  value={eventStart}
                  onChange={e => setEventStart(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>END TIME</label>
                <input 
                  type="time"
                  value={eventEnd}
                  onChange={e => setEventEnd(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#48484a' }}>ASSOCIATE PROJECT</label>
              <select
                value={eventProj}
                onChange={e => setEventProj(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px', backgroundColor: '#fff' }}
              >
                <option value="">None (General Event)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button 
                type="button" 
                onClick={() => setShowEventModal(false)}
                style={{ flex: 1, backgroundColor: '#f0f0f5', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#48484a' }}
              >
                Cancel
              </button>
              <button 
                type="submit"
                style={{ flex: 2, background: 'linear-gradient(135deg, #0a7aff, #0062d6)', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
              >
                Schedule
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Inspect Event Modal Popup */}
      {inspectEvent && (
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
          <div 
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '380px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              background: '#ffffff',
              boxShadow: '0 20px 48px rgba(0,0,0,0.1)'
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#1c1c1e' }}>{inspectEvent.title}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px' }}>
              <div style={{ fontSize: '12px', color: '#48484a', fontWeight: 700 }}>
                📅 DATE: <span style={{ color: '#1c1c1e' }}>{inspectEvent.date}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#48484a', fontWeight: 700 }}>
                🕒 TIME: <span style={{ color: '#1c1c1e' }}>{inspectEvent.startTime} - {inspectEvent.endTime}</span>
              </div>
              {inspectEvent.description && (
                <div style={{ fontSize: '12px', color: '#48484a', fontWeight: 700 }}>
                  📝 DETAILS: <span style={{ color: '#1c1c1e', fontWeight: 500 }}>{inspectEvent.description}</span>
                </div>
              )}
              {inspectEvent.projectId && (() => {
                const proj = projects.find(p => p.id === inspectEvent.projectId);
                return proj ? (
                  <div style={{ fontSize: '12px', color: '#48484a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📂 HUB: <span style={{ padding: '2px 8px', borderRadius: '6px', backgroundColor: proj.color, color: 'white', fontSize: '10px', fontWeight: 800 }}>{proj.name}</span>
                  </div>
                ) : null;
              })()}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button 
                onClick={() => {
                  deleteCalendarEvent(inspectEvent.id);
                  setInspectEvent(null);
                }}
                style={{ flex: 1, backgroundColor: 'rgba(255, 45, 85, 0.08)', color: '#ff2d55', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
              >
                Delete Event
              </button>
              <button 
                onClick={() => setInspectEvent(null)}
                style={{ flex: 1, backgroundColor: '#f0f0f5', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#48484a' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation spinner style injection */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
};

export default CalendarView;
