import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const JIRA_CONFIG_FILE = path.join(process.env.CLIO_DATA_DIR || './data', 'jira_config.json');

function getDefaultJiraConfig() {
  return {
    host: process.env.JIRA_HOST || '',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    projectKey: process.env.JIRA_PROJECT_KEY || '',
    syncEnabled: false,
  };
}

export function getJiraConfig() {
  const defaults = getDefaultJiraConfig();
  try {
    if (fs.existsSync(JIRA_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(JIRA_CONFIG_FILE, 'utf-8'));
      return {
        ...defaults,
        ...data,
        host: data.host || defaults.host,
        email: data.email || defaults.email,
        apiToken: data.apiToken || defaults.apiToken,
        projectKey: data.projectKey || defaults.projectKey,
      };
    }
  } catch (err) {
    console.error('Error reading Jira config:', err);
  }
  return defaults;
}

export function saveJiraConfig(newConfig) {
  try {
    const current = getJiraConfig();
    const merged = { ...current, ...newConfig };
    // Clean host URL if provided with https:// or trailing slashes
    if (merged.host) {
      merged.host = merged.host
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '')
        .trim();
    }
    fs.writeFileSync(JIRA_CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    console.error('Error saving Jira config:', err);
    throw err;
  }
}

function getAuthHeader(config) {
  if (!config.email || !config.apiToken) {
    throw new Error('Jira email and API token must be configured');
  }
  const token = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  return `Basic ${token}`;
}

function getBaseUrl(config) {
  if (!config.host) {
    throw new Error('Jira host domain is not configured (e.g. yourcompany.atlassian.net)');
  }
  return `https://${config.host}`;
}

/**
 * Convert Atlassian Document Format (ADF) to markdown/plain text
 */
export function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;

  if (node.type === 'text') {
    return node.text || '';
  }

  let text = '';
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += adfToText(child);
    }
  }

  if (node.type === 'paragraph') {
    text += '\n';
  } else if (node.type === 'heading') {
    text = `\n### ${text}\n`;
  } else if (node.type === 'bulletList' || node.type === 'orderedList') {
    text = `\n${text}\n`;
  } else if (node.type === 'listItem') {
    text = `• ${text}\n`;
  }

  return text.trim();
}

/**
 * Convert plain text to simple Atlassian Document Format (ADF)
 */
export function textToAdf(text) {
  const paragraphs = (text || '').split('\n').filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) {
    paragraphs.push('Task synced from Clio');
  }

  return {
    type: 'doc',
    version: 1,
    content: paragraphs.map(p => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }]
    }))
  };
}

/**
 * Test authentication and fetch user info
 */
