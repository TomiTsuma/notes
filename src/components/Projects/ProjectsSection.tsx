import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { v4 as uuidv4 } from 'uuid';
import {
  fetchJiraConfig,
  fetchJiraProjects,
  fetchJiraIssues,
  type JiraConfig,
  type JiraProject,
} from '../../services/jiraService';
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
    mergeJiraProjects,
    mergeJiraTasks,
    addFile,
    setActiveDocument,
    setActiveView,
  } = useAppStore();

  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [filterTab, setFilterTab] = useState<'all' | 'jira' | 'local' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Jira Integration State in Projects Hub
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);
  const [availableJiraProjects, setAvailableJiraProjects] = useState<JiraProject[]>([]);
  const [isSyncingJira, setIsSyncingJira] = useState(false);
  const [jiraNotice, setJiraNotice] = useState<string | null>(null);

  const [showNewProjModal, setShowNewProjModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjColor, setNewProjColor] = useState('sky');
  const [newProjJiraKey, setNewProjJiraKey] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('sky');
  const [editJiraKey, setEditJiraKey] = useState('');

  // Fetch Jira config and projects on mount
  useEffect(() => {
    fetchJiraConfig()
      .then((cfg) => {
        setJiraConfig(cfg);
        if (cfg.host && cfg.hasToken) {
          return fetchJiraProjects().then((jProjects) => {
            setAvailableJiraProjects(jProjects);
            if (jProjects.length > 0) {
              mergeJiraProjects(jProjects, cfg.host);
            }
          });
        }
      })
      .catch((err) => console.warn('Could not load Jira info in ProjectsSection:', err.message));
  }, []);

  const handleSyncJiraProjects = async () => {
    setIsSyncingJira(true);
    setJiraNotice(null);
    try {
      const cfg = await fetchJiraConfig();
      setJiraConfig(cfg);
      const [jProjects, jIssues] = await Promise.all([
        fetchJiraProjects(),
        fetchJiraIssues(),
      ]);
      setAvailableJiraProjects(jProjects);
      mergeJiraProjects(jProjects, cfg.host);
      mergeJiraTasks(jIssues);
      setJiraNotice(`Synced ${jProjects.length} Jira project(s) and ${jIssues.length} issues.`);
      setTimeout(() => setJiraNotice(null), 4000);
    } catch (err: any) {
      setJiraNotice(`Jira sync error: ${err.message}`);
    } finally {
      setIsSyncingJira(false);
    }
  };

  const selectedProj = projects.find((p) => p.id === selectedProjectId) || null;

  const handleCreateProject = () => {
    if (!newProjName.trim()) return;
    const jiraKeyTrim = newProjJiraKey.trim().toUpperCase();
    const newProj = {
      id: `proj-${uuidv4().substring(0, 8)}`,
      name: newProjName,
      description: newProjDesc,
      color: newProjColor,
      createdAt: new Date().toISOString(),
      jiraKey: jiraKeyTrim || undefined,
      jiraUrl: jiraKeyTrim && jiraConfig?.host ? `https://${jiraConfig.host}/browse/${jiraKeyTrim}` : undefined,
      isJira: !!jiraKeyTrim,
    };
    addProject(newProj);
    setNewProjName('');
    setNewProjDesc('');
    setNewProjJiraKey('');
    setShowNewProjModal(false);
  };

  const handleSaveEdit = () => {
    if (!selectedProj) return;
    const jiraKeyTrim = editJiraKey.trim().toUpperCase();
    updateProject(selectedProj.id, {
      name: editName,
      description: editDesc,
      color: editColor,
      jiraKey: jiraKeyTrim || undefined,
      jiraUrl: jiraKeyTrim && jiraConfig?.host ? `https://${jiraConfig.host}/browse/${jiraKeyTrim}` : undefined,
      isJira: !!jiraKeyTrim,
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
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.jiraKey?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterTab === 'jira') return !!p.jiraKey;
    if (filterTab === 'local') return !p.jiraKey;
    if (filterTab === 'done') {
      const pTasks = kanbanTasks.filter((t) => t.projectId === p.id || (p.jiraKey && (t.projectId === p.jiraKey || t.jiraKey?.startsWith(p.jiraKey))));
      return pTasks.length > 0 && pTasks.every((t) => t.status === 'done');
    }
    return true;
  });

  const unsortedFiles = files.filter((f) => !f.projectId);

  if (selectedProj) {
    const projFiles = files.filter((f) => f.projectId === selectedProj.id);
    const projTasks = kanbanTasks.filter((t) =>
      t.projectId === selectedProj.id ||
      (selectedProj.jiraKey && (t.projectId === selectedProj.jiraKey || t.jiraKey?.startsWith(selectedProj.jiraKey)))
    );
    const completedTasks = projTasks.filter((t) => t.status === 'done').length;
    const progressPercent = projTasks.length > 0 ? Math.round((completedTasks / projTasks.length) * 100) : 0;

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
              <div className="cl-row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <Tag tone={selectedProj.color || 'sky'}>{selectedProj.jiraKey ? `Jira Project: ${selectedProj.jiraKey}` : 'Research Project'}</Tag>
                <StatusPill status={progressPercent === 100 && projTasks.length > 0 ? 'done' : projTasks.length > 0 ? 'inprogress' : 'todo'} />
                {selectedProj.jiraUrl && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="link"
                    onClick={() => window.open(selectedProj.jiraUrl, '_blank')}
                  >
                    Open in Jira
                  </Button>
                )}
                {selectedProj.jiraKey && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="refresh"
                    onClick={handleSyncJiraProjects}
                    disabled={isSyncingJira}
                  >
                    {isSyncingJira ? 'Syncing...' : 'Sync Jira Tasks'}
                  </Button>
                )}
              </div>
              <h1 className="cl-h-display">{selectedProj.name}</h1>
              <p style={{ margin: '6px 0 0', color: 'var(--ink-2)', maxWidth: 620 }}>
                {selectedProj.description || (selectedProj.jiraKey ? `Synchronized Jira project (${selectedProj.jiraKey}).` : 'Project workspace for papers, notes, and tasks.')}
              </p>
            </div>
            <div className="cl-row" style={{ flexWrap: 'nowrap' }}>
              <Button
                icon="pencil"
                onClick={() => {
                  setEditName(selectedProj.name);
                  setEditDesc(selectedProj.description);
                  setEditColor(selectedProj.color || 'sky');
                  setEditJiraKey(selectedProj.jiraKey || '');
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
              <span className="cl-overline">{selectedProj.jiraKey ? 'Open Jira issues' : 'Open tasks'}</span>
              <div className="v" style={{ fontSize: 24, margin: 0 }}>
                {projTasks.filter((t) => t.status !== 'done').length}
              </div>
            </Card>
            <Card style={{ padding: '12px 16px' }} className={`w-${selectedProj.color || 'sky'}`}>
              <ProgressDots value={progressPercent} total={14} label={selectedProj.jiraKey ? 'Jira completion' : 'Kanban progress'} />
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
              <CardTitle icon="kanban" title={selectedProj.jiraKey ? `Kanban & Jira tasks (${projTasks.length})` : `Kanban tasks (${projTasks.length})`} actions={false} />
              <div className="cl-col" style={{ gap: 10, marginTop: 12 }}>
                {projTasks.length > 0 ? (
                  projTasks.slice(0, 8).map((t) => (
                    <div
                      key={t.id}
                      className="cl-row"
                      style={{ justifyContent: 'space-between', flexWrap: 'nowrap', padding: '8px 0', borderTop: '1px solid var(--line)' }}
                    >
                      <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                        <div className="cl-row" style={{ gap: 6, marginBottom: 2 }}>
                          {t.jiraKey && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent, #0a7aff)', background: 'rgba(10,122,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>
                              {t.jiraKey}
                            </span>
                          )}
                          <span className="cl-mono cl-faint" style={{ fontSize: 11 }}>{t.id}</span>
                        </div>
                        <b style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title}
                        </b>
                      </div>
                      <StatusPill status={t.status} />
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '8px 0' }}>No tasks linked yet. Create one on the Kanban board.</p>
                )}
                {projTasks.length > 8 && (
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
                    +{projTasks.length - 8} more tasks on board
                  </span>
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
            <div style={{ marginTop: 12 }}>
              <span className="cl-field-label" style={{ display: 'block', marginBottom: 6 }}>
                Link to Jira Project (Optional)
              </span>
              {availableJiraProjects.length > 0 ? (
                <select
                  value={editJiraKey}
                  onChange={(e) => setEditJiraKey(e.target.value)}
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
                  value={editJiraKey}
                  onChange={(e) => setEditJiraKey(e.target.value)}
                  placeholder="e.g. KAN or EREUNA"
                />
              )}
            </div>
            <div style={{ marginTop: 12 }}>
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
        subtitle="Manage local research projects and synchronized Jira projects."
        actions={
          <>
            <SearchField placeholder="Search projects or Jira key" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: 220 }} />
            <SegmentedControl
              iconOnly
              value={layoutMode}
              onChange={(v) => setLayoutMode(v as any)}
              options={[
                { value: 'grid', label: 'Grid view', icon: 'grid' },
                { value: 'list', label: 'List view', icon: 'list' },
              ]}
            />
            <Button
              variant="secondary"
              icon="refresh"
              onClick={handleSyncJiraProjects}
              disabled={isSyncingJira}
            >
              {isSyncingJira ? 'Syncing...' : 'Sync Jira Projects'}
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setShowNewProjModal(true)}>
              New project
            </Button>
          </>
        }
      />

      {jiraNotice && (
        <div
          style={{
            marginTop: 16,
            marginBottom: 8,
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
          <span>{jiraNotice}</span>
          <button
            onClick={() => setJiraNotice(null)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)' }}
          >
            &times;
          </button>
        </div>
      )}

      <div className="cl-row" style={{ marginBottom: 20, marginTop: 16 }}>
        <SegmentedControl
          value={filterTab}
          onChange={(v) => setFilterTab(v as any)}
          options={[
            { value: 'all', label: `All · ${projects.length}` },
            { value: 'jira', label: `Jira (${projects.filter((p) => p.jiraKey).length})` },
            { value: 'local', label: `Local (${projects.filter((p) => !p.jiraKey).length})` },
            { value: 'done', label: 'Completed' },
          ]}
        />
      </div>

      {layoutMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {filteredProjects.map((p) => {
            const pTasks = kanbanTasks.filter((t) => t.projectId === p.id || (p.jiraKey && (t.projectId === p.jiraKey || t.jiraKey?.startsWith(p.jiraKey))));
            const pDone = pTasks.filter((t) => t.status === 'done').length;
            const progress = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
            const pOpen = pTasks.length - pDone;
            const context = p.jiraKey ? `Jira · ${p.jiraKey}` : 'Local Project';
            const activity = p.jiraKey
              ? `${pOpen} open Jira issues`
              : `${pOpen} open tasks`;
            const status = progress === 100 && pTasks.length > 0 ? 'done' : pOpen > 0 ? 'inprogress' : 'todo';

            return (
              <ProjectCard
                key={p.id}
                name={p.name}
                context={context}
                description={p.description}
                color={p.color || 'sky'}
                starred={!!p.jiraKey}
                status={status}
                activity={activity}
                progress={progress}
                onClick={() => setSelectedProjectId(p.id)}
              />
            );
          })}
          <AddTile label="New project" onClick={() => setShowNewProjModal(true)} />
        </div>
      ) : (
        <div className="cl-col" style={{ gap: 8 }}>
          {filteredProjects.map((p) => {
            const pTasks = kanbanTasks.filter((t) => t.projectId === p.id || (p.jiraKey && (t.projectId === p.jiraKey || t.jiraKey?.startsWith(p.jiraKey))));
            const pDone = pTasks.filter((t) => t.status === 'done').length;
            const pOpen = pTasks.length - pDone;
            const context = p.jiraKey ? `Jira: ${p.jiraKey} · ${p.description}` : p.description;
            const activity = p.jiraKey ? `${pOpen} open issues` : `${pOpen} open tasks`;

            return (
              <ProjectRow
                key={p.id}
                name={p.name}
                context={context}
                color={p.color || 'sky'}
                starred={!!p.jiraKey}
                status={pOpen > 0 ? 'inprogress' : 'done'}
                activity={activity}
                onClick={() => setSelectedProjectId(p.id)}
              />
            );
          })}
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
                updated="Recently"
                onClick={() => {
                  setActiveDocument(f.id);
                  setActiveView('canvas');
                }}
              />
            ))
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)', border: '1px dashed var(--line)', borderRadius: 'var(--radius)', gridColumn: 'span 3' }}>
              No unsorted files. All files are categorized under your projects.
            </div>
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

export default ProjectsSection;
