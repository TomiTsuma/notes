import type { CalendarEvent, KanbanTask } from '../../store/appStore';

export interface ScheduleItem {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  color: string;
  completed: boolean;
  source: 'event' | 'task';
  projectId: string | null;
  eventId?: string;
  taskId?: string;
}

export const eventToScheduleItem = (ev: CalendarEvent): ScheduleItem => ({
  id: `event-${ev.id}`,
  title: ev.title,
  description: ev.description,
  date: ev.date,
  startTime: ev.startTime,
  endTime: ev.endTime,
  color: ev.color || '#a8c5ff',
  completed: ev.completed ?? false,
  source: 'event',
  projectId: ev.projectId,
  eventId: ev.id,
});

export const taskToScheduleItem = (task: KanbanTask, color: string): ScheduleItem => ({
  id: `task-${task.id}`,
  title: task.title,
  description: task.description,
  date: task.dueDate!,
  startTime: '09:00',
  endTime: '10:00',
  color,
  completed: task.status === 'done',
  source: 'task',
  projectId: task.projectId,
  taskId: task.id,
});
