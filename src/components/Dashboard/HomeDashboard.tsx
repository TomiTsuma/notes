import React, { useState, useEffect } from 'react';
import { useAppStore, type KanbanTask, type CalendarEvent } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';
import {
  fetchJiraConfig,
  fetchJiraProjects,
  transitionJiraIssue,
  type JiraProject,
} from '../../services/jiraService';
import {
  ViewHeader,
  SectionHeader,
  QuickActions,
  StreakCard,
  ProjectCard,
  NoteCard,
  AddTile,
  Card,
  CardTitle,
  Button,
  StatusPill,
  Modal,
  TextField,
  ColorPicker,
  PROJECT_COLORS,
} from '../UI/clio';

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const HomeDashboard: React.FC = () => {
  const {
    projects,
    files,
    kanbanTasks,
    calendarEvents,
    userStreak,
    setActiveView,
    setActiveDocument,
    setSelectedProjectId,
    addProject,
    addFile,
    addCalendarEvent,
    updateCalendarEvent,
    addKanbanTask,
    updateKanbanTask,
  } = useAppStore();

  const [showAddProjModal, setShowAddProjModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjColor, setNewProjColor] = useState('sky');
  const [newProjJiraKey, setNewProjJiraKey] = useState('');
  const [availableJiraProjects, setAvailableJiraProjects] = useState<JiraProject[]>([]);

  // Quick inputs
  const [newCalTaskText, setNewCalTaskText] = useState('');
  const [newKanbanText, setNewKanbanText] = useState('');

  const todayStr = formatLocalDate(new Date());

  // Current day's tasks drawn directly from the calendar
  const todayEvents = calendarEvents
    .filter((ev) => ev.date === todayStr)
    .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

  // Currently due items drawn directly from Kanban
  const priorityOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };
  const dueKanbanTasks = kanbanTasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      const pa = priorityOrder[a.priority || 'medium'] ?? 2;
      const pb = priorityOrder[b.priority || 'medium'] ?? 2;
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

  const completedKanbanCount = kanbanTasks.filter((t) => t.status === 'done').length;
  const pdfCount = files.filter((f) => f.type === 'pdf').length;
  const recentFiles = files.slice(0, 3);

  // Load Jira projects if available for project creation
  useEffect(() => {
    fetchJiraConfig()
      .then((cfg) => {
        if (cfg.host && cfg.hasToken) {
          return fetchJiraProjects().then((jProjects) => {
            setAvailableJiraProjects(jProjects);
          });
        }
      })
      .catch(() => {});
  }, []);

  const getGreetingDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    const jiraKeyTrim = newProjJiraKey.trim().toUpperCase();
    addProject({
      id: `proj-${uuidv4().substring(0, 8)}`,
      name: newProjName,
      description: newProjDesc,
      color: newProjColor,
      createdAt: new Date().toISOString(),
      jiraKey: jiraKeyTrim || undefined,
      isJira: !!jiraKeyTrim,
    });

    setNewProjName('');
    setNewProjDesc('');
    setNewProjJiraKey('');
    setShowAddProjModal(false);
  };

  const handleCreateNote = () => {
    const name = prompt('Note title:');
    if (!name) return;
    const newFile = {
      id: 'file-' + Date.now(),
      name,
      type: 'notebook' as const,
      folderId: null,
    };
    addFile(newFile);
    setActiveDocument(newFile.id);
    setActiveView('canvas');
  };

  const handleAddCalendarTask = () => {
    if (!newCalTaskText.trim()) return;
    const nowH = new Date().getHours();
    const nextH = Math.min(23, nowH + 1);

    const newEvent: CalendarEvent = {
      id: `ev-${uuidv4().substring(0, 8)}`,
      title: newCalTaskText.trim(),
      description: 'Scheduled from Dashboard',
      date: todayStr,
      startTime: `${String(nowH).padStart(2, '0')}:00`,
      endTime: `${String(nextH).padStart(2, '0')}:00`,
      projectId: projects[0]?.id || null,
      color: 'sky',
      completed: false,
      createdAt: new Date().toISOString(),
      source: 'clio',
    };

    addCalendarEvent(newEvent);
    setNewCalTaskText('');
  };

  const handleAddQuickKanbanTask = () => {
    if (!newKanbanText.trim()) return;

    const newTask: KanbanTask = {
      id: `task-${Date.now()}`,
      projectId: projects[0]?.id || 'proj-1',
      title: newKanbanText.trim(),
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: todayStr,
      createdAt: new Date().toISOString(),
    };

    addKanbanTask(newTask);
    setNewKanbanText('');
  };

  const handleToggleKanbanDone = async (task: KanbanTask) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    updateKanbanTask(task.id, { status: nextStatus });
    if (task.jiraKey) {
      try {
        await transitionJiraIssue(task.jiraKey, nextStatus);
      } catch (err: any) {
        console.warn('Could not transition Jira issue:', err.message);
      }
    }
  };

  // Compute dynamic weekly activity dots for StreakCard (Mon=0, Sun=6)
  const getWeekActivity = () => {
    const dayOfWeek = (new Date().getDay() + 6) % 7;
    const activity = [0, 0, 0, 0, 0, 0, 0];
    activity[dayOfWeek] = 1; // today
    const streak = Math.min(dayOfWeek + 1, Math.max(1, userStreak.streakCount || 1));
    for (let i = 0; i < streak; i++) {
      activity[dayOfWeek - i] = 1;
    }
    return activity;
  };

  const quickActionItems = [
    {
      icon: 'arxiv',
      label: 'Import arXiv',
      tone: 'rose',
      onClick: () => setActiveView('nextcloud'),
    },
    {
      icon: 'notebook',
      label: 'New notebook',
      tone: 'sky',
      onClick: handleCreateNote,
    },
    {
      icon: 'sticky',
      label: 'New sticky',
      tone: 'amber',
      onClick: () => setActiveView('nextcloud'),
    },
    {
      icon: 'canvas',
      label: 'Open canvas',
      tone: 'lilac',
      onClick: () => setActiveView('canvas'),
    },
    {
      icon: 'calendar',
      label: 'Add event',
      tone: 'sage',
      onClick: () => setActiveView('calendar'),
    },
  ];

  return (
    <div className="cl-view" style={{ padding: '32px 40px', width: '100%', boxSizing: 'border-box' }}>
      {/* View Header */}
      <ViewHeader
        overline={getGreetingDate()}
        title="Good afternoon, Thomas"
        subtitle={`${dueKanbanTasks.length} tasks due · ${todayEvents.length} scheduled today · ${pdfCount} papers in library.`}
        actions={
          <>
            <Button icon="upload" onClick={() => setActiveView('nextcloud')}>
              Upload
            </Button>
            <Button variant="primary" icon="plus" onClick={handleCreateNote}>
              New note
            </Button>
          </>
        }
      />

      {/* Quick Actions Bar */}
      <div style={{ marginTop: 20 }}>
        <QuickActions items={quickActionItems} />
      </div>

      {/* Top 3-Column Grid: Streak, Calendar Tasks, Kanban Due Items */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr 1.15fr', gap: 20, marginTop: 24, alignItems: 'stretch' }}>
        {/* Card 1: Live Streak Card */}
        <StreakCard
          days={userStreak.streakCount || 1}
          week={getWeekActivity()}
          todayIndex={(new Date().getDay() + 6) % 7}
          tasksDone={completedKanbanCount}
          notesLogged={files.length}
        />

        {/* Card 2: Current Day's Tasks (Drawn Directly from Calendar) */}
        <Card style={{ padding: '18px 20px', minHeight: 320, display: 'flex', flexDirection: 'column' }}>
          <div className="cl-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <CardTitle icon="calendar" title={`Today’s Tasks (${todayEvents.length})`} actions={false} />
            <Button variant="ghost" size="sm" iconRight="chevron-right" onClick={() => setActiveView('calendar')}>
              Calendar
            </Button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 220 }}>
            {todayEvents.length > 0 ? (
              todayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="cl-row"
                  style={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'var(--surface-sunken, rgba(0,0,0,0.03))',
                    border: '1px solid var(--line)',
                    opacity: ev.completed ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={!!ev.completed}
                      onChange={() => updateCalendarEvent(ev.id, { completed: !ev.completed })}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          textDecoration: ev.completed ? 'line-through' : 'none',
                          color: ev.completed ? 'var(--ink-3)' : 'var(--ink)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {ev.source === 'google' ? `[Google] ${ev.title}` : ev.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                        {ev.startTime ? `${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ''}` : 'All day'}
                        {ev.description && ev.description !== 'Calendar Event' && ev.description !== 'Scheduled from Dashboard' ? ` · ${ev.description}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className={`s-${ev.color || 'sky'}`} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                </div>
              ))
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 12px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-3)' }}>
                  No tasks scheduled for today in Calendar.
                </p>
                <Button size="sm" variant="secondary" icon="plus" onClick={() => setActiveView('calendar')}>
                  Schedule in Calendar
                </Button>
              </div>
            )}
          </div>

          {/* Quick add directly to Calendar */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <div className="cl-row" style={{ gap: 8 }}>
              <input
                type="text"
                placeholder="Add task to today's calendar..."
                value={newCalTaskText}
                onChange={(e) => setNewCalTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCalendarTask();
                }}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  fontSize: 12.5,
                  background: 'var(--canvas)',
                  color: 'var(--ink)',
                }}
              />
              <Button size="sm" variant="ghost" icon="plus" onClick={handleAddCalendarTask}>
                Add
              </Button>
            </div>
          </div>
        </Card>

        {/* Card 3: Currently Due Items (Drawn Directly from Kanban) */}
        <Card style={{ padding: '18px 20px', minHeight: 320, display: 'flex', flexDirection: 'column' }}>
          <div className="cl-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <CardTitle icon="kanban" title={`Currently Due Items (${dueKanbanTasks.length})`} actions={false} />
            <Button variant="ghost" size="sm" iconRight="chevron-right" onClick={() => setActiveView('kanban')}>
              Board
            </Button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 220 }}>
            {dueKanbanTasks.length > 0 ? (
              dueKanbanTasks.map((t) => {
                const proj = projects.find((p) => p.id === t.projectId || (p.jiraKey && t.jiraKey?.startsWith(p.jiraKey)));
                const isDueToday = t.dueDate === todayStr;
                const isOverdue = t.dueDate && t.dueDate < todayStr;

                return (
                  <div
                    key={t.id}
                    className="cl-row"
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'var(--surface-sunken, rgba(0,0,0,0.03))',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, marginRight: 8 }}>
                      <input
                        type="checkbox"
                        checked={t.status === 'done'}
                        onChange={() => handleToggleKanbanDone(t)}
                        title="Mark as done"
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div className="cl-row" style={{ gap: 6, marginBottom: 2 }}>
                          {t.jiraKey && (
                            <a
                              href={t.jiraUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: 'var(--accent, #0a7aff)',
                                backgroundColor: 'rgba(10, 122, 255, 0.12)',
                                padding: '1px 5px',
                                borderRadius: 3,
                                textDecoration: 'none',
                              }}
                            >
                              {t.jiraKey}
                            </a>
                          )}
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--ink)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {t.title}
                          </span>
                        </div>
                        <div className="cl-row" style={{ gap: 8, fontSize: 11, color: 'var(--ink-2)' }}>
                          {proj && <span style={{ fontWeight: 500 }}>{proj.name}</span>}
                          {t.dueDate && (
                            <span style={{ color: isOverdue ? '#ef4444' : isDueToday ? 'var(--accent)' : 'var(--ink-2)', fontWeight: isOverdue || isDueToday ? 600 : 400 }}>
                              {isDueToday ? 'Due today' : isOverdue ? `Overdue (${t.dueDate})` : `Due ${t.dueDate}`}
                            </span>
                          )}
                          <span style={{ textTransform: 'capitalize' }}>{t.priority} priority</span>
                        </div>
                      </div>
                    </div>
                    <StatusPill status={t.status} />
                  </div>
                );
              })
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 12px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-3)' }}>
                  All Kanban tasks completed! 🎉
                </p>
                <Button size="sm" variant="secondary" icon="plus" onClick={() => setActiveView('kanban')}>
                  Add Kanban Task
                </Button>
              </div>
            )}
          </div>

          {/* Quick add directly to Kanban */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <div className="cl-row" style={{ gap: 8 }}>
              <input
                type="text"
                placeholder="Add task to Kanban..."
                value={newKanbanText}
                onChange={(e) => setNewKanbanText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddQuickKanbanTask();
                }}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  fontSize: 12.5,
                  background: 'var(--canvas)',
                  color: 'var(--ink)',
                }}
              />
              <Button size="sm" variant="ghost" icon="plus" onClick={handleAddQuickKanbanTask}>
                Add
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Projects Section (Retrieved Directly from Projects Hub) */}
      <div className="cl-section" style={{ marginTop: 32 }}>
        <SectionHeader
          title="Active projects"
          icon="hub"
          count={projects.length}
          actions={
            <Button variant="ghost" size="sm" iconRight="chevron-right" onClick={() => setActiveView('projects')}>
              Project Hub
            </Button>
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {projects.map((proj) => {
            const projTasks = kanbanTasks.filter(
              (t) => t.projectId === proj.id || (proj.jiraKey && (t.projectId === proj.jiraKey || t.jiraKey?.startsWith(proj.jiraKey)))
            );
            const doneTasks = projTasks.filter((t) => t.status === 'done').length;
            const openTasks = projTasks.length - doneTasks;
            const progress = projTasks.length > 0 ? Math.round((doneTasks / projTasks.length) * 100) : 0;
            const status = progress === 100 && projTasks.length > 0 ? 'done' : openTasks > 0 ? 'inprogress' : 'todo';
            const context = proj.jiraKey ? `Jira · ${proj.jiraKey}` : 'Local Project';
            const activity = proj.jiraKey
              ? `${openTasks} open Jira issues`
              : `${openTasks} open tasks`;

            return (
              <ProjectCard
                key={proj.id}
                name={proj.name}
                context={context}
                description={proj.description}
                color={proj.color || 'sky'}
                starred={!!proj.jiraKey}
                status={status}
                activity={activity}
                progress={progress}
                onClick={() => {
                  setSelectedProjectId(proj.id);
                  setActiveView('projects');
                }}
              />
            );
          })}
          <AddTile label="New project" onClick={() => setShowAddProjModal(true)} />
        </div>
      </div>

      {/* Recent Notebooks & Papers Section */}
      <div className="cl-section" style={{ marginTop: 32 }}>
        <SectionHeader title="Recent notebooks & papers" icon="notebook" count={files.length} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {recentFiles.length > 0 ? (
            recentFiles.map((f) => (
              <NoteCard
                key={f.id}
                title={f.name}
                kind={f.type === 'pdf' ? 'pdf' : f.type === 'notebook' ? 'notebook' : 'markdown'}
                body={`Document in ${f.folderId ? 'folder' : 'root workspace'}. Click to view on canvas.`}
                updated="Recently"
                onClick={() => {
                  setActiveDocument(f.id);
                  setActiveView('canvas');
                }}
              />
            ))
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)', border: '1px dashed var(--line)', borderRadius: 'var(--radius)', gridColumn: 'span 3' }}>
              No notebooks or papers yet. Click "New note" above or import papers from arXiv.
            </div>
          )}
        </div>
      </div>

      {/* Modal for Creating New Project */}
      {showAddProjModal && (
        <Modal
          title="Create new project"
          description="Group your research papers, notes, and kanban tasks under a unified project."
          onClose={() => setShowAddProjModal(false)}
          footer={
            <>
              <Button onClick={() => setShowAddProjModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateProject}>
                Create project
              </Button>
            </>
          }
        >
          <TextField label="Project name" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} placeholder="e.g. Molecular Generation Review" />
          <TextField label="Description" value={newProjDesc} onChange={(e) => setNewProjDesc(e.target.value)} placeholder="Brief summary of research goals…" multiline />
          <div style={{ marginTop: 12 }}>
            <span className="cl-field-label" style={{ display: 'block', marginBottom: 6 }}>
              Link to Jira Project (Optional)
            </span>
            {availableJiraProjects.length > 0 ? (
              <select
                value={newProjJiraKey}
                onChange={(e) => {
                  setNewProjJiraKey(e.target.value);
                  if (!newProjName && e.target.value) {
                    const found = availableJiraProjects.find((jp) => jp.key === e.target.value);
                    if (found) setNewProjName(found.name);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-raised)',
                  color: 'var(--ink)',
                  fontSize: 13,
                }}
              >
                <option value="">None (Local Clio Project only)</option>
                {availableJiraProjects.map((jp) => (
                  <option key={jp.key} value={jp.key}>
                    {jp.key} — {jp.name}
                  </option>
                ))}
              </select>
            ) : (
              <TextField
                label=""
                value={newProjJiraKey}
                onChange={(e) => setNewProjJiraKey(e.target.value)}
                placeholder="e.g. KAN or EREUNA"
              />
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <span className="cl-field-label" style={{ display: 'block', marginBottom: 8 }}>
              Project theme colour
            </span>
            <ColorPicker colors={PROJECT_COLORS} value={newProjColor} onChange={(c) => setNewProjColor(c)} />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default HomeDashboard;
