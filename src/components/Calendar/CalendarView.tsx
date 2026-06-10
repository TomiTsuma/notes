import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/appStore';
import type { CalendarEvent } from '../../store/appStore';
import { eventToScheduleItem, taskToScheduleItem, type ScheduleItem } from './calendarTypes';
import { addDays, parseDateStr, formatDateStr } from '../../utils/calendarUtils';
import CalendarHeader from './CalendarHeader';
import DailyTimelineView from './DailyTimelineView';
import WeeklyGridView from './WeeklyGridView';
import MonthlyGridView from './MonthlyGridView';
import EventFormModal from './EventFormModal';
import EventBottomSheet from './EventBottomSheet';
import './Calendar.css';

const CalendarView: React.FC = () => {
  const {
    projects,
    calendarEvents,
    kanbanTasks,
    calendarViewMode,
    selectedCalendarDate,
    setCalendarViewMode,
    setSelectedCalendarDate,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    updateKanbanTask,
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);

  const scheduleItems = useMemo(() => {
    const events = calendarEvents.map(eventToScheduleItem);
    const tasks = kanbanTasks
      .filter(t => t.dueDate)
      .map((t) => {
        const proj = projects.find(p => p.id === t.projectId);
        return taskToScheduleItem(t, proj?.color || '#ffd4a8');
      });
    return [...events, ...tasks];
  }, [calendarEvents, kanbanTasks, projects]);

  const dayItems = scheduleItems.filter(it => it.date === selectedCalendarDate);

  const navigate = (dir: -1 | 1) => {
    const d = parseDateStr(selectedCalendarDate);
    if (calendarViewMode === 'day') {
      setSelectedCalendarDate(formatDateStr(addDays(d, dir)));
    } else if (calendarViewMode === 'week') {
      setSelectedCalendarDate(formatDateStr(addDays(d, dir * 7)));
    } else {
      d.setMonth(d.getMonth() + dir);
      setSelectedCalendarDate(formatDateStr(d));
    }
  };

  const handleFormSubmit = (data: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    if (editEvent) {
      updateCalendarEvent(editEvent.id, data);
      setEditEvent(null);
    } else {
      addCalendarEvent({
        ...data,
        id: `ev-${uuidv4().substring(0, 8)}`,
        createdAt: new Date().toISOString(),
      });
    }
    setShowForm(false);
  };

  const handleToggleComplete = (item: ScheduleItem) => {
    if (item.source === 'event' && item.eventId) {
      updateCalendarEvent(item.eventId, { completed: !item.completed });
    } else if (item.source === 'task' && item.taskId) {
      updateKanbanTask(item.taskId, { status: item.completed ? 'todo' : 'done' });
    }
    setSelectedItem(prev => prev ? { ...prev, completed: !prev.completed } : null);
  };

  const handleDelete = () => {
    if (selectedItem?.eventId) {
      deleteCalendarEvent(selectedItem.eventId);
      setSelectedItem(null);
    }
  };

  const handleEdit = () => {
    if (selectedItem?.eventId) {
      const ev = calendarEvents.find(e => e.id === selectedItem.eventId);
      if (ev) {
        setEditEvent(ev);
        setShowForm(true);
        setSelectedItem(null);
      }
    }
  };

  return (
    <div className="workspace-view-container calendar-shell">
      <CalendarHeader
        viewMode={calendarViewMode}
        selectedDate={selectedCalendarDate}
        onViewModeChange={setCalendarViewMode}
        onDateSelect={setSelectedCalendarDate}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
      />

      {calendarViewMode === 'day' && (
        <DailyTimelineView
          date={selectedCalendarDate}
          items={dayItems}
          onSelect={setSelectedItem}
          onToggleComplete={handleToggleComplete}
        />
      )}

      {calendarViewMode === 'week' && (
        <WeeklyGridView
          selectedDate={selectedCalendarDate}
          items={scheduleItems}
          onSelect={setSelectedItem}
          onDayClick={ds => { setSelectedCalendarDate(ds); setCalendarViewMode('day'); }}
        />
      )}

      {calendarViewMode === 'month' && (
        <MonthlyGridView
          selectedDate={selectedCalendarDate}
          items={scheduleItems}
          onDayClick={ds => { setSelectedCalendarDate(ds); setCalendarViewMode('day'); }}
          onSelect={setSelectedItem}
        />
      )}

      <button className="calendar-fab" onClick={() => { setEditEvent(null); setShowForm(true); }} title="Add event">+</button>

      {showForm && (
        <EventFormModal
          date={selectedCalendarDate}
          projects={projects}
          editEvent={editEvent}
          onSubmit={handleFormSubmit}
          onClose={() => { setShowForm(false); setEditEvent(null); }}
        />
      )}

      <EventBottomSheet
        item={selectedItem}
        projects={projects}
        onClose={() => setSelectedItem(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleComplete={() => selectedItem && handleToggleComplete(selectedItem)}
      />
    </div>
  );
};

export default CalendarView;
