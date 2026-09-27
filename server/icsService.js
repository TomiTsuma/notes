/**
 * Format a Date to iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ
 */
function toIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Format a date string (YYYY-MM-DD) and time string (HH:MM) to iCalendar timestamp
 */
function formatIcsDateTime(dateStr, timeStr) {
  try {
    const [year, month, day] = dateStr.split('-');
    const [hour, min] = (timeStr || '09:00').split(':');
    const d = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(min, 10), 0));
    return toIcsUtc(d);
  } catch (err) {
    return toIcsUtc(new Date());
  }
}

/**
 * Escape text for iCalendar specification (RFC 5545)
 */
function escapeIcsText(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate RFC 5545 iCalendar (.ics) string
 */
export function generateIcsFeed(events = [], tasks = []) {
  const nowUtc = toIcsUtc(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Clio Research//Clio Calendar 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Clio Schedule',
    'X-WR-TIMEZONE:UTC',
  ];

  // 1. Add Calendar Events
  for (const ev of events) {
    if (!ev.date) continue;
    const uid = `ev-${ev.id || Math.random().toString(36).substring(2)}@clio`;
    const dtstart = formatIcsDateTime(ev.date, ev.startTime || '09:00');
    const dtend = formatIcsDateTime(ev.date, ev.endTime || '10:00');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowUtc}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.title || 'Untitled Event')}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    }
    lines.push(`STATUS:${ev.completed ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }

  // 2. Add Kanban Tasks with Due Dates
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const uid = `task-${task.id}@clio`;
    const dtstart = formatIcsDateTime(task.dueDate, '09:00');
    const dtend = formatIcsDateTime(task.dueDate, '10:00');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowUtc}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:[Task] ${escapeIcsText(task.title || 'Untitled Task')}`);
    const desc = [
      task.description || '',
      `Priority: ${task.priority || 'medium'}`,
      `Status: ${task.status || 'todo'}`,
      task.jiraUrl ? `Jira: ${task.jiraUrl}` : '',
    ].filter(Boolean).join('\n');
    lines.push(`DESCRIPTION:${escapeIcsText(desc)}`);
    lines.push(`STATUS:${task.status === 'done' ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/**
 * Parse an iCalendar (.ics) string into Clio CalendarEvent records
 */
export function parseIcsContent(icsText) {
  if (!icsText || typeof icsText !== 'string') return [];

  const events = [];
  // Unfold multi-line iCal properties (lines starting with space or tab continue previous line)
  const unfolded = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  let current = {};

  const unescapeIcs = (val) => {
    return (val || '')
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  };

  const parseIcsDate = (val) => {
    // Examples: 20260927T090000Z or 20260927 or TZID=...:20260927T090000
    const clean = val.includes(':') ? val.split(':').pop() : val;
    if (clean.length >= 8) {
      const year = clean.substring(0, 4);
      const month = clean.substring(4, 6);
      const day = clean.substring(6, 8);
      const dateStr = `${year}-${month}-${day}`;
      let timeStr = '09:00';
      if (clean.includes('T') && clean.length >= 13) {
        const timePart = clean.split('T')[1];
        const h = timePart.substring(0, 2);
        const m = timePart.substring(2, 4);
        timeStr = `${h}:${m}`;
      }
      return { dateStr, timeStr };
    }
    const today = new Date().toISOString().split('T')[0];
    return { dateStr: today, timeStr: '09:00' };
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {
        id: `ics-${Math.random().toString(36).substring(2, 9)}`,
        title: '',
        description: '',
        date: '',
        startTime: '09:00',
        endTime: '10:00',
        color: 'sage',
        source: 'ics',
        completed: false,
        createdAt: new Date().toISOString(),
      };
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && current.title) {
        if (!current.date) {
          current.date = new Date().toISOString().split('T')[0];
        }
        events.push(current);
      }
      inEvent = false;
      current = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const rawProp = trimmed.substring(0, colonIdx);
    const value = trimmed.substring(colonIdx + 1);
    const prop = rawProp.split(';')[0].toUpperCase();

    switch (prop) {
      case 'SUMMARY':
        current.title = unescapeIcs(value);
        break;
      case 'DESCRIPTION':
        current.description = unescapeIcs(value);
        break;
      case 'DTSTART': {
        const { dateStr, timeStr } = parseIcsDate(trimmed);
        current.date = dateStr;
        current.startTime = timeStr;
        break;
      }
      case 'DTEND': {
        const { timeStr } = parseIcsDate(trimmed);
        current.endTime = timeStr;
        break;
      }
      case 'STATUS':
        if (value.toUpperCase() === 'COMPLETED') {
          current.completed = true;
        }
        break;
      case 'UID':
        current.id = `ics-${value.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 16)}`;
        break;
    }
  }

  return events;
}
