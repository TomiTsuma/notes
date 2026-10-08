import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/appStore';
import type { CalendarEvent } from '../../store/appStore';
import {
  fetchGoogleAuthUrl,
  fetchGoogleStatus,
  disconnectGoogle,
  exchangeGoogleCode,
  fetchGoogleCalendarEvents,
  createGoogleCalendarEvent,
  importIcsEvents,
  getIcsFeedUrl,
  getIcsExportUrl,
  type GoogleStatus,
} from '../../services/calendarSyncService';
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

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const HOUR_HEIGHT = 56;

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CalendarView: React.FC = () => {
  const {
    projects,
    calendarEvents,
    calendarViewMode,
    setCalendarViewMode,
    setSelectedCalendarDate,
    addCalendarEvent,
    updateCalendarEvent,
    mergeExternalEvents,
  } = useAppStore();

  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(() => formatLocalDate(new Date()));
  const [eventTime, setEventTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');
  const [eventCategory, setEventCategory] = useState('sky');
  const [syncToGoogle, setSyncToGoogle] = useState(false);

  // Active date ALWAYS defaults to today (the current day)
  const [activeDate, setActiveDate] = useState<Date>(() => new Date());
  // View mode defaults to 'day' (or store preference if set)
  const [viewMode, setViewMode] = useState<typeof calendarViewMode>(() => calendarViewMode || 'day');
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Keep live time updated every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Synchronize local viewMode with store if store changes externally
  useEffect(() => {
    if (calendarViewMode && calendarViewMode !== viewMode) {
      setViewMode(calendarViewMode);
    }
  }, [calendarViewMode]);

  const handleViewModeChange = (mode: typeof calendarViewMode) => {
    setViewMode(mode);
    setCalendarViewMode(mode);
  };

  // Google Calendar & .ics Sync State
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ connected: false });
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // iCalendar Modal State
  const [showIcsModal, setShowIcsModal] = useState(false);
  const [icsFeedUrl, setIcsFeedUrl] = useState('');
  const [icsInputUrl, setIcsInputUrl] = useState('');
  const [isImportingIcs, setIsImportingIcs] = useState(false);
  const [copiedFeed, setCopiedFeed] = useState(false);

  // Auto-scroll directly to the CURRENT TIME
  const scrollToCurrentTime = (smooth = false) => {
    if (!scrollContainerRef.current) return;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentY = (currentMinutes / 60) * HOUR_HEIGHT;
    // Position current time comfortably in upper viewport (~120px below sticky header)
    const targetScroll = Math.max(0, currentY - 120);

    if (smooth) {
      scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
    } else {
      scrollContainerRef.current.scrollTop = targetScroll;
    }
  };

  // Scroll to current time on mount and whenever viewMode changes
  useEffect(() => {
    scrollToCurrentTime(false);
    const rafId = requestAnimationFrame(() => {
      scrollToCurrentTime(false);
    });
    const timer = setTimeout(() => {
      scrollToCurrentTime(false);
    }, 60);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [viewMode]);

  // Check URL params and load Google status on mount
  useEffect(() => {
    setIcsFeedUrl(getIcsFeedUrl());

    const searchParams = new URLSearchParams(window.location.search);
    const authCode = searchParams.get('code');
    const googleConnected = searchParams.get('google_connected');
    const googleError = searchParams.get('google_error');

    if (authCode) {
      window.history.replaceState({}, '', window.location.pathname);
      setIsSyncingGoogle(true);
      setSyncNotice('Connecting Google account...');
      exchangeGoogleCode(authCode, window.location.origin || 'https://chlio.ereuna.org')
        .then((res) => {
          setGoogleStatus({ connected: true, email: res.email });
          setSyncNotice(`Connected to Google Calendar (${res.email})! Syncing events...`);
          return fetchGoogleCalendarEvents();
        })
        .then((events) => {
          mergeExternalEvents(events, 'google');
          setSyncNotice(`Synced ${events.length} events from Google Calendar.`);
          setTimeout(() => setSyncNotice(null), 4000);
        })
        .catch((err) => {
          setSyncNotice(`Google Calendar auth error: ${err.message}`);
        })
        .finally(() => {
          setIsSyncingGoogle(false);
        });
    } else if (googleConnected === 'true') {
      setSyncNotice('Google Calendar connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
      syncGoogleEvents();
    } else if (googleError) {
      setSyncNotice(`Google Calendar auth error: ${googleError}`);
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      fetchGoogleStatus()
        .then((status) => {
          setGoogleStatus(status);
          if (status.connected) {
            syncGoogleEvents();
          }
        })
        .catch((err) => console.warn('Could not load Google status:', err.message));
    }
  }, []);

  const syncGoogleEvents = async () => {
    setIsSyncingGoogle(true);
    setSyncNotice(null);
    try {
      const gEvents = await fetchGoogleCalendarEvents();
      mergeExternalEvents(gEvents, 'google');
      setSyncNotice(`Synced ${gEvents.length} events from Google Calendar.`);
      setTimeout(() => setSyncNotice(null), 4000);
    } catch (err: any) {
      setSyncNotice(`Google Calendar sync error: ${err.message}`);
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const url = await fetchGoogleAuthUrl(window.location.origin || 'https://chlio.ereuna.org');
      window.location.href = url;
    } catch (err: any) {
      alert(`Could not start Google authentication: ${err.message}`);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Disconnect Google Calendar?')) return;
    try {
      await disconnectGoogle();
      setGoogleStatus({ connected: false });
      mergeExternalEvents([], 'google');
      setSyncNotice('Google Calendar disconnected.');
      setTimeout(() => setSyncNotice(null), 3000);
    } catch (err: any) {
      alert(`Failed to disconnect: ${err.message}`);
    }
  };

  const handleCopyFeedUrl = () => {
    navigator.clipboard.writeText(icsFeedUrl);
    setCopiedFeed(true);
    setTimeout(() => setCopiedFeed(false), 2500);
  };

  const handleImportIcsUrl = async () => {
    if (!icsInputUrl.trim()) return;
    setIsImportingIcs(true);
    try {
      const imported = await importIcsEvents({ url: icsInputUrl.trim() });
      mergeExternalEvents(imported, 'ics');
      setSyncNotice(`Imported ${imported.length} events from .ics feed.`);
      setShowIcsModal(false);
      setIcsInputUrl('');
      setTimeout(() => setSyncNotice(null), 4000);
    } catch (err: any) {
      alert(`Failed to import .ics: ${err.message}`);
    } finally {
      setIsImportingIcs(false);
    }
  };

  const handleFileUploadIcs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingIcs(true);
    try {
      const text = await file.text();
      const imported = await importIcsEvents({ icsText: text });
      mergeExternalEvents(imported, 'ics');
      setSyncNotice(`Imported ${imported.length} events from ${file.name}.`);
      setShowIcsModal(false);
      setTimeout(() => setSyncNotice(null), 4000);
    } catch (err: any) {
      alert(`Failed to parse .ics file: ${err.message}`);
    } finally {
      setIsImportingIcs(false);
      e.target.value = '';
    }
  };

  const handleCreateEvent = async () => {
    if (!eventTitle.trim()) return;

    const newEventId = `ev-${uuidv4().substring(0, 8)}`;
    const eventPayload: CalendarEvent = {
      id: newEventId,
      title: eventTitle,
      description: `Category: ${eventCategory}`,
      date: eventDate,
      startTime: eventTime,
      endTime: eventEndTime || '10:00',
      projectId: projects[0]?.id || 'proj-general',
      color: eventCategory,
      createdAt: new Date().toISOString(),
      source: 'clio',
    };

    addCalendarEvent(eventPayload);

    if (syncToGoogle && googleStatus.connected) {
      try {
        await createGoogleCalendarEvent({
          title: eventTitle,
          description: `Category: ${eventCategory} (from Clio)`,
          date: eventDate,
          startTime: eventTime,
          endTime: eventEndTime || '10:00',
        });
        setSyncNotice('Event created and synced to Google Calendar.');
        setTimeout(() => setSyncNotice(null), 3000);
      } catch (err: any) {
        console.warn('Could not sync event to Google Calendar:', err.message);
      }
    }

    setEventTitle('');
    setSyncToGoogle(false);
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
    const todayStr = formatLocalDate(currentTime);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatLocalDate(d);
      days.push({
        name: dayNames[i],
        dateNum: d.getDate(),
        dateStr,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  };

  // Compute days for month grid view
  const getMonthDays = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();

    const days: { dateStr: string; dateNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = formatLocalDate(currentTime);

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = formatLocalDate(prevDate);
      days.push({ dateStr, dateNum: d, isCurrentMonth: false, isToday: dateStr === todayStr });
    }

    for (let i = 1; i <= totalDays; i++) {
      const curDate = new Date(year, month, i);
      const dateStr = formatLocalDate(curDate);
      days.push({ dateStr, dateNum: i, isCurrentMonth: true, isToday: dateStr === todayStr });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dateStr = formatLocalDate(nextDate);
      days.push({ dateStr, dateNum: i, isCurrentMonth: false, isToday: dateStr === todayStr });
    }

    return days;
  };

  const weekDays = getWeekDays(activeDate);
  const monthDays = getMonthDays(activeDate);

  const getHeaderTitle = () => {
    if (viewMode === 'day') {
      return activeDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    return activeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const shiftPeriod = (direction: -1 | 1) => {
    const next = new Date(activeDate);
    if (viewMode === 'day') {
      next.setDate(activeDate.getDate() + direction);
    } else if (viewMode === 'month') {
      next.setMonth(activeDate.getMonth() + direction);
    } else {
      next.setDate(activeDate.getDate() + direction * 7);
    }
    setActiveDate(next);
  };

  const handleTodayClick = () => {
    const today = new Date();
    setActiveDate(today);
    setSelectedCalendarDate(formatLocalDate(today));
    scrollToCurrentTime(true);
  };

  // Calculate event vertical position and height with minute precision
  const getEventPosition = (ev: CalendarEvent) => {
    const [startH, startM] = (ev.startTime || '09:00').split(':').map((v) => parseInt(v, 10) || 0);
    const startFraction = Math.max(0, Math.min(23.75, startH + (startM || 0) / 60));

    let endFraction = startFraction + 1;
    if (ev.endTime) {
      const [endH, endM] = ev.endTime.split(':').map((v) => parseInt(v, 10) || 0);
      const parsedEnd = endH + (endM || 0) / 60;
      if (parsedEnd > startFraction) {
        endFraction = Math.min(24, parsedEnd);
      }
    }

    const duration = Math.max(0.45, endFraction - startFraction);
    const top = startFraction * HOUR_HEIGHT + 2;
    const height = Math.max(26, duration * HOUR_HEIGHT - 4);
    return { top, height };
  };

  // Current real-time line position
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;

  const todayStr = formatLocalDate(currentTime);
  const activeDateStr = formatLocalDate(activeDate);
  const isTodayActive = activeDateStr === todayStr;

  return (
    <div className="cl-view" style={{ padding: '32px 40px', width: '100%', boxSizing: 'border-box' }}>
      {/* Notice Banner */}
      {syncNotice && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 16px',
            borderRadius: 6,
            backgroundColor: 'var(--surface-sunken, rgba(0,0,0,0.04))',
            border: '1px solid var(--line)',
            fontSize: 13,
            color: 'var(--ink-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{syncNotice}</span>
          <button
            onClick={() => setSyncNotice(null)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)' }}
          >
            &times;
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left Sidebar Controls */}
        <div className="cl-col" style={{ gap: 16 }}>
          <Button
            variant="primary"
            icon="plus"
            block
            onClick={() => {
              setEventDate(formatLocalDate(activeDate));
              const nowH = new Date().getHours();
              const nextH = Math.min(23, nowH + 1);
              setEventTime(`${String(nowH).padStart(2, '0')}:00`);
              setEventEndTime(`${String(nextH).padStart(2, '0')}:00`);
              setShowEventModal(true);
            }}
          >
            New event
          </Button>

          <Card>
            <MiniCalendar
              month={activeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              startOffset={(new Date(activeDate.getFullYear(), activeDate.getMonth(), 1).getDay() + 6) % 7}
              days={new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 0).getDate()}
              today={
                activeDate.getFullYear() === currentTime.getFullYear() &&
                activeDate.getMonth() === currentTime.getMonth()
                  ? currentTime.getDate()
                  : -1
              }
              selected={activeDate.getDate()}
              marked={calendarEvents
                .filter((e) => {
                  const parts = e.date.split('-');
                  return parseInt(parts[0], 10) === activeDate.getFullYear() && parseInt(parts[1], 10) === activeDate.getMonth() + 1;
                })
                .map((e) => parseInt(e.date.split('-')[2], 10))
                .filter(Boolean)}
              onSelectDay={(dayNum) => {
                const newD = new Date(activeDate.getFullYear(), activeDate.getMonth(), dayNum);
                setActiveDate(newD);
                setSelectedCalendarDate(formatLocalDate(newD));
                handleViewModeChange('day');
              }}
            />
          </Card>

          {/* Google Calendar Sync Card */}
          <Card style={{ padding: 14 }}>
            <div className="cl-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="cl-overline">Google Calendar</div>
              {googleStatus.connected && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    display: 'inline-block',
                  }}
                  title="Connected"
                />
              )}
            </div>

            {googleStatus.connected ? (
              <div className="cl-col" style={{ gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', wordBreak: 'break-all' }}>
                  {googleStatus.email || 'Connected'}
                </div>
                <div className="cl-row" style={{ gap: 6 }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="refresh"
                    onClick={syncGoogleEvents}
                    disabled={isSyncingGoogle}
                    style={{ flex: 1 }}
                  >
                    {isSyncingGoogle ? 'Syncing...' : 'Sync'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDisconnectGoogle}
                    style={{ color: '#ef4444' }}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="cl-col" style={{ gap: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: 0 }}>
                  Sync research events directly with your Google account.
                </p>
                <Button size="sm" variant="secondary" onClick={handleConnectGoogle} block>
                  Connect Google Cal
                </Button>
              </div>
            )}
          </Card>

          {/* iCalendar (.ics) Sync Card */}
          <Card style={{ padding: 14 }}>
            <div className="cl-overline" style={{ marginBottom: 10 }}>
              .ICS Calendar Sync
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '0 0 10px 0' }}>
              Subscribe via URL or import Google Calendar secret .ics feeds.
            </p>
            <div className="cl-col" style={{ gap: 6 }}>
              <Button size="sm" variant="ghost" icon="link" onClick={() => setShowIcsModal(true)} block>
                Google Cal .ics Feed
              </Button>
              <div className="cl-row" style={{ gap: 6 }}>
                <a
                  href={getIcsExportUrl()}
                  download="clio-calendar.ics"
                  style={{ textDecoration: 'none', flex: 1 }}
                >
                  <Button size="sm" variant="ghost" icon="download" block>
                    Export .ics
                  </Button>
                </a>
              </div>
            </div>
          </Card>

          {/* Projects Filter Card */}
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
            {googleStatus.connected && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                <Checkbox defaultChecked strike={false}>
                  <span className="cl-row" style={{ gap: 8 }}>
                    <i style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: '#3b82f6', display: 'inline-block' }} />
                    Google Calendar
                  </span>
                </Checkbox>
              </div>
            )}
          </Card>
        </div>

        {/* Right Main Calendar Grid */}
        <div style={{ minWidth: 0 }}>
          {/* Top Bar Header Controls */}
          <div className="cl-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="cl-row" style={{ gap: 12 }}>
              <h1 className="cl-h-display" style={{ fontSize: 26, margin: 0 }}>
                {getHeaderTitle()}
              </h1>
              <IconButton icon="chevron-left" label="Previous" outlined onClick={() => shiftPeriod(-1)} />
              <IconButton icon="chevron-right" label="Next" outlined onClick={() => shiftPeriod(1)} />
              <Button size="sm" onClick={handleTodayClick}>
                Today
              </Button>
            </div>
            <SegmentedControl
              value={viewMode}
              onChange={(v) => handleViewModeChange(v as any)}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
          </div>

          {/* VIEW MODE 1: WEEK VIEW */}
          {viewMode === 'week' && (
            <div
              ref={scrollContainerRef}
              style={{
                maxHeight: 'calc(100vh - 210px)',
                minHeight: 520,
                overflowY: 'auto',
                overflowX: 'auto',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface-raised)',
                position: 'relative',
              }}
            >
              <div
                className="cl-week-grid"
                style={{
                  border: 'none',
                  borderRadius: 0,
                  display: 'grid',
                  gridTemplateColumns: '56px repeat(7, minmax(110px, 1fr))',
                  position: 'relative',
                }}
              >
                {/* Pinned Sticky Row 1: Weekday Column Headers */}
                <div
                  className="h"
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    background: 'var(--surface-raised)',
                    borderBottom: '1px solid var(--line)',
                    borderRight: '1px solid var(--line)',
                  }}
                />
                {weekDays.map((day) => (
                  <div
                    key={day.dateStr}
                    className={`h${day.isToday ? ' today' : ''}`}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      background: 'var(--surface-raised)',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    {day.name}
                    <b>{day.dateNum}</b>
                  </div>
                ))}

                {/* Row 2: 24-Hour Time Label Column */}
                <div className="tcol" style={{ height: 24 * HOUR_HEIGHT }}>
                  {HOURS.map((timeStr) => (
                    <div key={timeStr} style={{ height: HOUR_HEIGHT }}>
                      {timeStr}:00
                    </div>
                  ))}
                </div>

                {/* Row 2: 7 Day Columns (Full 24-Hour Timeline) */}
                {weekDays.map((day) => {
                  const dayEvents = calendarEvents.filter((e) => e.date === day.dateStr);

                  return (
                    <div
                      key={day.dateStr}
                      className="day"
                      style={{
                        height: 24 * HOUR_HEIGHT,
                        position: 'relative',
                      }}
                    >
                      {/* Live "Now" Line indicator */}
                      {day.isToday && (
                        <div
                          className="now"
                          style={{
                            top: nowTop,
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            zIndex: 10,
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              left: -50,
                              top: -8,
                              backgroundColor: 'var(--danger, #ef4444)',
                              color: '#fff',
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '1px 4px',
                              borderRadius: 3,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                              lineHeight: '12px',
                              zIndex: 12,
                            }}
                          >
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        </div>
                      )}

                      {/* Events */}
                      {dayEvents.map((ev) => {
                        const { top, height } = getEventPosition(ev);
                        const tone = ev.source === 'google' ? 'sky' : ev.color || 'sky';
                        return (
                          <EventBlock
                            key={ev.id}
                            title={ev.source === 'google' ? `[Google] ${ev.title}` : ev.title}
                            time={`${ev.startTime || '09:00'}${ev.endTime ? `–${ev.endTime}` : ''}`}
                            tone={tone}
                            done={!!ev.completed}
                            onClick={() => updateCalendarEvent(ev.id, { completed: !ev.completed })}
                            style={{
                              top,
                              height,
                              position: 'absolute',
                              left: 4,
                              right: 4,
                              zIndex: 5,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW MODE 2: DAY VIEW (Full 24-hour single-day timeline) */}
          {viewMode === 'day' && (
            <div
              ref={scrollContainerRef}
              style={{
                maxHeight: 'calc(100vh - 210px)',
                minHeight: 520,
                overflowY: 'auto',
                overflowX: 'auto',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface-raised)',
                position: 'relative',
              }}
            >
              <div
                className="cl-week-grid"
                style={{
                  border: 'none',
                  borderRadius: 0,
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr',
                  position: 'relative',
                }}
              >
                {/* Pinned Sticky Header */}
                <div
                  className="h"
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    background: 'var(--surface-raised)',
                    borderBottom: '1px solid var(--line)',
                    borderRight: '1px solid var(--line)',
                  }}
                />
                <div
                  className={`h${isTodayActive ? ' today' : ''}`}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    background: 'var(--surface-raised)',
                    borderBottom: '1px solid var(--line)',
                    textAlign: 'left',
                    paddingLeft: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <b>{activeDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</b>
                  {isTodayActive && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--accent, #0a7aff)',
                        backgroundColor: 'var(--surface-sunken, rgba(10, 122, 255, 0.1))',
                        padding: '2px 8px',
                        borderRadius: 10,
                      }}
                    >
                      Today
                    </span>
                  )}
                </div>

                {/* 24-Hour Time Labels */}
                <div className="tcol" style={{ height: 24 * HOUR_HEIGHT }}>
                  {HOURS.map((timeStr) => (
                    <div key={timeStr} style={{ height: HOUR_HEIGHT }}>
                      {timeStr}:00
                    </div>
                  ))}
                </div>

                {/* Single Day 24-Hour Body */}
                <div
                  className="day"
                  style={{
                    height: 24 * HOUR_HEIGHT,
                    position: 'relative',
                  }}
                >
                  {isTodayActive && (
                    <div
                      className="now"
                      style={{
                        top: nowTop,
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        zIndex: 10,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: -58,
                          top: -9,
                          backgroundColor: 'var(--danger, #ef4444)',
                          color: '#fff',
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                          lineHeight: '14px',
                          zIndex: 12,
                        }}
                      >
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    </div>
                  )}

                  {calendarEvents
                    .filter((e) => e.date === activeDateStr)
                    .map((ev) => {
                      const { top, height } = getEventPosition(ev);
                      const tone = ev.source === 'google' ? 'sky' : ev.color || 'sky';
                      return (
                        <EventBlock
                          key={ev.id}
                          title={ev.source === 'google' ? `[Google] ${ev.title}` : ev.title}
                          time={`${ev.startTime || '09:00'}${ev.endTime ? `–${ev.endTime}` : ''}`}
                          tone={tone}
                          done={!!ev.completed}
                          onClick={() => updateCalendarEvent(ev.id, { completed: !ev.completed })}
                          style={{
                            top,
                            height: Math.max(height, 36),
                            position: 'absolute',
                            left: 12,
                            right: 12,
                            zIndex: 5,
                          }}
                        />
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 3: MONTH VIEW */}
          {viewMode === 'month' && (
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface-raised)',
                overflow: 'hidden',
              }}
            >
              {/* Day Name Header Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--line)' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
                  <div
                    key={dayName}
                    style={{
                      padding: '10px 8px',
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                    }}
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Month Grid Cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 480 }}>
                {monthDays.map((day, idx) => {
                  const dayEvents = calendarEvents.filter((e) => e.date === day.dateStr);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        const [y, m, d] = day.dateStr.split('-').map(Number);
                        const nextD = new Date(y, m - 1, d, 9, 0, 0);
                        setActiveDate(nextD);
                        setSelectedCalendarDate(day.dateStr);
                        handleViewModeChange('day');
                      }}
                      style={{
                        minHeight: 90,
                        padding: '6px 8px',
                        borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--line)',
                        borderBottom: '1px solid var(--line)',
                        backgroundColor: day.isCurrentMonth ? 'transparent' : 'var(--surface-sunken, rgba(0,0,0,0.02))',
                        opacity: day.isCurrentMonth ? 1 : 0.45,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: day.isToday ? 700 : 500,
                            color: day.isToday ? 'var(--canvas)' : 'var(--ink)',
                            backgroundColor: day.isToday ? 'var(--primary)' : 'transparent',
                            width: day.isToday ? 22 : 'auto',
                            height: day.isToday ? 22 : 'auto',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {day.dateNum}
                        </span>
                        {dayEvents.length > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{dayEvents.length}</span>
                        )}
                      </div>

                      {/* Event Chips */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                        {dayEvents.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            style={{
                              fontSize: 10.5,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              padding: '2px 5px',
                              borderRadius: 3,
                              backgroundColor: ev.source === 'google' ? 'rgba(59, 130, 246, 0.15)' : 'var(--surface-sunken, rgba(0,0,0,0.06))',
                              color: ev.source === 'google' ? '#2563eb' : 'var(--ink)',
                            }}
                          >
                            {ev.startTime && <span style={{ opacity: 0.7, marginRight: 3 }}>{ev.startTime}</span>}
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>+{dayEvents.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
          <TextField
            label="Event title"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            placeholder="e.g. Lab meeting or Paper screening"
          />
          <TextField label="Date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TextField label="Start time" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
            <TextField label="End time" type="time" value={eventEndTime} onChange={(e) => setEventEndTime(e.target.value)} />
          </div>
          <div>
            <span className="cl-field-label" style={{ display: 'block', marginBottom: 8 }}>
              Event tint colour
            </span>
            <ColorPicker colors={PROJECT_COLORS} value={eventCategory} onChange={(c) => setEventCategory(c)} />
          </div>

          {googleStatus.connected && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                <input
                  type="checkbox"
                  checked={syncToGoogle}
                  onChange={(e) => setSyncToGoogle(e.target.checked)}
                />
                <span>Also add to my Google Calendar ({googleStatus.email})</span>
              </label>
            </div>
          )}
        </Modal>
      )}

      {/* iCalendar (.ics) Sync Modal */}
      {showIcsModal && (
        <Modal
          title="Google Calendar & .ics Sync"
          description="Synchronize your calendar with Google Calendar using the standard iCalendar (.ics) protocol."
          onClose={() => setShowIcsModal(false)}
          footer={
            <>
              <Button onClick={() => setShowIcsModal(false)}>Close</Button>
            </>
          }
        >
          {/* Section 1: Subscribe Google Calendar to Clio */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 14, color: 'var(--ink)' }}>
              1. Subscribe Google Calendar to Clio (Live Feed)
            </h4>
            <p style={{ margin: '0 0 10px 0', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              In Google Calendar, click <b>"+" next to Other calendars</b> &rarr; <b>From URL</b>, and paste this link:
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                readOnly
                value={icsFeedUrl}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  backgroundColor: 'var(--surface-sunken, rgba(0,0,0,0.03))',
                  color: 'var(--ink)',
                }}
              />
              <Button size="sm" variant="secondary" onClick={handleCopyFeedUrl}>
                {copiedFeed ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Section 2: Import Google Calendar into Clio via Secret iCal Address */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 14, color: 'var(--ink)' }}>
              2. Import Google Calendar into Clio
            </h4>
            <p style={{ margin: '0 0 10px 0', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              In Google Calendar Settings &rarr; Select your calendar &rarr; Scroll down to <b>"Secret address in iCal format"</b>, copy that URL, and paste it below:
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="url"
                value={icsInputUrl}
                onChange={(e) => setIcsInputUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  fontSize: 12,
                  color: 'var(--ink)',
                }}
              />
              <Button
                size="sm"
                variant="primary"
                onClick={handleImportIcsUrl}
                disabled={!icsInputUrl.trim() || isImportingIcs}
              >
                {isImportingIcs ? 'Importing...' : 'Sync URL'}
              </Button>
            </div>
          </div>

          {/* Section 3: Upload .ics file directly */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 14, color: 'var(--ink)' }}>
              3. Upload a .ics file
            </h4>
            <p style={{ margin: '0 0 8px 0', fontSize: 12.5, color: 'var(--ink-2)' }}>
              Upload any downloaded calendar (.ics) file directly into Clio:
            </p>
            <input
              type="file"
              accept=".ics,text/calendar"
              onChange={handleFileUploadIcs}
              disabled={isImportingIcs}
              style={{ fontSize: 12 }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CalendarView;
