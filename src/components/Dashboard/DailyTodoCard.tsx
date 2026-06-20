import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/appStore';
import type { DailyTodo } from '../../store/appStore';
import { DailyFocusIcon } from '../UI/Icons';

const WARNING_MINUTES = 15;

function minutesUntil(timeStr: string): number {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const due = new Date(now);
  due.setHours(h, m, 0, 0);
  return (due.getTime() - now.getTime()) / 60000;
}

function fmt12(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const DailyTodoCard: React.FC = () => {
  const { dailyTodos, addDailyTodo, toggleDailyTodo, deleteDailyTodo, updateDailyTodo } = useAppStore();

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTodos = dailyTodos
    .filter(t => t.date === todayStr)
    .sort((a, b) => {
      if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
      if (a.dueTime) return -1;
      if (b.dueTime) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });

  const [newText, setNewText] = useState('');
  const [newTime, setNewTime] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTime, setEditTime] = useState('');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const notifiedRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Request notification permission once
  useEffect(() => {
    if (!('Notification' in window)) return;
    setNotifPermission(Notification.permission);
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifPermission(p));
    }
  }, []);

  const fireNotification = useCallback((title: string, body: string) => {
    if (!('Notification' in window)) return;
    try {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, silent: false });
      }
    } catch {
      // iOS Safari may throw even when permission is "granted" outside a PWA
    }
  }, []);

  // Poll every 60 seconds for approaching deadlines
  useEffect(() => {
    const check = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const today = new Date().toISOString().split('T')[0];
      const pending = dailyTodos.filter(t => t.date === today && !t.completed && t.dueTime);

      for (const todo of pending) {
        const diff = minutesUntil(todo.dueTime!);

        // "Almost up" — fires once per task when within warning window
        if (diff > 0 && diff <= WARNING_MINUTES && !notifiedRef.current.has(`warn-${todo.id}`)) {
          notifiedRef.current.add(`warn-${todo.id}`);
          fireNotification(
            '⏰ Task almost due',
            `"${todo.text}" is due at ${fmt12(todo.dueTime!)}`
          );
        }
      }
    };

    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [dailyTodos, fireNotification]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    const todo: DailyTodo = {
      id: uuidv4(),
      text: newText.trim(),
      dueTime: newTime || undefined,
      completed: false,
      date: todayStr,
      createdAt: new Date().toISOString(),
    };
    addDailyTodo(todo);
    setNewText('');
    setNewTime('');
    inputRef.current?.focus();
  };

  const handleToggle = (id: string) => {
    const todo = todayTodos.find(t => t.id === id);
    toggleDailyTodo(id);

    // If completing a task, notify about the next upcoming one
    if (todo && !todo.completed && ('Notification' in window) && Notification.permission === 'granted') {
      const next = todayTodos
        .filter(t => t.id !== id && !t.completed && t.dueTime)
        .sort((a, b) => a.dueTime!.localeCompare(b.dueTime!))[0];
      if (next) {
        fireNotification('Up next', `"${next.text}" at ${fmt12(next.dueTime!)}`);
      }
    }
  };

  const startEdit = (todo: DailyTodo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
    setEditTime(todo.dueTime ?? '');
  };

  const commitEdit = (id: string) => {
    if (editText.trim()) updateDailyTodo(id, editText.trim(), editTime || undefined);
    setEditingId(null);
  };

  const completed = todayTodos.filter(t => t.completed).length;
  const total = todayTodos.length;

  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: 'span 2' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <DailyFocusIcon width={16} height={16} stroke="var(--accent-color)" /> Daily Focus
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {total > 0 && (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {completed}/{total} done
            </span>
          )}
          {('Notification' in window) && notifPermission !== 'granted' && (
            <button
              onClick={() => Notification.requestPermission().then(p => setNotifPermission(p))}
              style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(255,149,0,0.1)', color: '#ff9500', border: 'none', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer' }}
            >
              Enable Notifications
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${(completed / total) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #34c759, #30d158)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
        </div>
      )}

      {/* Todo list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
        {todayTodos.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic', padding: '12px 0', textAlign: 'center' }}>
            No tasks yet — add one below to start your day.
          </div>
        )}
        {todayTodos.map(todo => {
          const isEditing = editingId === todo.id;
          const dueSoon = !todo.completed && todo.dueTime && minutesUntil(todo.dueTime) <= WARNING_MINUTES && minutesUntil(todo.dueTime) > 0;
          const overdue = !todo.completed && todo.dueTime && minutesUntil(todo.dueTime) < 0;

          return (
            <div
              key={todo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '11px',
                backgroundColor: overdue ? 'rgba(255,45,85,0.06)' : dueSoon ? 'rgba(255,149,0,0.07)' : 'rgba(0,0,0,0.025)',
                borderLeft: overdue ? '3px solid #ff2d55' : dueSoon ? '3px solid #ff9500' : '3px solid transparent',
                transition: 'background 0.2s',
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggle(todo.id)}
                style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${todo.completed ? '#34c759' : 'rgba(0,0,0,0.2)'}`,
                  background: todo.completed ? '#34c759' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease', padding: 0,
                }}
              >
                {todo.completed && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              {/* Text / edit mode */}
              {isEditing ? (
                <div style={{ display: 'flex', flex: 1, gap: '8px', alignItems: 'center' }}>
                  <input
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(todo.id); if (e.key === 'Escape') setEditingId(null); }}
                    autoFocus
                    style={{ flex: 1, fontSize: '13px', padding: '4px 8px', borderRadius: '7px', border: '1px solid var(--border-color)', fontFamily: 'inherit' }}
                  />
                  <input
                    type="time"
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    style={{ fontSize: '12px', padding: '4px 6px', borderRadius: '7px', border: '1px solid var(--border-color)', fontFamily: 'inherit', width: '100px' }}
                  />
                  <button onClick={() => commitEdit(todo.id)} style={{ fontSize: '11px', fontWeight: 700, color: '#0a7aff', background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span
                    onDoubleClick={() => startEdit(todo)}
                    style={{
                      fontSize: '13px', fontWeight: 600, color: todo.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default',
                    }}
                  >
                    {todo.text}
                  </span>
                  {todo.dueTime && (
                    <span style={{
                      fontSize: '11px', fontWeight: 700, flexShrink: 0,
                      color: overdue ? '#ff2d55' : dueSoon ? '#ff9500' : 'var(--text-secondary)',
                      background: overdue ? 'rgba(255,45,85,0.1)' : dueSoon ? 'rgba(255,149,0,0.1)' : 'rgba(0,0,0,0.05)',
                      padding: '2px 7px', borderRadius: '6px',
                    }}>
                      {overdue ? '⚠ ' : dueSoon ? '⏰ ' : ''}{fmt12(todo.dueTime)}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              {!isEditing && (
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    onClick={() => startEdit(todo)}
                    title="Edit"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)', borderRadius: '5px', display: 'flex' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button
                    onClick={() => deleteDailyTodo(todo.id)}
                    title="Delete"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)', borderRadius: '5px', display: 'flex' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <input
          ref={inputRef}
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Add a task for today..."
          style={{
            flex: 1, fontSize: '13px', padding: '9px 12px', borderRadius: '10px',
            border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.5)',
            fontFamily: 'inherit', color: 'var(--text-primary)',
          }}
        />
        <input
          type="time"
          value={newTime}
          onChange={e => setNewTime(e.target.value)}
          title="Optional due time"
          style={{
            fontSize: '13px', padding: '9px 8px', borderRadius: '10px',
            border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.5)',
            fontFamily: 'inherit', color: 'var(--text-primary)', width: '110px',
          }}
        />
        <button
          type="submit"
          disabled={!newText.trim()}
          style={{
            background: newText.trim() ? '#0a7aff' : 'rgba(0,0,0,0.08)',
            color: newText.trim() ? 'white' : 'var(--text-secondary)',
            border: 'none', borderRadius: '10px', padding: '9px 16px',
            fontWeight: 800, fontSize: '13px', cursor: newText.trim() ? 'pointer' : 'default',
            transition: 'background 0.15s ease', flexShrink: 0,
          }}
        >
          Add
        </button>
      </form>
    </div>
  );
};

export default DailyTodoCard;
