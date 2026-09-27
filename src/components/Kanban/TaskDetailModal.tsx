import React, { useState } from 'react';
import type { KanbanTask, TaskComment } from '../../store/appStore';
import { useAppStore } from '../../store/appStore';
import { addJiraComment } from '../../services/jiraService';
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

  // Communications / comments
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>(task.comments || []);

  const addTaskComment = useAppStore((s) => s.addTaskComment);

  const handleSave = () => {
    onUpdate({
      title,
      description,
      priority,
      dueDate: dueDate || undefined,
      status,
      comments,
    });
    onClose();
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    const commentBody = newCommentText.trim();

    try {
      if (task.jiraKey) {
        // Send directly to Jira
        const res = await addJiraComment(task.jiraKey, commentBody);
        if (res.ok && res.comment) {
          const updated = [...comments, res.comment];
          setComments(updated);
          addTaskComment(task.id, res.comment);
        }
      } else {
        // Local comment
        const localComment: TaskComment = {
          id: `cmt-${Date.now()}`,
          author: 'You',
          body: commentBody,
          created: new Date().toISOString(),
        };
        const updated = [...comments, localComment];
        setComments(updated);
        addTaskComment(task.id, localComment);
      }
      setNewCommentText('');
    } catch (err: any) {
      alert(`Could not post comment: ${err.message}`);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <Modal
      title={task.jiraKey ? `Jira Task: ${task.jiraKey}` : `Task ${task.id}`}
      description={projectName ? `Project: ${projectName}` : 'Research Task Details'}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              if (confirm('Delete this task?')) onDelete();
            }}
          >
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
      {/* Jira Link Banner if linked */}
      {task.jiraKey && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 8,
            backgroundColor: 'rgba(0, 82, 204, 0.08)',
            border: '1px solid rgba(0, 82, 204, 0.2)',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                backgroundColor: '#0052cc',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              JIRA
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{task.jiraKey}</span>
            {task.jiraStatusName && (
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>({task.jiraStatusName})</span>
            )}
          </div>
          {task.jiraUrl && (
            <a
              href={task.jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: '#0052cc',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Open in Jira &rarr;
            </a>
          )}
        </div>
      )}

      <TextField label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        multiline
        rows={3}
        placeholder="Enter research objectives, context, or notes..."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
              { value: 'inprogress', label: 'In dev' },
              { value: 'review', label: 'Review' },
              { value: 'done', label: 'Done' },
            ]}
          />
        </div>
      </div>

      <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

      {/* Communications / Task Activity Section */}
      <div style={{ marginTop: 20, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            Communications & Comments ({comments.length})
          </span>
          {task.jiraKey && (
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Synced with Jira activity</span>
          )}
        </div>

        {/* Comment list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: 200,
            overflowY: 'auto',
            marginBottom: 12,
            paddingRight: 4,
          }}
        >
          {comments.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic', margin: '4px 0' }}>
              No comments or communications logged yet.
            </p>
          ) : (
            comments.map((cmt) => (
              <div
                key={cmt.id}
                style={{
                  backgroundColor: 'var(--surface-sunken, rgba(0,0,0,0.03))',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{cmt.author}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {new Date(cmt.created).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{cmt.body}</div>
              </div>
            ))
          )}
        </div>

        {/* Add comment input */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <TextField
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Write a message, update, or note..."
              multiline
              rows={2}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddComment}
            disabled={!newCommentText.trim() || isSubmittingComment}
            style={{ marginTop: 22 }}
          >
            {isSubmittingComment ? 'Posting...' : 'Post'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TaskDetailModal;
