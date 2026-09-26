import { Icon, ICONS } from './icons.jsx';
const React = window.React;
const { useState } = React;
const cx = (...a) => a.filter(Boolean).join(' ');
const TINTS = ['rose', 'sky', 'sage', 'amber', 'lilac', 'stone'];
const tint = (t) => (TINTS.includes(t) ? t : 'stone');

/* ---------------- Actions ---------------- */
export function Button({ variant = 'secondary', size, icon, iconRight, block, className, children, ...rest }) {
  return (
    <button type="button" {...rest} className={cx('cl-btn', 'cl-btn-' + variant, size === 'sm' && 'cl-btn-sm', block && 'cl-btn-block', className)}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}
export function IconButton({ icon, label, active, size, outlined, dot, className, iconSize, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={cx('cl-iconbtn', active && 'is-active', size === 'lg' && 'is-lg', outlined && 'is-outlined', className)}>
      <Icon name={icon} size={iconSize || (size === 'lg' ? 20 : 17)} />
      {dot && <span className="cl-dot" />}
    </button>
  );
}
export function SegmentedControl({ options, value, onChange, iconOnly, className }) {
  const [v, setV] = useState(value ?? (options[0] && options[0].value));
  const cur = onChange ? value : v;
  return (
    <div role="tablist" className={cx('cl-seg', iconOnly && 'is-icon', className)}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={cur === o.value} title={iconOnly ? o.label : undefined}
          className={cur === o.value ? 'is-on' : ''} onClick={() => (onChange ? onChange(o.value) : setV(o.value))}>
          {o.icon && <Icon name={o.icon} size={15} />}{!iconOnly && o.label}
          {iconOnly && <span className="cl-sr">{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Inputs ---------------- */
export function SearchField({ placeholder = 'Search', shortcut, value, onChange, className, style }) {
  return (
    <label className={cx('cl-search', className)} style={style}>
      <Icon name="search" size={16} />
      <input placeholder={placeholder} value={value} onChange={onChange} />
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </label>
  );
}
export function TextField({ label, hint, error, multiline, mono, className, ...rest }) {
  return (
    <label className={cx('cl-field', error && 'is-error', className)}>
      {label && <span className="cl-field-label">{label}</span>}
      {multiline ? <textarea className="cl-textarea" {...rest} /> : <input className="cl-input" style={mono ? { fontFamily: 'var(--font-mono)', fontSize: 13 } : undefined} {...rest} />}
      {(error || hint) && <span className="cl-field-hint">{error || hint}</span>}
    </label>
  );
}
export function Checkbox({ checked, defaultChecked, onChange, children, strike = true }) {
  const [c, setC] = useState(!!defaultChecked);
  const on = checked ?? c;
  return (
    <label className={cx('cl-check', on && strike && 'is-done')}>
      <input type="checkbox" checked={on} onChange={(e) => (onChange ? onChange(e.target.checked) : setC(e.target.checked))} />
      <span>{children}</span>
    </label>
  );
}
export const PROJECT_COLORS = ['rose', 'sky', 'sage', 'amber', 'lilac', 'stone'];
export const PEN_COLORS = ['pen-black', 'pen-cobalt', 'pen-red', 'pen-amber', 'pen-teal', 'pen-azure', 'pen-violet'];
export function ColorPicker({ colors = PROJECT_COLORS, value, onChange, allowCustom, label }) {
  const [v, setV] = useState(value ?? colors[0]);
  const cur = onChange ? value : v;
  const bg = (c) => (c.startsWith('#') ? c : c.startsWith('pen-') ? `var(--${c})` : `var(--${c}-solid)`);
  return (
    <div className="cl-swatches" role="radiogroup" aria-label={label || 'Colour'}>
      {colors.map((c) => (
        <button key={c} role="radio" aria-checked={cur === c} aria-label={c} className={cx('cl-swatch', cur === c && 'is-on')}
          style={{ background: bg(c) }} onClick={() => (onChange ? onChange(c) : setV(c))} />
      ))}
      {allowCustom && <button className="cl-swatch is-add" aria-label="Custom colour"><Icon name="plus" size={16} /></button>}
    </div>
  );
}
export function Switch({ on, onChange, label }) {
  const [v, setV] = useState(!!on);
  const cur = onChange ? on : v;
  return <button role="switch" aria-checked={cur} aria-label={label} className={cx('cl-switch', cur && 'is-on')} onClick={() => (onChange ? onChange(!cur) : setV(!cur))} />;
}

/* ---------------- Status & meta ---------------- */
export function Tag({ tone = 'stone', children, onRemove, outline, icon }) {
  return (
    <span className={cx('cl-tag', 't-' + tint(tone), outline && 'is-outline')}>
      {icon && <Icon name={icon} size={12} stroke={2} />}
      {children}
      {onRemove && <button aria-label={'Remove ' + children} onClick={onRemove}><Icon name="x" size={12} stroke={2.2} /></button>}
    </span>
  );
}
export const STATUS = {
  todo: { label: 'Not started', tone: 'stone', icon: 'clock' },
  inprogress: { label: 'In progress', tone: 'amber', icon: 'refresh' },
  review: { label: 'Under review', tone: 'lilac', icon: 'search' },
  done: { label: 'Completed', tone: 'sage', icon: 'check-circle' },
};
export function StatusPill({ status = 'todo', count }) {
  const s = STATUS[status] || STATUS.todo;
  return (
    <span className={cx('cl-status', 't-' + s.tone)}>
      <Icon name={s.icon} size={14} stroke={2} />{s.label}
      {count != null && <span className="cl-count">{count}</span>}
    </span>
  );
}
export const PRIORITY = { high: { label: 'High', tone: 'rose' }, medium: { label: 'Medium', tone: 'amber' }, low: { label: 'Low', tone: 'sky' } };
export function PriorityFlag({ priority = 'medium' }) {
  const p = PRIORITY[priority] || PRIORITY.medium;
  return <span className={cx('cl-flag', 't-' + p.tone)}><Icon name="flag" size={13} stroke={2} />{p.label}</span>;
}
export function DeltaChip({ value, suffix = '%' }) {
  const up = value >= 0;
  return <span className={cx('cl-delta', up ? 't-sage' : 't-rose')}><Icon name={up ? 'arrow-up-right' : 'arrow-down-left'} size={11} stroke={2.4} />{Math.abs(value)}{suffix}</span>;
}
export function Avatar({ name = '', src, size = 32, tone = 'amber' }) {
  const ini = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <span className={cx('cl-avatar', 't-' + tone)} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} title={name}>{src ? <img src={src} alt={name} /> : ini}</span>;
}
export function Kbd({ children }) { return <kbd className="cl-kbd">{children}</kbd>; }
export function ProgressDots({ value = 0, total = 12, tone, label = 'Progress' }) {
  const on = Math.round((value / 100) * total);
  return (
    <div className={cx('cl-progress', tone && 'w-' + tone)} style={{ background: 'none', border: 0 }}>
      <div className="cl-progress-head"><span>{label}</span><span className="cl-tnum">{value}%</span></div>
      <div className="cl-dots" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: total }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */
export function Window({ children, flat, style }) {
  return <div className={cx('cl', 'cl-window', flat && 'is-flat')} style={style}>{children}</div>;
}
export function NavItem({ icon, label, active, count, color, onClick, depth, children }) {
  return (
    <button type="button" className={cx('cl-nav', active && 'is-on')} onClick={onClick} aria-current={active ? 'page' : undefined}>
      {color ? <i className={cx('cl-pdot', 's-' + tint(color))} /> : icon && <Icon name={icon} size={17} />}
      <span className="cl-nav-label">{label}</span>
      {count != null && <span className="cl-nav-count">{count}</span>}
      {children}
    </button>
  );
}
export function NavSection({ title, actions, children }) {
  return (
    <div className="cl-sb-sec">
      <div className="cl-sb-sec-head">
        <span className="cl-overline">{title}</span>
        {actions && <div className="cl-row">{actions.map((a) => <IconButton key={a.icon} icon={a.icon} label={a.label} iconSize={15} style={{ width: 24, height: 24 }} onClick={a.onClick} />)}</div>}
      </div>
      {children}
    </div>
  );
}
export function TreeItem({ item, activeId, depth = 0 }) {
  const [open, setOpen] = useState(item.open ?? true);
  const isFolder = item.type === 'folder';
  const icon = isFolder ? 'folder' : item.type === 'pdf' ? 'pdf' : item.type === 'notebook' ? 'notebook' : item.type === 'sticky' ? 'sticky' : 'file';
  return (
    <div className="cl-tree">
      <NavItem icon={icon} label={item.name} active={activeId === item.id} onClick={() => isFolder && setOpen(!open)}
        count={isFolder && item.children ? item.children.length : undefined} />
      {isFolder && open && item.children && item.children.map((c) => <TreeItem key={c.id} item={c} activeId={activeId} depth={depth + 1} />)}
    </div>
  );
}
export const VIEWS = [
  { id: 'home', label: 'Dashboard', icon: 'home' },
  { id: 'projects', label: 'Project Hub', icon: 'hub' },
  { id: 'nextcloud', label: 'Library', icon: 'cloud' },
  { id: 'kanban', label: 'Kanban Board', icon: 'kanban' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'canvas', label: 'Note Canvas', icon: 'canvas' },
];
export function Sidebar({ activeView = 'home', projects = [], tree = [], tags = [], activeFileId, user = { name: 'Thomas', email: 'tommytsuma7@gmail.com' },
  sync = 'connected', logoLight, logoDark, onNavigate, counts = {} }) {
  const syncLabel = { connected: 'Nextcloud synced', connecting: 'Connecting…', failed: 'Sync failed — retry', idle: 'Nextcloud not connected' }[sync];
  const syncCls = { connected: '', connecting: 'is-busy', failed: 'is-fail', idle: 'is-off' }[sync];
  return (
    <aside className="cl-sidebar" aria-label="Sidebar">
      <div className="cl-sb-brand">
        {logoLight ? <span><img className="cl-sb-logo-light" src={logoLight} alt="Clio" /><img className="cl-sb-logo-dark" src={logoDark || logoLight} alt="Clio" /></span> : <b style={{ fontSize: 20 }}>Clio</b>}
        <IconButton icon="panel-left" label="Collapse sidebar" />
      </div>
      <div style={{ padding: '4px 12px 0' }}><SearchField placeholder="Search notes, papers…" shortcut="⌘K" /></div>
      <div className="cl-sb-scroll">
        <NavSection title="Workspace">
          {VIEWS.map((v) => <NavItem key={v.id} icon={v.icon} label={v.label} active={activeView === v.id} count={counts[v.id]} onClick={() => onNavigate && onNavigate(v.id)} />)}
        </NavSection>
        {projects.length > 0 && (
          <NavSection title="Projects" actions={[{ icon: 'plus', label: 'Create project' }]}>
            {projects.map((p) => <NavItem key={p.id} color={p.color} label={p.name} count={p.count} active={p.active} />)}
          </NavSection>
        )}
        {tree.length > 0 && (
          <NavSection title="Notebooks" actions={[{ icon: 'upload', label: 'Upload file' }, { icon: 'folder', label: 'Upload folder' }, { icon: 'folder-plus', label: 'New folder' }]}>
            {tree.map((t) => <TreeItem key={t.id} item={t} activeId={activeFileId} />)}
          </NavSection>
        )}
        {tags.length > 0 && (
          <NavSection title="Tags" actions={[{ icon: 'search', label: 'Filter by tag' }]}>
            <div className="cl-sb-tags">{tags.map((t) => <Tag key={t.name} tone={t.color}>#{t.name}</Tag>)}</div>
          </NavSection>
        )}
      </div>
      <div className="cl-sb-foot">
        <div className={cx('cl-sync', syncCls)}><i />{syncLabel}<span style={{ flex: 1 }} /><IconButton icon="settings" label="Settings & connections" iconSize={15} style={{ width: 24, height: 24 }} /></div>
        <div className="cl-user"><Avatar name={user.name} size={32} /><div style={{ minWidth: 0, flex: 1 }}><b>{user.name}</b><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span></div><Icon name="chevron-right" size={16} className="cl-faint" /></div>
      </div>
    </aside>
  );
}
export function TopBar({ crumbs = [], sidebarOpen = true, recording, panelOpen, theme = 'light', onToggleTheme, onTogglePanel, showDownload, children }) {
  return (
    <header className="cl-topbar">
      {!sidebarOpen && <IconButton icon="panel-left" label="Open sidebar" />}
      <IconButton icon="chevron-left" label="Back" />
      <nav className="cl-crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (i === crumbs.length - 1
          ? <b key={i}>{c}</b>
          : <React.Fragment key={i}><a>{c}</a><span className="sep">/</span></React.Fragment>))}
      </nav>
      {children}
      <div className="cl-topbar-actions">
        {recording ? <span className="cl-rec"><i />Recording 04:12</span> : <IconButton icon="mic" label="Start recording" />}
        {showDownload && <IconButton icon="download" label="Download file" />}
        <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={onToggleTheme} />
        <span className="cl-topbar-sep" />
        <Button variant={panelOpen ? 'ai' : 'ghost'} size="sm" icon="spark" onClick={onTogglePanel} aria-pressed={!!panelOpen}>Ask Clio</Button>
      </div>
    </header>
  );
}
export function ViewHeader({ title, subtitle, actions, overline }) {
  return (
    <div className="cl-viewhead">
      <div>{overline && <div className="cl-overline" style={{ marginBottom: 6 }}>{overline}</div>}<h1 className="cl-h-display">{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {actions && <div className="cl-row">{actions}</div>}
    </div>
  );
}
export function SectionHeader({ title, icon, actions, count }) {
  return (
    <div className="cl-section-head">
      <h2 className="cl-h-lg" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{icon && <Icon name={icon} size={20} className="cl-muted" />}{title}{count != null && <span className="cl-faint" style={{ fontWeight: 600, fontSize: 15 }}>{count}</span>}</h2>
      {actions && <div className="cl-row">{actions}</div>}
    </div>
  );
}

/* ---------------- Cards ---------------- */
export function Card({ children, className, hover, style, ...rest }) {
  return <div className={cx('cl-card', hover && 'is-hover', className)} style={style} {...rest}>{children}</div>;
}
export function NoteGroup({ title, tone = 'sky', children, onAdd }) {
  return (
    <section className={cx('cl-group', 'w-' + tint(tone))}>
      <div className="cl-group-head">
        <h3>{title}</h3>
        <div className="cl-row" style={{ gap: 0 }}><IconButton icon="plus" label={'New note in ' + title} onClick={onAdd} /><IconButton icon="more" label="Group options" /></div>
      </div>
      {children}
    </section>
  );
}
export function NoteCard({ title, subtitle, body, tags = [], kind = 'markdown', updated, highlight }) {
  const kinds = { markdown: ['markdown', 'Notepad'], notebook: ['notebook', 'Ruled notebook'], pdf: ['pdf', 'PDF annotations'], sticky: ['sticky', 'Sticky'] };
  const k = kinds[kind] || kinds.markdown;
  return (
    <Card hover className="cl-note">
      {tags.length > 0 && <div className="cl-row" style={{ gap: 4 }}>{tags.map((t) => <Tag key={t.name} tone={t.color}>{t.name}</Tag>)}</div>}
      <h4>{title}</h4>
      {subtitle && <div className="sub">{subtitle}</div>}
      {body && <div className="body">{highlight ? <><mark className="cl-mark">{highlight}</mark> </> : null}{body}</div>}
      <div className="foot"><span className="kind"><Icon name={k[0]} size={14} />{k[1]}</span><span>{updated}</span></div>
    </Card>
  );
}
export function ProjectCard({ name, context, description, color = 'sky', starred, status, activity, progress }) {
  return (
    <Card hover className="cl-project">
      <div className="cl-card-head" style={{ alignItems: 'flex-start' }}>
        <div><h4>{name}</h4>{context && <div className="for">{context}</div>}</div>
        <div className="cl-row" style={{ gap: 0 }}>
          <IconButton icon="star" label={starred ? 'Unstar' : 'Star'} className={cx('cl-star', starred && 'is-on')} iconSize={16} />
          <IconButton icon="more" label="Project options" />
        </div>
      </div>
      <p>{description}</p>
      {progress != null && <div className={'w-' + tint(color)} style={{ background: 'none', border: 0 }}><ProgressDots value={progress} total={14} label="Kanban progress" /></div>}
      <div className="foot"><span className="cl-row" style={{ gap: 8 }}><i className={cx('band', 's-' + tint(color))} />{activity}</span>{status && <Tag tone={STATUS[status] ? STATUS[status].tone : 'stone'}>{STATUS[status] ? STATUS[status].label : status}</Tag>}</div>
    </Card>
  );
}
export function AddTile({ label = 'New project', onClick, minHeight }) {
  return <button className="cl-add-tile" onClick={onClick} style={minHeight ? { minHeight } : undefined}><span><Icon name="plus" size={26} stroke={1.5} />{label}</span></button>;
}
export function ProjectRow({ name, context, color = 'sky', starred, status, activity, notes }) {
  return (
    <Card hover className="cl-prow">
      <Icon name="star" size={17} className={cx('cl-star', starred && 'is-on')} fill={starred ? 'currentColor' : 'none'} />
      <span className="cl-row" style={{ gap: 10, flexWrap: 'nowrap', minWidth: 0 }}><i className={cx('s-' + tint(color))} style={{ width: 8, height: 8, borderRadius: 3, flex: 'none' }} /><b>{name}</b></span>
      <span className="m">{context}{notes != null ? ` · ${notes} notes` : ''}</span>
      <span>{status && <Tag tone={STATUS[status].tone}>{STATUS[status].label}</Tag>}</span>
      <span className="m">{activity}</span>
      <IconButton icon="more" label="Project options" />
    </Card>
  );
}
export function TaskCard({ id, title, description, priority = 'medium', due, dueState, project, projectColor = 'sky', dragging, onOpen }) {
  return (
    <Card hover className={cx('cl-task', dragging && 'is-dragging')} onClick={onOpen} role="button" tabIndex={0}>
      <div className="top"><span className="key"><Icon name="link" size={13} />{id}</span><PriorityFlag priority={priority} /></div>
      <h5>{title}</h5>
      {description && <p>{description}</p>}
      <div className="meta">
        <span className="proj"><i className={'s-' + tint(projectColor)} />{project}</span>
        {due && <span className={cx('due', dueState && 'is-' + dueState)}><Icon name="calendar" size={13} />{due}</span>}
      </div>
    </Card>
  );
}
export function KanbanColumn({ status = 'todo', count, children, over, onAdd }) {
  return (
    <section className={cx('cl-column', over && 'is-over')} aria-label={STATUS[status].label}>
      <div className="cl-column-head"><StatusPill status={status} count={count} /><div className="cl-row" style={{ gap: 0 }}><IconButton icon="plus" label="Add task" onClick={onAdd} /><IconButton icon="more" label="Column options" /></div></div>
      {children}
      <button className="cl-column-add" onClick={onAdd}><Icon name="plus" size={15} />New task</button>
    </section>
  );
}
export function FolderCard({ name, count, tone = 'sky', peek = 3 }) {
  return (
    <div className={cx('cl-folder', 'w-' + tint(tone))} role="button" tabIndex={0} title={'Open ' + name}>
      <div className="cl-card-head"><Icon name="folder" size={20} className="ico" /><div className="peek">{Array.from({ length: peek }, (_, i) => <span key={i} style={{ transform: `rotate(${(i - 1) * 5}deg)` }} />)}</div></div>
      <div><h4>{name}</h4><div className="cnt">{count}</div></div>
    </div>
  );
}
export function PaperCard({ title, authors, arxiv, pages, tags = [], annotated, status }) {
  return (
    <Card hover className="cl-paper">
      <div className="thumb"><b>PDF</b></div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h4>{title}</h4>
        <div className="auth">{authors}</div>
        <div className="meta">
          {arxiv && <span className="cl-mono cl-faint">arXiv:{arxiv}</span>}
          {pages && <span className="cl-mono cl-faint">· {pages} pp</span>}
          {annotated && <Tag tone="lilac" icon="pencil">{annotated} notes</Tag>}
          {status === 'local' && <Tag tone="amber" icon="upload">Waiting to sync</Tag>}
          {tags.map((t) => <Tag key={t.name} tone={t.color}>#{t.name}</Tag>)}
        </div>
      </div>
      <IconButton icon="more" label="Paper options" />
    </Card>
  );
}
export function StickyNote({ title, body, tone = 'amber', when, dragging, style }) {
  return (
    <div className={cx('cl-sticky', 'w-' + tint(tone), dragging && 'is-dragging')} style={style}>
      <h5>{title}</h5>
      <p>{body}</p>
      {when && <span className="when">{when}</span>}
    </div>
  );
}
export function TodoList({ items = [], onAddPlaceholder = 'Add a task for today…', showAdd = true }) {
  const [list, setList] = useState(items);
  return (
    <div className="cl-todo">
      {list.map((t, i) => (
        <div className="cl-todo-item" key={t.id || i}>
          <Checkbox checked={!!t.completed} onChange={(v) => setList(list.map((x, j) => (j === i ? { ...x, completed: v } : x)))}>{t.text}</Checkbox>
          {t.dueTime && <span className={cx('time', t.soon && !t.completed && 'is-soon')}>{t.dueTime}</span>}
          <span className="acts"><IconButton icon="pencil" label="Edit" iconSize={14} /><IconButton icon="trash" label="Delete" iconSize={14} /></span>
        </div>
      ))}
      {showAdd && <label className="cl-todo-add" style={{ marginTop: 6 }}><Icon name="plus" size={15} /><input placeholder={onAddPlaceholder} /><Icon name="clock" size={15} /></label>}
    </div>
  );
}
export function DailyCard({ date, icon = 'bulb', prose, tasksTitle = 'Today', tasks = [], footer = 'Just now', tag, showAdd }) {
  return (
    <Card className="cl-daily">
      <div className="date"><h4><Icon name={icon} size={20} stroke={2} />{date}</h4><IconButton icon="pencil" label="Edit" iconSize={15} /></div>
      {prose && <p className="prose">{prose}</p>}
      <div>
        <div className="tasks-h" style={{ marginBottom: 6 }}>{tasksTitle}</div>
        <TodoList items={tasks} showAdd={showAdd} />
      </div>
      <div className="foot"><span>{footer}</span><span className="cl-row" style={{ gap: 6 }}>{tag && <span>#{tag}</span>}<IconButton icon="more" label="More" iconSize={15} style={{ width: 24, height: 24 }} /></span></div>
    </Card>
  );
}
export function AgendaItem({ time, title, detail, tone = 'sky', done }) {
  return (
    <div className={cx('cl-agenda', done && 'is-done')}>
      <span className="t">{time}</span>
      <div className={cx('ev', 'w-' + tint(tone))}><b>{title}</b>{detail && <span>{detail}</span>}</div>
    </div>
  );
}
export function CardTitle({ icon, title, info, actions = true }) {
  return (
    <div className="cl-card-head">
      <span className="cl-card-title">{icon && <Icon name={icon} size={16} />}{title}{info && <Icon name="info" size={14} className="cl-faint" />}</span>
      {actions && <span className="cl-card-actions"><IconButton icon="expand" label="Expand" iconSize={13} /><IconButton icon="more" label="More" iconSize={13} /></span>}
    </div>
  );
}
export function BarChart({ data = [], labels, active, average, height = 84, tip }) {
  const max = Math.max(...data, 1);
  return (
    <div>
      <div className="cl-bars" style={{ height }} role="img" aria-label={`Bar chart, ${data.length} values, max ${max}`}>
        {average != null && <div className="avg" style={{ bottom: `${(average / max) * (height - 22)}px` }} />}
        {data.map((v, i) => (
          <div key={i} className={cx('b', i === active && 'on')} style={{ height: `${Math.max(4, (v / max) * (height - 22))}px` }}>
            {i === active && <span className="tip">{tip != null ? tip : v}</span>}
          </div>
        ))}
      </div>
      {labels && <div className="cl-bars-x">{labels.map((l, i) => <span key={i} className={i === active ? 'on' : ''}>{l}</span>)}</div>}
    </div>
  );
}
export function StatCard({ icon, title, value, unit, delta, deltaLabel = 'vs last week', chart, style }) {
  return (
    <Card className="cl-stat" style={style}>
      <CardTitle icon={icon} title={title} info />
      <div className="v">{value}{unit && <small>{unit}</small>}</div>
      {delta != null && <div className="sub"><DeltaChip value={delta} />{deltaLabel}</div>}
      {chart && <BarChart {...chart} />}
    </Card>
  );
}
export function StreakCard({ days = 12, week = [1, 1, 1, 1, 0, 0, 0], todayIndex = 4, tasksDone = 0, notesLogged = 0 }) {
  const L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <Card className="cl-streak">
      <CardTitle icon="flame" title="Active streak" />
      <div className="hero">
        <div className="flame"><Icon name="flame" size={28} stroke={1.8} /></div>
        <div><div className="v">{days}<small>days</small></div><p>Write a note or finish a task today to keep it going.</p></div>
      </div>
      <div className="cl-week">
        {L.map((l, i) => (
          <div key={i} className={cx(week[i] && 'done', i === todayIndex && 'today')}>
            <i>{week[i] ? <Icon name="check" size={15} stroke={2.6} /> : ''}</i>{l}
          </div>
        ))}
      </div>
      <div className="totals"><div><b>{tasksDone}</b><span>Tasks done</span></div><div><b>{notesLogged}</b><span>Notes logged</span></div></div>
    </Card>
  );
}

/* ---------------- AI ---------------- */
export function Markdown({ children }) { return <div className="md">{children}</div>; }
export function ChatMessage({ role = 'assistant', children, thought, streaming, actions = true }) {
  if (role === 'user') return <div className="cl-msg-user">{children}</div>;
  return (
    <div className="cl-msg-ai">
      {thought && <button className="cl-thought"><Icon name="bulb" size={16} />{thought}<Icon name="chevron-right" size={14} /></button>}
      <Markdown>{children}{streaming && <span className="cl-caret" />}</Markdown>
      {actions && !streaming && (
        <div className="cl-msg-acts">
          <Button variant="ghost" size="sm" icon="arrow-up-right">Insert into note</Button><span className="sep" />
          <IconButton icon="copy" label="Copy" iconSize={15} /><IconButton icon="thumb-up" label="Good response" iconSize={15} />
          <IconButton icon="thumb-down" label="Bad response" iconSize={15} /><IconButton icon="refresh" label="Regenerate" iconSize={15} />
        </div>
      )}
    </div>
  );
}
export function Composer({ context = [], placeholder = 'Ask about this paper, or press @ to add context', model = 'gemma4 · local', busy }) {
  const [v, setV] = useState('');
  return (
    <div className="cl-composer">
      <div className="ctx"><IconButton icon="at" label="Add context" iconSize={16} style={{ width: 26, height: 26 }} />
        {context.map((c) => <span key={c} className="cl-ctxchip"><Icon name="pdf" size={14} /><span>{c}</span></span>)}</div>
      <textarea rows={2} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} aria-label="Message Clio" />
      <div className="bar"><IconButton icon="clip" label="Attach" iconSize={16} /><span className="cl-topbar-sep" style={{ height: 16, margin: '0 2px' }} /><span className="model">{model}<Icon name="chevron-down" size={12} /></span>
        <button className="cl-send" aria-label="Send" disabled={!v && !busy}>{busy ? <span style={{ width: 10, height: 10, background: 'currentColor', borderRadius: 2 }} /> : <Icon name="arrow-up" size={17} stroke={2.2} />}</button></div>
    </div>
  );
}
export function SmartNote({ title, status = 'idle', children, open = true }) {
  const st = { idle: ['Not generated', ''], loading: ['Generating…', 'is-loading'], done: ['Ready', 'is-done'], error: ['Failed', 'is-error'] }[status];
  return (
    <div className="cl-smart">
      <div className="cl-smart-head">
        <Icon name={status === 'done' ? 'check-circle' : status === 'error' ? 'alert' : 'spark'} size={16} className={status === 'done' ? '' : 'cl-muted'} style={status === 'done' ? { color: 'var(--sage-ink)' } : undefined} />
        <b>{title}</b>
        <span className={cx('cl-smart-state', st[1])}>{st[0]}</span>
        {status === 'idle' && <Button size="sm" variant="ai" icon="spark">Generate</Button>}
        {status === 'error' && <Button size="sm" variant="secondary" icon="refresh">Retry</Button>}
        {status === 'done' && <IconButton icon="refresh" label="Regenerate" iconSize={15} />}
      </div>
      {open && status === 'loading' && <div className="cl-smart-body"><div className="cl-shimmer" style={{ width: '92%' }} /><div className="cl-shimmer" style={{ width: '78%' }} /><div className="cl-shimmer" style={{ width: '85%' }} /></div>}
      {open && status === 'done' && <div className="cl-smart-body">{children}</div>}
      {open && status === 'error' && <div className="cl-smart-body" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--danger)' }}>Couldn’t reach the local model at localhost:11434.</div>}
    </div>
  );
}
export const SMART_PROMPTS = ['Summary', 'Network Architecture', 'Molecule Representation', 'Conditioning Mechanism', 'Datasets', 'Evaluation criteria', 'Hyperparameters', 'Key results', 'Challenges solved'];
export function AIPanel({ tab = 'chat', file, children, footer, onClose }) {
  const [t, setT] = useState(tab);
  return (
    <aside className="cl-ai" aria-label="Clio AI">
      <div className="cl-ai-resize" aria-hidden="true" />
      <div className="cl-ai-head">
        <span className="cl-ai-title"><Icon name="spark" size={17} className="spark" />Clio AI<Icon name="chevron-down" size={14} className="cl-faint" /></span>
        <span className="cl-row" style={{ gap: 0 }}><IconButton icon="edit" label="New chat" /><IconButton icon="trash" label="Clear chat history" /><IconButton icon="x" label="Close panel" onClick={onClose} /></span>
      </div>
      <div className="cl-ai-tabs"><SegmentedControl value={t} onChange={setT} options={[{ value: 'chat', label: 'Chat', icon: 'message' }, { value: 'notes', label: 'Smart notes', icon: 'spark' }]} /></div>
      {file && <div className="cl-ai-ctx"><Icon name="link" size={14} />Reading <b style={{ color: 'var(--ink)', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</b></div>}
      <div className="cl-ai-body">{typeof children === 'function' ? children(t) : children}</div>
      {t === 'chat' && (footer !== undefined ? footer : <Composer context={file ? [file] : []} />)}
    </aside>
  );
}

/* ---------------- Canvas ---------------- */
function PenArt({ kind, color }) {
  const c = `var(--${color || 'pen-black'})`;
  const body = { pen: '#2a2724', pencil: '#e9e4db', highlighter: '#f5f2ec', eraser: '#f5f2ec', ruler: '#e8cf8a', text: '#f5f2ec', sticky: '#f5f2ec', select: '#f5f2ec' }[kind];
  if (kind === 'ruler') return <svg width="34" height="64" viewBox="0 0 34 64"><rect x="5" y="6" width="24" height="60" rx="3" fill="#e9d59a" stroke="#c7ad62" />{[14, 22, 30, 38, 46].map((y) => <path key={y} d={`M5 ${y}h${y % 16 === 14 ? 10 : 6}`} stroke="#a8904a" strokeWidth="1.4" />)}</svg>;
  if (kind === 'eraser') return <svg width="34" height="64" viewBox="0 0 34 64"><rect x="7" y="20" width="20" height="46" rx="4" fill="#ecebe8" stroke="#cfcac2" /><rect x="7" y="6" width="20" height="18" rx="5" fill="#f2a3ae" stroke="#d98794" /></svg>;
  if (kind === 'highlighter') return <svg width="34" height="64" viewBox="0 0 34 64"><path d="M11 4h12l2 10H9z" fill={c} opacity=".85" /><rect x="7" y="14" width="20" height="52" rx="4" fill="#eef4fb" stroke="#c9d6e6" /><rect x="7" y="26" width="20" height="5" fill={c} opacity=".6" /></svg>;
  if (kind === 'pencil') return <svg width="34" height="64" viewBox="0 0 34 64"><path d="M17 2l7 18H10z" fill="#e8d2b0" /><path d="M17 2l2.6 6.6h-5.2z" fill={c} /><rect x="10" y="20" width="14" height="46" fill="#dcd6cc" stroke="#bdb5a8" /><path d="M14.5 20v46M19.5 20v46" stroke="#bdb5a8" /></svg>;
  if (kind === 'pen') return <svg width="34" height="64" viewBox="0 0 34 64"><path d="M17 2l6 16H11z" fill={c} /><rect x="9" y="18" width="16" height="48" rx="5" fill={c} /><rect x="9" y="30" width="16" height="4" fill="#fff" opacity=".35" /></svg>;
  const glyph = { text: 'type', sticky: 'sticky', select: 'cursor' }[kind];
  return <svg width="34" height="64" viewBox="0 0 34 64"><rect x="5" y="12" width="24" height="54" rx="8" fill={body} stroke="#d4cec4" /><g transform="translate(8 18) scale(0.75)" stroke="#5c554c" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[glyph]} /></g></svg>;
}
export const TOOLS = [
  { id: 'pen', label: 'Pen' }, { id: 'pencil', label: 'Pencil' }, { id: 'highlighter', label: 'Highlighter' }, { id: 'eraser', label: 'Eraser' },
  { id: 'ruler', label: 'Ruler' }, { id: 'text', label: 'Text' }, { id: 'sticky', label: 'Sticky' }, { id: 'select', label: 'Select' },
];
export function ToolDock({ active = 'pen', color = 'pen-black', tools = TOOLS, onSelect, onUndo, onRedo }) {
  const [a, setA] = useState(active);
  const cur = onSelect ? active : a;
  return (
    <div className="cl-dock" role="toolbar" aria-label="Drawing tools">
      {tools.map((t) => (
        <button key={t.id} className={cx('cl-tool', cur === t.id && 'is-on')} aria-label={t.label} title={t.label} aria-pressed={cur === t.id}
          onClick={() => (onSelect ? onSelect(t.id) : setA(t.id))}>
          <PenArt kind={t.id} color={t.id === 'pen' || t.id === 'pencil' ? color : t.id === 'highlighter' ? 'pen-amber' : undefined} />
          {cur === t.id && ['pen', 'pencil', 'highlighter', 'eraser'].includes(t.id) && <span className="caret"><Icon name="chevron-down" size={10} stroke={2.4} /></span>}
        </button>
      ))}
      <span className="sep" />
      <IconButton icon="plus" label="Add page" />
      <IconButton icon="undo" label="Undo" onClick={onUndo} />
      <IconButton icon="redo" label="Redo" onClick={onRedo} />
      <IconButton icon="trash" label="Clear all annotations" />
    </div>
  );
}
export function ToolPopover({ tool = 'pen', size = 3, color = 'pen-black', palmRejection = true }) {
  const [s, setS] = useState(size);
  const sizes = [1, 2, 3, 5, 8, 12, 16];
  return (
    <div className="cl-popover" role="dialog" aria-label="Tool settings">
      <h6>Tool</h6>
      <SegmentedControl value={tool} options={[{ value: 'pen', label: 'Pen' }, { value: 'pencil', label: 'Pencil' }, { value: 'highlighter', label: 'Marker' }]} />
      <h6>Size</h6>
      <div className="cl-sizes">{sizes.map((z) => <button key={z} aria-label={'Size ' + z} className={cx('cl-size', s === z && 'is-on')} onClick={() => setS(z)}><i style={{ width: Math.min(22, z + 2), height: Math.min(22, z + 2) }} /></button>)}</div>
      <h6>Colour</h6>
      <ColorPicker colors={PEN_COLORS} value={color} allowCustom label="Ink colour" />
      <div className="cl-toggle" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}><span className="cl-row" style={{ gap: 8 }}><Icon name="hand" size={16} className="cl-muted" />Palm rejection</span><Switch on={palmRejection} label="Palm rejection" /></div>
    </div>
  );
}
export function NotebookPage({ width = 560, height = 720, ruled = true, lineSpacing = 32, page, children, style }) {
  return (
    <div className={cx('cl-page', ruled && 'is-ruled')} style={{ width, height, '--rule': lineSpacing + 'px', ...style }}>
      {children}
      {page && <span className="cl-page-num">{page}</span>}
    </div>
  );
}
export function CanvasTagBar({ tags = [] }) {
  return (
    <div className="cl-tagbar"><Icon name="tag" size={15} className="cl-faint" />{tags.map((t) => <Tag key={t.name} tone={t.color} onRemove={() => {}}>#{t.name}</Tag>)}<button className="add"><Icon name="plus" size={12} />Add tag</button></div>
  );
}

/* ---------------- Calendar ---------------- */
export function MiniCalendar({ month = 'September 2026', startOffset = 1, days = 30, today = 25, selected = 25, marked = [] }) {
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push({ d: 31 - startOffset + i + 1, out: true });
  for (let d = 1; d <= days; d++) cells.push({ d });
  while (cells.length % 7) cells.push({ d: cells.length - days - startOffset + 1, out: true });
  return (
    <div className="cl-mcal">
      <div className="cl-mcal-head"><b>{month}</b><span className="cl-row" style={{ gap: 0 }}><IconButton icon="chevron-left" label="Previous month" /><IconButton icon="chevron-right" label="Next month" /></span></div>
      <div className="cl-mcal-grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
        {cells.map((c, i) => <button key={i} className={cx(c.out && 'out', !c.out && c.d === today && 'today', !c.out && c.d === selected && 'sel', !c.out && marked.includes(c.d) && 'has')}>{c.d}</button>)}
      </div>
    </div>
  );
}
export function EventBlock({ title, time, tone = 'sky', done, compact, style }) {
  return <div className={cx('cl-event', 'w-' + tint(tone), done && 'is-done', compact && 'is-compact')} style={style}><b>{title}</b>{time && <span>{time}</span>}</div>;
}

/* ---------------- Overlays & feedback ---------------- */
export function Modal({ title, description, children, footer, onClose, width, inline = true }) {
  const box = (
    <div className="cl-modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { maxWidth: width } : undefined}>
      <div className="cl-modal-head"><div><h2 className="cl-h-lg">{title}</h2>{description && <p>{description}</p>}</div><IconButton icon="x" label="Close" onClick={onClose} /></div>
      <div className="cl-modal-body">{children}</div>
      {footer && <div className="cl-modal-foot">{footer}</div>}
    </div>
  );
  return inline ? <div className="cl-scrim">{box}</div> : box;
}
export function Menu({ items = [] }) {
  return (
    <div className="cl-menu" role="menu">
      {items.map((it, i) => it === '-' ? <hr key={i} /> : it.label && it.heading ? <div className="lbl" key={i}>{it.label}</div> : (
        <button key={i} role="menuitem" className={it.danger ? 'is-danger' : ''}><Icon name={it.icon} size={16} />{it.label}{it.shortcut && <span className="k">{it.shortcut}</span>}</button>
      ))}
    </div>
  );
}
export function Tooltip({ children, shortcut }) { return <span className="cl-tip" role="tooltip">{children}{shortcut && <Kbd>{shortcut}</Kbd>}</span>; }
export function Banner({ tone = 'info', icon, title, children, action }) {
  const ic = icon || { info: 'info', ai: 'spark', danger: 'alert', success: 'check-circle' }[tone];
  return <div className={cx('cl-banner', 'is-' + tone)} role={tone === 'danger' ? 'alert' : 'status'}><span className="ico"><Icon name={ic} size={16} /></span><span className="txt">{title && <b>{title} </b>}{children}</span>{action}</div>;
}
export function EmptyState({ icon = 'folder', title, children, action }) {
  return <div className="cl-empty"><span className="ico"><Icon name={icon} size={22} /></span><h4>{title}</h4><p>{children}</p>{action}</div>;
}
export function QuickActions({ items = [] }) {
  return <div className="cl-quick">{items.map((q) => <button key={q.label}><span className={cx('ico', 't-' + tint(q.tone))}><Icon name={q.icon} size={14} stroke={2} /></span>{q.label}</button>)}</div>;
}
export function ConnectionForm({ status = 'connected', url = 'https://cloud.example.com', username = 'thomas', papersPath = '/Clio/Papers', syncPath = '/Clio' }) {
  const s = { connected: ['Connected', 'Last synced 2 minutes ago'], connecting: ['Connecting…', 'Checking WebDAV credentials'], failed: ['Connection failed', 'Unauthorized — check the app password'], idle: ['Not connected', 'Files stay on this device until you connect'] }[status];
  return (
    <div className="cl-conn">
      <div className="cl-conn-status"><span className="ico"><Icon name="cloud" size={18} /></span><span className="t"><b>Nextcloud · {s[0]}</b><span>{s[1]}</span></span>
        <span className={cx('cl-sync', { connected: '', connecting: 'is-busy', failed: 'is-fail', idle: 'is-off' }[status])} style={{ padding: 0 }}><i /></span></div>
      <TextField label="Server URL" defaultValue={url} mono />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><TextField label="Username" defaultValue={username} /><TextField label="App password" type="password" defaultValue="••••••••••" /></div>
      <label className="cl-field"><span className="cl-field-label">Papers folder</span><div className="cl-pathrow"><input className="cl-input" defaultValue={papersPath} /><Button icon="folder">Browse</Button></div></label>
      <label className="cl-field"><span className="cl-field-label">Upload & sync folder</span><div className="cl-pathrow"><input className="cl-input" defaultValue={syncPath} /><Button icon="folder">Browse</Button></div><span className="cl-field-hint">New uploads land here. Created on Nextcloud if missing.</span></label>
    </div>
  );
}
export { Icon, ICONS };
