import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useAppStore } from '../../store/appStore';
import type { KanbanTask } from '../../store/appStore';
import TaskDetailModal from './TaskDetailModal';
import {
  fetchJiraConfig,
  saveJiraConfig,
  testJiraConnection,
  fetchJiraProjects,
  fetchJiraIssues,
  createJiraIssue,
  transitionJiraIssue,
  type JiraConfig,
  type JiraProject,
} from '../../services/jiraService';
import {
  ViewHeader,
  KanbanColumn,
  TaskCard as ClioTaskCard,
  Button,
  IconButton,
  Modal,
  TextField,
  SegmentedControl,
} from '../UI/clio';

const COLUMN_TYPES: KanbanTask['status'][] = ['todo', 'inprogress', 'review', 'done'];

const DraggableTask: React.FC<{
  task: KanbanTask;
  projectColor?: string;
  projectName?: string;
  onOpen: () => void;
  isDragging?: boolean;
}> = ({ task, projectColor, projectName, onOpen, isDragging }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <ClioTaskCard
        id={task.jiraKey || task.id}
        title={task.title}
        description={task.description}
        priority={task.priority}
        due={task.dueDate}
        dueState={task.dueDate === new Date().toISOString().split('T')[0] ? 'soon' : undefined}
        project={task.jiraKey ? `Jira · ${task.jiraStatusName || 'Task'}` : (projectName || 'Clio')}
        projectColor={task.jiraKey ? 'sky' : (projectColor || 'sky')}
        dragging={isDragging}
        onOpen={onOpen}
      />
    </div>
  );
};

const DroppableColumn: React.FC<{
  status: KanbanTask['status'];
  tasks: KanbanTask[];
  getProjectInfo: (projId: string) => { name: string; color: string };
  onAdd: () => void;
  onTaskClick: (t: KanbanTask) => void;
  activeId: string | null;
}> = ({ status, tasks, getProjectInfo, onAdd, onTaskClick, activeId }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div ref={setNodeRef} style={{ height: '100%' }}>
      <KanbanColumn status={status} count={tasks.length} over={isOver} onAdd={onAdd}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tasks.map((task) => {
            const proj = getProjectInfo(task.projectId);
            return (
              <DraggableTask
                key={task.id}
                task={task}
                projectName={proj.name}
                projectColor={proj.color}
                onOpen={() => onTaskClick(task)}
                isDragging={activeId === task.id}
              />
            );
          })}
        </div>
      </KanbanColumn>
    </div>
  );
};