export async function testJiraConnection(customConfig) {
  const config = customConfig || getJiraConfig();
  const baseUrl = getBaseUrl(config);
  const auth = getAuthHeader(config);

  const res = await fetch(`${baseUrl}/rest/api/3/myself`, {
    headers: {
      Authorization: auth,
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Jira authentication failed (HTTP ${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Get accessible projects
 */
export async function getJiraProjects(customConfig) {
  const config = customConfig || getJiraConfig();
  const baseUrl = getBaseUrl(config);
  const auth = getAuthHeader(config);

  const res = await fetch(`${baseUrl}/rest/api/3/project/search?maxResults=50`, {
    headers: {
      Authorization: auth,
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch Jira projects (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return (data.values || []).map(p => ({
    id: p.id,
    key: p.key,
    name: p.name,
    avatarUrl: p.avatarUrls?.['48x48'] || null
  }));
}

/**
 * Map Jira status category / status name to Clio Kanban column
 */
function mapJiraStatusToClio(statusObj) {
  const name = (statusObj?.name || '').toLowerCase();
  const cat = (statusObj?.statusCategory?.key || '').toLowerCase();

  if (cat === 'done' || name.includes('done') || name.includes('closed') || name.includes('resolved')) {
    return 'done';
  }
  if (name.includes('review') || name.includes('testing') || name.includes('qa')) {
    return 'review';
  }
  if (cat === 'indeterminate' || name.includes('progress') || name.includes('in dev') || name.includes('active')) {
    return 'inprogress';
  }
  return 'todo';
}

/**
 * Map Jira priority to Clio priority
 */
function mapJiraPriorityToClio(priorityObj) {
  const name = (priorityObj?.name || '').toLowerCase();
  if (name.includes('highest') || name.includes('high') || name.includes('critical') || name.includes('blocker')) {
    return 'high';
  }
  if (name.includes('lowest') || name.includes('low') || name.includes('minor') || name.includes('trivial')) {
    return 'low';
  }
  return 'medium';
}

/**
 * Fetch Jira issues using JQL
 */
export async function getJiraIssues(customConfig) {
  const config = customConfig || getJiraConfig();
  const baseUrl = getBaseUrl(config);
  const auth = getAuthHeader(config);

  let jql = 'ORDER BY updated DESC';
  if (config.projectKey) {
    jql = `project = "${config.projectKey}" ${jql}`;
  }

  let res = await fetch(`${baseUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      jql,
      maxResults: 60,
      fields: [
        'summary',
        'description',
        'status',
        'priority',
        'duedate',
        'assignee',
        'comment',
        'updated',
        'created',
        'project'
      ]
    })
  });

  // Fallback to legacy endpoint if instance does not have /search/jql
  if (res.status === 404) {
    res = await fetch(`${baseUrl}/rest/api/3/search`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        jql,
        maxResults: 60,
        fields: [
          'summary',
          'description',
          'status',
          'priority',
          'duedate',
          'assignee',
          'comment',
          'updated',
          'created',
          'project'
        ]
      })
    });
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch Jira issues (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const issues = data.issues || [];

  return issues.map(issue => {
    const comments = (issue.fields.comment?.comments || []).map(c => ({
      id: c.id,
      author: c.author?.displayName || 'Unknown',
      body: adfToText(c.body),
      created: c.created
    }));

    return {
      id: issue.key,
      jiraKey: issue.key,
      jiraUrl: `${baseUrl}/browse/${issue.key}`,
      projectId: issue.fields.project?.key || config.projectKey || 'jira-default',
      title: issue.fields.summary,
      description: adfToText(issue.fields.description),
      status: mapJiraStatusToClio(issue.fields.status),
      jiraStatusName: issue.fields.status?.name || 'To Do',
      priority: mapJiraPriorityToClio(issue.fields.priority),
      dueDate: issue.fields.duedate || undefined,
      createdAt: issue.fields.created,
      comments
    };
  });
}

/**
 * Create a new issue in Jira
 */
export async function createJiraIssue(taskData, customConfig) {
  const config = customConfig || getJiraConfig();
  const baseUrl = getBaseUrl(config);
  const auth = getAuthHeader(config);

  const projectKey = taskData.projectKey || config.projectKey;
  if (!projectKey) {
    throw new Error('Project Key is required to create a Jira issue');
  }

  const body = {
    fields: {
      project: { key: projectKey },
      summary: taskData.title,
      description: textToAdf(taskData.description || ''),
      issuetype: { name: 'Task' }
    }
  };

  if (taskData.dueDate) {
    body.fields.duedate = taskData.dueDate;
  }

  const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create Jira issue (HTTP ${res.status}): ${errorText}`);
  }

  const created = await res.json();
  return {
    id: created.key,
    jiraKey: created.key,
    jiraUrl: `${baseUrl}/browse/${created.key}`
  };
}

/**
 * Transition a Jira issue to a new status (e.g. todo, inprogress, review, done)
 */
export async function transitionJiraIssue(issueKey, targetColumn, customConfig) {
  const config = customConfig || getJiraConfig();
  const baseUrl = getBaseUrl(config);
  const auth = getAuthHeader(config);

  // 1. Fetch available transitions for this issue
  const transRes = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
    headers: {
      Authorization: auth,
      Accept: 'application/json'
    }
  });

  if (!transRes.ok) {
    const errorText = await transRes.text();
    throw new Error(`Failed to get Jira transitions (HTTP ${transRes.status}): ${errorText}`);
  }

  const transData = await transRes.json();
  const transitions = transData.transitions || [];

  if (transitions.length === 0) {
    console.warn(`No transitions available for Jira issue ${issueKey}`);
    return { ok: false, reason: 'No transitions available' };
  }

  // 2. Find the transition that best matches targetColumn
  const match = transitions.find(t => {
    const target = mapJiraStatusToClio(t.to);
    return target === targetColumn;
  }) || transitions.find(t => {
    const name = t.name.toLowerCase();
    if (targetColumn === 'done' && (name.includes('done') || name.includes('close'))) return true;
    if (targetColumn === 'inprogress' && (name.includes('progress') || name.includes('start'))) return true;
    if (targetColumn === 'review' && (name.includes('review') || name.includes('qa'))) return true;
    if (targetColumn === 'todo' && (name.includes('todo') || name.includes('backlog') || name.includes('reopen'))) return true;
    return false;
  });

  if (!match) {
    console.warn(`No matching transition found for target "${targetColumn}" on issue ${issueKey}. Available:`, transitions.map(t => t.name));
    return { ok: false, reason: `No matching transition for ${targetColumn}` };
  }

  // 3. Execute the transition
  const execRes = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      transition: { id: match.id }
    })
  });

  if (!execRes.ok) {
    const errorText = await execRes.text();
    throw new Error(`Failed to transition issue ${issueKey} (HTTP ${execRes.status}): ${errorText}`);
  }

  return { ok: true, transitionedTo: match.name, transitionId: match.id };
}

/**
 * Add a comment (communication) to a Jira issue
 */
export async function addJiraComment(issueKey, commentText, customConfig) {
  const config = customConfig || getJiraConfig();
  const baseUrl = getBaseUrl(config);
  const auth = getAuthHeader(config);

  const res = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/comment`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      body: textToAdf(commentText)
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to add comment to Jira issue ${issueKey} (HTTP ${res.status}): ${errorText}`);
  }

  const comment = await res.json();
  return {
    id: comment.id,
    author: comment.author?.displayName || config.email,
    body: commentText,
    created: comment.created
  };
}
