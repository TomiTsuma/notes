import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/appStore';
import {
  Button,
  IconButton,
  SegmentedControl,
  MiniCalendar,
  EventBlock,
  Card,
  Checkbox,
  Modal,
  TextField,
  ColorPicker,
  PROJECT_COLORS,
} from '../UI/clio';

const CalendarView: React.FC = () => {
  const {
    projects,
    calendarEvents,
    calendarViewMode,
    selectedCalendarDate,
    setCalendarViewMode,
    addCalendarEvent,
    updateCalendarEvent,
  } = useAppStore();

  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(selectedCalendarDate || new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('09:00');
  const [eventCategory, setEventCategory] = useState('sky');

  const [activeDate, setActiveDate] = useState<Date>(() => new Date(selectedCalendarDate || Date.now()));

  const handleCreateEvent = () => {
    if (!eventTitle.trim()) return;
    addCalendarEvent({
      id: `ev-${uuidv4().substring(0, 8)}`,
      title: eventTitle,
      description: `Category: ${eventCategory}`,
      date: eventDate,
      startTime: eventTime,
      endTime: '10:00',
      projectId: projects[0]?.id || 'proj-general',
      color: eventCategory,
      createdAt: new Date().toISOString(),
    });
    setEventTitle('');
    setShowEventModal(false);
  };

  // Compute 7 days of the current week surrounding activeDate
  const getWeekDays = (baseDate: Date) => {
    const current = new Date(baseDate);
    const dayOfWeek = current.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(current);
    monday.setDate(current.getDate() - distanceToMonday);

    const days: { name: string; dateNum: number; dateStr: string; isToday: boolean }[] = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        name: dayNames[i],
        dateNum: d.getDate(),
        dateStr,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  };

  const weekDays = getWeekDays(activeDate);

  const monthYearLabel = activeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const shiftWeek = (offsetDays: number) => {
    const next = new Date(activeDate);
    next.setDate(activeDate.getDate() + offsetDays);
    setActiveDate(next);
  };

  const hourHeight = 56;
  const startHour = 8; // 08:00 AM

  return (
    <div className="cl-view" style={{ padding: '32px 40px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left Sidebar Controls */}
        <div className="cl-col" style={{ gap: 16 }}>
          <Button variant="primary" icon="plus" block onClick={() => setShowEventModal(true)}>
            New event
          </Button>

          <Card>
            <MiniCalendar
              marked={calendarEvents.map((e) => parseInt(e.date.split('-')[2], 10)).filter(Boolean)}
              today={new Date().getDate()}
              selected={activeDate.getDate()}
            />
          </Card>

          <Card style={{ padding: 14 }}>
            <div className="cl-overline" style={{ marginBottom: 10 }}>
              Projects
            </div>
            {projects.length > 0 ? (
              projects.map((p) => (
                <div key={p.id} style={{ marginBottom: 6 }}>
                  <Checkbox defaultChecked strike={false}>
                    <span className="cl-row" style={{ gap: 8 }}>
                      <i className={`s-${p.color || 'sky'}`} style={{ width: 8, height: 8, borderRadius: 3, display: 'inline-block' }} />
                      {p.name}
                    </span>
                  </Checkbox>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>No projects created yet.</p>
            )}
          </Card>
        </div>

        {/* Right Main Calendar Grid */}
        <div style={{ minWidth: 0 }}>
          {/* Top Bar Header Controls */}
          <div className="cl-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="cl-row" style={{ gap: 12 }}>
              <h1 className="cl-h-display" style={{ fontSize: 28 }}>
                {monthYearLabel}
              </h1>
              <IconButton icon="chevron-left" label="Previous week" outlined onClick={() => shiftWeek(-7)} />
              <IconButton icon="chevron-right" label="Next week" outlined onClick={() => shiftWeek(7)} />
              <Button size="sm" onClick={() => setActiveDate(new Date())}>
                Today
              </Button>
            </div>
            <SegmentedControl
              value={calendarViewMode}
              onChange={(v) => setCalendarViewMode(v as any)}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
          </div>

          {/* Weekly Grid View */}
          <div className="cl-week-grid">
            <div className="h" />
            {weekDays.map((day) => (
              <div key={day.dateStr} className={`h${day.isToday ? ' today' : ''}`}>
                {day.name}
                <b>{day.dateNum}</b>
              </div>
            ))}
            <div className="tcol">
              {['08', '09', '10', '11', '12', '13', '14', '15', '16'].map((timeStr) => (
                <div key={timeStr}>{timeStr}:00</div>
              ))}
            </div>

            {weekDays.map((day) => {
              const dayEvents = calendarEvents.filter((e) => e.date === day.dateStr);

              return (
                <div key={day.dateStr} className="day" style={{ height: 9 * hourHeight, position: 'relative' }}>
                  {day.isToday && <div className="now" style={{ top: 2 * hourHeight }} />}
                  {dayEvents.map((ev) => {
                    const startH = parseInt((ev.startTime || '09:00').split(':')[0], 10);
                    const topOffset = Math.max(0, startH - startHour);
                    return (
                      <EventBlock
                        key={ev.id}
                        title={ev.title}
                        time={`${ev.startTime || '09:00'}${ev.endTime ? `–${ev.endTime}` : ''}`}
                        tone={ev.color || 'sky'}
                        done={!!ev.completed}
                        onClick={() => updateCalendarEvent(ev.id, { completed: !ev.completed })}
                        style={{
                          top: topOffset * hourHeight + 2,
                          height: 1 * hourHeight - 4,
                          position: 'absolute',
                          left: 4,
                          right: 4,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Event Modal */}
      {showEventModal && (
        <Modal
          title="Add calendar event"
          description="Schedule a meeting, lab session, or writing block."
          onClose={() => setShowEventModal(false)}
          footer={
            <>
              <Button onClick={() => setShowEventModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateEvent}>
                Save event
              </Button>
            </>
          }
        >
          <TextField label="Event title" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="e.g. Lab meeting or Paper screening" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TextField label="Date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            <TextField label="Start time" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
          </div>
          <div>
            <span className="cl-field-label" style={{ display: 'block', marginBottom: 8 }}>
              Event tint colour
            </span>
            <ColorPicker colors={PROJECT_COLORS} value={eventCategory} onChange={(c) => setEventCategory(c)} />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CalendarView;
