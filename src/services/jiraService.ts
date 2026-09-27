import type { KanbanTask, TaskComment } from '../store/appStore';

export interface JiraConfig {
  host: string;
  email: string;
  hasToken: boolean;
  projectKey: string;
  syncEnabled: boolean;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  avatarUrl?: string;
}

export async function fetchJiraConfig(): Promise<JiraConfig> {
  const res = await fetch('/api/jira/config');
  if (!res.ok) throw new Error('Failed to load Jira config');
  return res.json();
}

export async function saveJiraConfig(config: Partial<JiraConfig & { apiToken?: string }>): Promise<{ ok: boolean; config: JiraConfig }> {
  const res = await fetch('/api/jira/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to save Jira configuration');
  return res.json();
}

export async function testJiraConnection(): Promise<{ ok: boolean; user?: { displayName: string; emailAddress: string } }> {
  const res = await fetch('/api/jira/test');
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Connection failed' }));
    throw new Error(data.error || 'Connection failed');
  }
  return res.json();
}

export async function fetchJiraProjects(): Promise<JiraProject[]> {
  const res = await fetch('/api/jira/projects');
  if (!res.ok) throw new Error('Failed to fetch Jira projects');
  const data = await res.json();
  return data.projects || [];
}

export async function fetchJiraIssues(): Promise<KanbanTask[]> {
  const res = await fetch('/api/jira/issues');
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Failed to fetch Jira issues' }));
    throw new Error(errData.error || 'Failed to fetch Jira issues');
  }
  const data = await res.json();
  return data.issues || [];
}

export async function createJiraIssue(task: {
  title: string;
  description?: string;
  dueDate?: string;
  projectKey?: string;
}): Promise<{ ok: boolean; issue: { id: string; jiraKey: string; jiraUrl: string } }> {
  const res = await fetch('/api/jira/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Failed to create Jira issue' }));
    throw new Error(errData.error || 'Failed to create Jira issue');
  }
  return res.json();
}

export async function transitionJiraIssue(
  issueKey: string,
  targetStatus: KanbanTask['status']
): Promise<{ ok: boolean; transitionedTo?: string; reason?: string }> {
  const res = await fetch(`/api/jira/issues/${encodeURIComponent(issueKey)}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: targetStatus }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Failed to transition Jira issue' }));
    throw new Error(errData.error || 'Failed to transition Jira issue');
  }
  return res.json();
}

export async function addJiraComment(
  issueKey: string,
  comment: string
): Promise<{ ok: boolean; comment: TaskComment }> {
  const res = await fetch(`/api/jira/issues/${encodeURIComponent(issueKey)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Failed to post comment' }));
    throw new Error(errData.error || 'Failed to post comment');
  }
  return res.json();
}
