import React, { useState } from 'react';
import type { KanbanTask } from '../../store/appStore';
import { Modal, TextField, Button, SegmentedControl } from '../UI/clio';

interface Props {
  task: KanbanTask;
  projectName?: string;
  onClose: () => void;
  onUpdate: (updated: Partial<KanbanTask>) => void;
  onDelete: () => void;
}

const TaskDetailModal: React.FC<Props> = ({ task, projectName, onClose, onUpdate, onDelete }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<KanbanTask['priority']>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [status, setStatus] = useState<KanbanTask['status']>(task.status);

  const handleSave = () => {
    onUpdate({ title, description, priority, dueDate: dueDate || undefined, status });
    onClose();
  };

  return (
    <Modal
      title={`Task ${task.id}`}
      description={projectName ? `Project: ${projectName}` : 'Research Task Details'}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" icon="trash" onClick={() => { if (confirm('Delete this task?')) onDelete(); }}>
            Delete
          </Button>
          <div style={{ flex: 1 }} />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>
            Save changes
          </Button>
        </>
      }
    >
      <TextField label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={3} />
      
      <div>
        <span className="cl-field-label" style={{ display: 'block', marginBottom: 6 }}>
          Priority
        </span>
        <SegmentedControl
          value={priority}
          onChange={(v) => setPriority(v as any)}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
      </div>

      <div>
        <span className="cl-field-label" style={{ display: 'block', marginBottom: 6 }}>
          Status
        </span>
        <SegmentedControl
          value={status}
          onChange={(v) => setStatus(v as any)}
          options={[
            { value: 'todo', label: 'To do' },
            { value: 'inprogress', label: 'In progress' },
            { value: 'review', label: 'Review' },
            { value: 'done', label: 'Completed' },
          ]}
        />
      </div>

      <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
    </Modal>
  );
};

export default TaskDetailModal;