const KanbanBoard: React.FC = () => {
  const {
    projects,
    kanbanTasks,
    addKanbanTask,
    updateKanbanTask,
    deleteKanbanTask,
    mergeJiraTasks,
    selectedProjectId,
  } = useAppStore();

  const [activeProjFilter, setActiveProjFilter] = useState<string>(selectedProjectId || 'all');
  const [showAddModal, setShowAddModal] = useState<KanbanTask['status'] | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<KanbanTask['priority']>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [createOnJira, setCreateOnJira] = useState(false);

  const [detailTask, setDetailTask] = useState<KanbanTask | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Jira Integration State
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);
  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [isSyncingJira, setIsSyncingJira] = useState(false);
  const [jiraNotice, setJiraNotice] = useState<string | null>(null);

  // Form states in Jira Settings modal
  const [modalHost, setModalHost] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalToken, setModalToken] = useState('');
  const [modalProject, setModalProject] = useState('');
  const [isTestingJira, setIsTestingJira] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Load Jira config on mount
  useEffect(() => {
    fetchJiraConfig()
      .then((cfg) => {
        setJiraConfig(cfg);
        setModalHost(cfg.host || '');
        setModalEmail(cfg.email || import.meta.env.VITE_USER_EMAIL || '');
        setModalProject(cfg.projectKey || '');
      })
      .catch((err) => console.warn('Could not load Jira config:', err.message));
  }, []);

  const handleSyncJira = async () => {
    if (!jiraConfig?.host) {
      setShowJiraModal(true);
      return;
    }
    setIsSyncingJira(true);
    setJiraNotice(null);
    try {
      const issues = await fetchJiraIssues();
      mergeJiraTasks(issues);
      setJiraNotice(`Synced ${issues.length} Jira tickets successfully.`);
      setTimeout(() => setJiraNotice(null), 4000);
    } catch (err: any) {
      setJiraNotice(`Jira sync error: ${err.message}`);
    } finally {
      setIsSyncingJira(false);
    }
  };

  const handleSaveJiraSettings = async () => {
    try {
      const payload: any = {
        host: modalHost.trim(),
        email: modalEmail.trim(),
        projectKey: modalProject.trim(),
        syncEnabled: true,
      };
      if (modalToken.trim()) {
        payload.apiToken = modalToken.trim();
      }
      const res = await saveJiraConfig(payload);
      setJiraConfig(res.config);
      setShowJiraModal(false);
      setJiraNotice('Jira settings saved. Syncing tasks...');
      // Automatically sync
      handleSyncJira();
    } catch (err: any) {
      alert(`Failed to save Jira settings: ${err.message}`);
    }
  };

  const handleTestJira = async () => {
    setIsTestingJira(true);
    try {
      // Temporarily save host/email/token if changed
      if (modalHost !== jiraConfig?.host || (modalToken && modalToken.length > 0)) {
        await saveJiraConfig({
          host: modalHost.trim(),
          email: modalEmail.trim(),
          apiToken: modalToken.trim() || undefined,
        });
      }
      const res = await testJiraConnection();
      const projectsList = await fetchJiraProjects();
      setJiraProjects(projectsList);
      if (projectsList.length > 0 && !modalProject) {
        setModalProject(projectsList[0].key);
      }
      alert(`Success! Connected as: ${res.user?.displayName} (${res.user?.emailAddress})`);
    } catch (err: any) {
      alert(`Connection test failed: ${err.message}`);
    } finally {
      setIsTestingJira(false);
    }
  };

  const getProjectInfo = (projId: string) => {
    const p = projects.find((proj) => proj.id === projId);
    return { name: p ? p.name : 'General', color: p?.color || 'sky' };
  };

  const filteredTasks = activeProjFilter === 'all' ? kanbanTasks : kanbanTasks.filter((t) => t.projectId === activeProjFilter);

  const activeTask = activeId ? kanbanTasks.find((t) => t.id === activeId) : null;

  const handleCreateTask = async (status: KanbanTask['status']) => {
    if (!taskTitle.trim()) return;
    const targetProjId = activeProjFilter === 'all' ? projects[0]?.id || 'proj-general' : activeProjFilter;
    
    let jiraKey: string | undefined;
    let jiraUrl: string | undefined;

    if (createOnJira && jiraConfig?.host) {
      try {
        const res = await createJiraIssue({
          title: taskTitle,
          description: taskDesc,
          dueDate: taskDueDate || undefined,
          projectKey: jiraConfig.projectKey,
        });
        if (res.ok) {
          jiraKey = res.issue.jiraKey;
          jiraUrl = res.issue.jiraUrl;
        }
      } catch (err: any) {
        console.warn('Could not create on Jira:', err.message);
      }
    }

    addKanbanTask({
      id: jiraKey || `CLIO-${Math.floor(10 + Math.random() * 90)}`,
      jiraKey,
      jiraUrl,
      projectId: targetProjId,
      title: taskTitle,
      description: taskDesc,
      status,
      priority: taskPriority,
      dueDate: taskDueDate || undefined,
      createdAt: new Date().toISOString(),
      comments: [],
    });

    setTaskTitle('');
    setTaskDesc('');
    setTaskDueDate('');
    setCreateOnJira(false);
    setShowAddModal(null);
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const targetCol = over.id as KanbanTask['status'];
    if (COLUMN_TYPES.includes(targetCol)) {
      const taskId = active.id as string;
      const currentTask = kanbanTasks.find((t) => t.id === taskId);
      
      // Update local state immediately for snappy UI
      updateKanbanTask(taskId, { status: targetCol });

      // If linked to Jira, transition on Jira Cloud in background
      if (currentTask?.jiraKey) {
        try {
          await transitionJiraIssue(currentTask.jiraKey, targetCol);
        } catch (err: any) {
          console.warn(`Jira transition error for ${currentTask.jiraKey}:`, err.message);
        }
      }
    }
  };

  return (
    <div className="cl-view" style={{ padding: '32px 40px', width: '100%', boxSizing: 'border-box' }}>
      {/* View Header */}
      <ViewHeader
        title="Kanban Board"
        subtitle="Track research tasks from idea to done, with direct Jira workflow sync."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Jira Status & Sync Button */}
            <Button
              variant={jiraConfig?.host ? 'secondary' : 'ghost'}
              size="sm"
              icon="refresh"
              onClick={handleSyncJira}
              disabled={isSyncingJira}
            >
              {isSyncingJira ? 'Syncing...' : jiraConfig?.host ? 'Sync Jira' : 'Connect Jira'}
            </Button>

            <IconButton
              icon="settings"
              label="Jira configuration"
              outlined
              onClick={() => setShowJiraModal(true)}
            />

            <SegmentedControl
              value={activeProjFilter}
              onChange={(v) => setActiveProjFilter(v)}
              options={[
                { value: 'all', label: 'All projects' },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <Button variant="primary" icon="plus" onClick={() => setShowAddModal('todo')}>
              New task
            </Button>
          </div>
        }
      />

      {/* Sync Status Banner */}
      {jiraNotice && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 16px',
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
          <span>{jiraNotice}</span>
          <button
            onClick={() => setJiraNotice(null)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Kanban Board Columns Grid */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginTop: 24, alignItems: 'start' }}>
          {COLUMN_TYPES.map((colStatus) => {
            const colTasks = filteredTasks.filter((t) => t.status === colStatus);
            return (
              <DroppableColumn
                key={colStatus}
                status={colStatus}
                tasks={colTasks}
                getProjectInfo={getProjectInfo}
                onAdd={() => setShowAddModal(colStatus)}
                onTaskClick={(t) => setDetailTask(t)}
                activeId={activeId}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <ClioTaskCard
              id={activeTask.jiraKey || activeTask.id}
              title={activeTask.title}
              description={activeTask.description}
              priority={activeTask.priority}
              due={activeTask.dueDate}
              project={activeTask.jiraKey ? 'Jira' : getProjectInfo(activeTask.projectId).name}
              projectColor={activeTask.jiraKey ? 'sky' : getProjectInfo(activeTask.projectId).color}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add Task Modal */}
      {showAddModal && (
        <Modal
          title="New Task"
          description={`Add a task to the ${showAddModal.toUpperCase()} column.`}
          onClose={() => setShowAddModal(null)}
          footer={
            <>
              <Button onClick={() => setShowAddModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => handleCreateTask(showAddModal)}>
                Create task
              </Button>
            </>
          }
        >
          <TextField
            label="Task title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="e.g. Extract hyperparameters from 12 papers"
          />
          <TextField
            label="Description"
            value={taskDesc}
            onChange={(e) => setTaskDesc(e.target.value)}
            placeholder="Optional context, steps, or notes"
            multiline
            rows={2}
          />

          <div>
            <span className="cl-field-label" style={{ display: 'block', marginBottom: 6 }}>
              Priority
            </span>
            <SegmentedControl
              value={taskPriority}
              onChange={(v) => setTaskPriority(v as any)}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
            />
          </div>

          <TextField label="Due date" type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />

          {jiraConfig?.host && (
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                <input
                  type="checkbox"
                  checked={createOnJira}
                  onChange={(e) => setCreateOnJira(e.target.checked)}
                />
                <span>Also create as ticket in Jira ({jiraConfig.projectKey || 'default project'})</span>
              </label>
            </div>
          )}
        </Modal>
      )}

      {/* Jira Settings Modal */}
      {showJiraModal && (
        <Modal
          title="Jira Cloud Integration"
          description="Connect your Jira Cloud instance to sync tasks and workflow transitions."
          onClose={() => setShowJiraModal(false)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={handleTestJira}
                disabled={isTestingJira || !modalHost}
              >
                {isTestingJira ? 'Testing...' : 'Test connection'}
              </Button>
              <div style={{ flex: 1 }} />
              <Button onClick={() => setShowJiraModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveJiraSettings} disabled={!modalHost}>
                Save & Connect
              </Button>
            </>
          }
        >
          <TextField
            label="Jira Domain / Host"
            value={modalHost}
            onChange={(e) => setModalHost(e.target.value)}
            placeholder="e.g. your-company.atlassian.net"
          />
          <TextField
            label="Atlassian Account Email"
            value={modalEmail}
            onChange={(e) => setModalEmail(e.target.value)}
            placeholder="user@example.com"
          />
          <TextField
            label="Jira API Token"
            type="password"
            value={modalToken}
            onChange={(e) => setModalToken(e.target.value)}
            placeholder={jiraConfig?.hasToken ? '(Token configured. Enter new token to overwrite)' : 'Enter Jira API token'}
          />

          <div style={{ marginTop: 8 }}>
            <TextField
              label="Project Key (optional filter)"
              value={modalProject}
              onChange={(e) => setModalProject(e.target.value.toUpperCase())}
              placeholder="e.g. RES, PROJ, CLIO"
            />
            {jiraProjects.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Found projects:</span>
                {jiraProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setModalProject(p.key)}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--line)',
                      backgroundColor: modalProject === p.key ? 'var(--ink)' : 'transparent',
                      color: modalProject === p.key ? 'var(--canvas)' : 'var(--ink)',
                      cursor: 'pointer',
                    }}
                  >
                    {p.name} ({p.key})
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Task Detail Modal with Communications */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          projectName={getProjectInfo(detailTask.projectId).name}
          onClose={() => setDetailTask(null)}
          onUpdate={(updated) => updateKanbanTask(detailTask.id, updated)}
          onDelete={() => {
            deleteKanbanTask(detailTask.id);
            setDetailTask(null);
          }}
        />
      )}
    </div>
  );
};

export default KanbanBoard;
