import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';
import {
  ViewHeader,
  SectionHeader,
  SegmentedControl,
  SearchField,
  Button,
  IconButton,
  ProjectCard,
  ProjectRow,
  AddTile,
  NoteCard,
  Tag,
  StatusPill,
  ProgressDots,
  Card,
  CardTitle,
  Modal,
  TextField,
  ColorPicker,
  PROJECT_COLORS,
} from '../UI/clio';

const ProjectsSection: React.FC = () => {
  const {
    projects,
    files,
    kanbanTasks,
    selectedProjectId,
    setSelectedProjectId,
    deleteProject,
    updateProject,
    addProject,
    addFile,
    setActiveDocument,
    setActiveView,
  } = useAppStore();

  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [filterTab, setFilterTab] = useState<'all' | 'star' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showNewProjModal, setShowNewProjModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjColor, setNewProjColor] = useState('sky');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('sky');

  const selectedProj = projects.find((p) => p.id === selectedProjectId) || null;

  const handleCreateProject = () => {
    if (!newProjName.trim()) return;
    const newProj = {
      id: `proj-${uuidv4().substring(0, 8)}`,
      name: newProjName,
      description: newProjDesc,
      color: newProjColor,
      createdAt: new Date().toISOString(),
    };
    addProject(newProj);
    setNewProjName('');
    setNewProjDesc('');
    setShowNewProjModal(false);
  };

  const handleSaveEdit = () => {
    if (!selectedProj) return;
    updateProject(selectedProj.id, {
      name: editName,
      description: editDesc,
      color: editColor,
    });
    setIsEditing(false);
  };

  const handleDeleteProj = () => {
    if (!selectedProj) return;
    if (confirm(`Are you sure you want to delete project '${selectedProj.name}'?`)) {
      deleteProject(selectedProj.id);
      setSelectedProjectId(null);
    }
  };

  const handleCreateNote = () => {
    if (!selectedProj) return;
    const name = prompt('Note title:');
    if (!name) return;
    const newFile = {
      id: 'file-' + Date.now(),
      name,
      type: 'notebook',
      folderId: null,
      projectId: selectedProj.id,
    };
    addFile(newFile);
    setActiveDocument(newFile.id);
    setActiveView('canvas');
  };

  const filteredProjects = projects.filter((p) => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterTab === 'star') return p.id === 'proj-1';
    return true;
  });

  const unsortedFiles = files.filter((f) => !f.projectId);

  if (selectedProj) {
    const projFiles = files.filter((f) => f.projectId === selectedProj.id);
    const projTasks = kanbanTasks.filter((t) => t.projectId === selectedProj.id);
    const completedTasks = projTasks.filter((t) => t.status === 'done').length;
    const progressPercent = projTasks.length > 0 ? Math.round((completedTasks / projTasks.length) * 100) : 50;

    return (
      <div className="cl-view" style={{ padding: '32px 40px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 16 }}>
          <Button variant="ghost" size="sm" icon="chevron-left" onClick={() => setSelectedProjectId(null)}>
            Back to Project Hub
          </Button>
        </div>

        <div className={`cl-group w-${selectedProj.color || 'sky'}`} style={{ padding: '24px 28px', gap: 16, marginBottom: 24, borderRadius: 'var(--radius-lg)' }}>
          <div className="cl-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <div>
              <div className="cl-row" style={{ gap: 8, marginBottom: 8 }}>
                <Tag tone={selectedProj.color || 'sky'}>Research Project</Tag>
                <StatusPill status="inprogress" />
              </div>
              <h1 className="cl-h-display">{selectedProj.name}</h1>
              <p style={{ margin: '6px 0 0', color: 'var(--ink-2)', maxWidth: 620 }}>{selectedProj.description || 'Project workspace for papers, notes, and tasks.'}</p>
            </div>
            <div className="cl-row" style={{ flexWrap: 'nowrap' }}>
              <Button
                icon="pencil"
                onClick={() => {
                  setEditName(selectedProj.name);
                  setEditDesc(selectedProj.description);
                  setEditColor(selectedProj.color || 'sky');
                  setIsEditing(true);
                }}
              >
                Edit
              </Button>
              <Button variant="primary" icon="plus" onClick={handleCreateNote}>
                New note
              </Button>
              <IconButton icon="trash" label="Delete project" onClick={handleDeleteProj} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
            <Card className="cl-stat" style={{ padding: '12px 16px' }}>
              <span className="cl-overline">Notebooks</span>
              <div className="v" style={{ fontSize: 24, margin: 0 }}>
                {projFiles.length}
              </div>
            </Card>
            <Card className="cl-stat" style={{ padding: '12px 16px' }}>
              <span className="cl-overline">Linked files</span>
              <div className="v" style={{ fontSize: 24, margin: 0 }}>
                {projFiles.filter((f) => f.type === 'pdf').length}
              </div>
            </Card>
            <Card className="cl-stat" style={{ padding: '12px 16px' }}>
              <span className="cl-overline">Open tasks</span>
              <div className="v" style={{ fontSize: 24, margin: 0 }}>
                {projTasks.filter((t) => t.status !== 'done').length}
              </div>
            </Card>
            <Card style={{ padding: '12px 16px' }} className={`w-${selectedProj.color || 'sky'}`}>
              <ProgressDots value={progressPercent} total={14} label="Kanban progress" />
            </Card>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <SectionHeader
              title="Notebooks & notes"
              icon="notebook"
              actions={
                <Button size="sm" icon="plus" onClick={handleCreateNote}>
                  New notebook
                </Button>
              }
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
              {projFiles.length > 0 ? (
                projFiles.map((f) => (
                  <NoteCard
                    key={f.id}
                    title={f.name}
                    kind={f.type === 'pdf' ? 'pdf' : 'notebook'}
                    body={`Project file attached to ${selectedProj.name}.`}
                    updated="Today"
                    onClick={() => {
                      setActiveDocument(f.id);
                      setActiveView('canvas');
                    }}
                  />
                ))
              ) : (
                <AddTile label="Add a note to this project" onClick={handleCreateNote} minHeight={150} />
              )}
            </div>
          </div>

          <div>
            <Card style={{ padding: 16 }}>
              <CardTitle icon="kanban" title="Kanban tasks" actions={false} />
              <div className="cl-col" style={{ gap: 10, marginTop: 12 }}>
                {projTasks.length > 0 ? (
                  projTasks.map((t) => (
                    <div
                      key={t.id}
                      className="cl-row"
                      style={{ justifyContent: 'space-between', flexWrap: 'nowrap', padding: '8px 0', borderTop: '1px solid var(--line)' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="cl-mono cl-faint">{t.id}</div>
                        <b style={{ fontSize: 13.5 }}>{t.title}</b>
                      </div>
                      <StatusPill status={t.status} />
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '8px 0' }}>No tasks linked yet. Create one on the Kanban board.</p>
                )}
              </div>
              <div style={{ marginTop: 12 }}>
                <Button variant="ghost" size="sm" iconRight="chevron-right" block onClick={() => setActiveView('kanban')}>
                  Open board
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {isEditing && (
          <Modal
            title="Edit project"
            onClose={() => setIsEditing(false)}
            footer={
              <>
                <Button onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSaveEdit}>
                  Save changes
                </Button>
              </>
            }
          >
            <TextField label="Project name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <TextField label="Description" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} multiline />
            <div>
              <span className="cl-field-label" style={{ display: 'block', marginBottom: 8 }}>
                Theme colour
              </span>
              <ColorPicker colors={PROJECT_COLORS} value={editColor} onChange={(c) => setEditColor(c)} />
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="cl-view" style={{ padding: '32px 40px', width: '100%', boxSizing: 'border-box' }}>
      <ViewHeader
        title="Project Hub"
        subtitle="Group notebooks, papers and tasks by what you’re working towards."
        actions={
          <>
            <SearchField placeholder="Search projects" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: 220 }} />
            <SegmentedControl
              iconOnly
              value={layoutMode}
              onChange={(v) => setLayoutMode(v as any)}
              options={[
                { value: 'grid', label: 'Grid view', icon: 'grid' },
                { value: 'list', label: 'List view', icon: 'list' },
              ]}
            />
            <Button variant="primary" icon="plus" onClick={() => setShowNewProjModal(true)}>
              New project
            </Button>
          </>
        }
      />

      <div className="cl-row" style={{ marginBottom: 20, marginTop: 16 }}>
        <SegmentedControl
          value={filterTab}
          onChange={(v) => setFilterTab(v as any)}
          options={[
            { value: 'all', label: `All · ${projects.length}` },
            { value: 'star', label: 'Starred' },
            { value: 'done', label: 'Completed' },
          ]}
        />
      </div>

      {layoutMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {filteredProjects.map((p) => (
            <ProjectCard
              key={p.id}
              name={p.name}
              context="Research Project"
              description={p.description}
              color={p.color || 'sky'}
              starred
              status="inprogress"
              activity="Active recently"
              progress={60}
              onClick={() => setSelectedProjectId(p.id)}
            />
          ))}
          <AddTile label="New project" onClick={() => setShowNewProjModal(true)} />
        </div>
      ) : (
        <div className="cl-col" style={{ gap: 8 }}>
          {filteredProjects.map((p) => (
            <ProjectRow
              key={p.id}
              name={p.name}
              context={p.description}
              color={p.color || 'sky'}
              starred
              status="inprogress"
              activity="Active recently"
              onClick={() => setSelectedProjectId(p.id)}
            />
          ))}
        </div>
      )}

      <div className="cl-section" style={{ marginTop: 36 }}>
        <SectionHeader title="Unsorted notes" icon="file" count={unsortedFiles.length} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 12 }}>
          {unsortedFiles.length > 0 ? (
            unsortedFiles.map((f) => (
              <NoteCard
                key={f.id}
                title={f.name}
                kind={f.type === 'pdf' ? 'pdf' : 'notebook'}
                body="Unsorted document in workspace."
                updated="Sep 22"
                onClick={() => {
                  setActiveDocument(f.id);
                  setActiveView('canvas');
                }}
              />
            ))
          ) : (
            <NoteCard title="Random ideas" body="Could a VQ codebook help retrieve similar soil spectra?" updated="Sep 22" />
          )}
        </div>
      </div>

      {showNewProjModal && (
        <Modal
          title="Create new project"
          onClose={() => setShowNewProjModal(false)}
          footer={
            <>
              <Button onClick={() => setShowNewProjModal(false)}>Cancel</Button>
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

export default ProjectsSection;
