import React, { useState } from 'react';
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
  ViewHeader,
  KanbanColumn,
  TaskCard as ClioTaskCard,
  Button,
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
        id={task.id}
        title={task.title}
        description={task.description}
        priority={task.priority}
        due={task.dueDate}
        dueState={task.dueDate === new Date().toISOString().split('T')[0] ? 'soon' : undefined}
        project={projectName || 'Clio'}
        projectColor={projectColor || 'sky'}
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
    selectedProjectId,
  } = useAppStore();

  const [activeProjFilter, setActiveProjFilter] = useState<string>(selectedProjectId || 'all');
  const [showAddModal, setShowAddModal] = useState<KanbanTask['status'] | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<KanbanTask['priority']>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');

  const [detailTask, setDetailTask] = useState<KanbanTask | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const getProjectInfo = (projId: string) => {
    const p = projects.find((proj) => proj.id === projId);
    return { name: p ? p.name : 'General', color: p?.color || 'sky' };
  };

  const filteredTasks = activeProjFilter === 'all' ? kanbanTasks : kanbanTasks.filter((t) => t.projectId === activeProjFilter);

  const activeTask = activeId ? kanbanTasks.find((t) => t.id === activeId) : null;

  const handleCreateTask = (status: KanbanTask['status']) => {
    if (!taskTitle.trim()) return;
    const targetProjId = activeProjFilter === 'all' ? projects[0]?.id || 'proj-general' : activeProjFilter;
    addKanbanTask({
      id: `CLIO-${Math.floor(10 + Math.random() * 90)}`,
      projectId: targetProjId,
      title: taskTitle,
      description: taskDesc,
      status,
      priority: taskPriority,
      dueDate: taskDueDate || undefined,
      createdAt: new Date().toISOString(),
    });
    setTaskTitle('');
    setTaskDesc('');
    setTaskDueDate('');
    setShowAddModal(null);
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const targetCol = over.id as KanbanTask['status'];
    if (COLUMN_TYPES.includes(targetCol)) {
      updateKanbanTask(active.id as string, { status: targetCol });
    }
  };

  return (
    <div className="cl-view" style={{ padding: '32px 40px', width: '100%', boxSizing: 'border-box' }}>
      {/* View Header */}
      <ViewHeader
        title="Kanban Board"
        subtitle="Track research tasks from idea to done."
        actions={
          <>
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
          </>
        }
      />

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
              id={activeTask.id}
              title={activeTask.title}
              description={activeTask.description}
              priority={activeTask.priority}
              due={activeTask.dueDate}
              project={getProjectInfo(activeTask.projectId).name}
              projectColor={getProjectInfo(activeTask.projectId).color}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* New Task Modal */}
      {showAddModal && (
        <Modal
          title={`New task in ${showAddModal.toUpperCase()}`}
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
          <TextField label="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Extract hyperparameters from 12 papers" />
          <TextField label="Description" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Details..." multiline />
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
        </Modal>
      )}

      {/* Task Detail Modal */}
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
