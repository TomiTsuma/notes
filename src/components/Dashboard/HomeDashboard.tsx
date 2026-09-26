import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';
import {
  ViewHeader,
  SectionHeader,
  QuickActions,
  StreakCard,
  AgendaItem,
  DailyCard,
  ProjectCard,
  NoteCard,
  AddTile,
  Card,
  CardTitle,
  Button,
  Modal,
  TextField,
  ColorPicker,
  PROJECT_COLORS,
} from '../UI/clio';

const HomeDashboard: React.FC = () => {
  const {
    projects,
    files,
    kanbanTasks,
    calendarEvents,
    userStreak,
    dailyTodos,
    addDailyTodo,
    toggleDailyTodo,
    setActiveView,
    setActiveDocument,
    addProject,
    addFile,
  } = useAppStore();

  const [showAddProjModal, setShowAddProjModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjColor, setNewProjColor] = useState('sky');

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvents = calendarEvents.filter((ev) => ev.date === todayStr);

  const getGreetingDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    addProject({
      id: `proj-${uuidv4().substring(0, 8)}`,
      name: newProjName,
      description: newProjDesc,
      color: newProjColor,
      createdAt: new Date().toISOString(),
    });

    setNewProjName('');
    setNewProjDesc('');
    setShowAddProjModal(false);
  };

  const handleCreateNote = () => {
    const name = prompt('Note title:');
    if (!name) return;
    const newFile = {
      id: 'file-' + Date.now(),
      name,
      type: 'notebook',
      folderId: null,
    };
    addFile(newFile);
    setActiveDocument(newFile.id);
    setActiveView('canvas');
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

  const dueTasksCount = kanbanTasks.filter((t) => t.status !== 'done').length;
  const pdfCount = files.filter((f) => f.type === 'pdf').length;
  const recentFiles = files.slice(0, 3);

  const handleAddTodoItem = (text: string) => {
    addDailyTodo({
      id: `todo-${uuidv4().substring(0, 8)}`,
      text,
      completed: false,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      dueTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  return (
    <div className="cl-view" style={{ padding: '32px 40px', width: '100%', boxSizing: 'border-box' }}>
      {/* View Header */}
      <ViewHeader
        overline={getGreetingDate()}
        title="Good afternoon, Thomas"
        subtitle={`${dueTasksCount} tasks due · ${pdfCount} papers waiting in your library.`}
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

      {/* Top 3-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr 1.15fr', gap: 20, marginTop: 24, alignItems: 'start' }}>
        {/* Streak Card */}
        <StreakCard
          days={userStreak.streakCount || 1}
          week={[1, 1, 1, 1, 1, 0, 0]}
          todayIndex={new Date().getDay() === 0 ? 6 : new Date().getDay() - 1}
          tasksDone={kanbanTasks.filter((t) => t.status === 'done').length}
          notesLogged={files.length}
        />

        {/* Today's Agenda */}
        <Card style={{ padding: '18px 20px 12px' }}>
          <CardTitle icon="calendar" title="Today’s agenda" actions={false} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todayEvents.length > 0 ? (
              todayEvents.map((ev) => (
                <AgendaItem
                  key={ev.id}
                  time={ev.startTime || '09:00'}
                  title={ev.title}
                  detail={ev.description || 'Calendar Event'}
                  tone="sky"
                />
              ))
            ) : (
              <>
                <AgendaItem time="09:00" title="Read GVT §4" detail="Molecular Gen" tone="lilac" done />
                <AgendaItem time="11:30" title="Lab meeting" detail="Room 204 · 45 min" tone="rose" />
                <AgendaItem time="14:30" title="Extraction sheet review" detail="Soil Spectra" tone="sage" />
                <AgendaItem time="17:00" title="Supervisor email" detail="MSc Dissertation" tone="sky" />
              </>
            )}
          </div>
        </Card>

        {/* Daily Tasks Card */}
        <DailyCard
          date={todayStr}
          tasksTitle="Today’s tasks"
          tasks={dailyTodos.map((t) => ({
            id: t.id,
            text: t.text,
            completed: t.completed,
            dueTime: t.dueTime,
          }))}
          showAdd
          footer={`${dailyTodos.length} tasks · ${dailyTodos.filter((t) => t.completed).length} done`}
          onToggleItem={(i) => {
            const item = dailyTodos[i];
            if (item) toggleDailyTodo(item.id);
          }}
          onAddItem={handleAddTodoItem}
        />
      </div>

      {/* Active Projects Section */}
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
          {projects.map((proj) => (
            <ProjectCard
              key={proj.id}
              name={proj.name}
              description={proj.description}
              color={proj.color || 'sky'}
              starred
              status="inprogress"
              activity="Active recently"
              progress={65}
              onClick={() => setActiveView('projects')}
            />
          ))}
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
                updated="Just now"
                onClick={() => {
                  setActiveDocument(f.id);
                  setActiveView('canvas');
                }}
              />
            ))
          ) : (
            <>
              <NoteCard
                title="Reading log"
                kind="notebook"
                body="GVT beats EDM on validity at 40× fewer sampling steps."
                updated="Just now"
                tags={[{ name: 'results', color: 'sage' }]}
              />
              <NoteCard
                title="GVT annotations"
                kind="pdf"
                subtitle="12 highlights"
                body="Codebook size 512 — check the ablation in table 6."
                updated="1h ago"
              />
              <NoteCard
                title="Supervisor meeting"
                kind="markdown"
                body="Narrow scope to 2020–2026. Add an evaluation-metrics table."
                updated="Yesterday"
                tags={[{ name: 'meeting', color: 'rose' }]}
              />
            </>
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
          <div>
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
