import React, { useState, useEffect } from 'react';
import type { ReactNode, CSSProperties, ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { Icon, ICONS } from './icons';

const cx = (...a: (string | boolean | undefined | null)[]) => a.filter(Boolean).join(' ');
const TINTS = ['rose', 'sky', 'sage', 'amber', 'lilac', 'stone'] as const;
export type Tint = typeof TINTS[number];
const tint = (t?: string): Tint => (TINTS.includes(t as Tint) ? (t as Tint) : 'stone');

/* ---------------- Actions ---------------- */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger';
  size?: 'sm';
  icon?: string;
  iconRight?: string;
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Button({ variant = 'secondary', size, icon, iconRight, block, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx('cl-btn', 'cl-btn-' + variant, size === 'sm' && 'cl-btn-sm', block && 'cl-btn-block', className)}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  active?: boolean;
  size?: 'lg';
  outlined?: boolean;
  dot?: boolean;
  className?: string;
  iconSize?: number;
}

export function IconButton({ icon, label, active, size, outlined, dot, className, iconSize, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx('cl-iconbtn', active && 'is-active', size === 'lg' && 'is-lg', outlined && 'is-outlined', className)}
    >
      <Icon name={icon} size={iconSize || (size === 'lg' ? 20 : 17)} />
      {dot && <span className="cl-dot" />}
    </button>
  );
}

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value?: string;
  onChange?: (val: string) => void;
  iconOnly?: boolean;
  className?: string;
}

export function SegmentedControl({ options, value, onChange, iconOnly, className }: SegmentedControlProps) {
  const [v, setV] = useState(value ?? (options[0] && options[0].value));
  const cur = onChange ? value : v;
  return (
    <div role="tablist" className={cx('cl-seg', iconOnly && 'is-icon', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={cur === o.value}
          title={iconOnly ? o.label : undefined}
          className={cur === o.value ? 'is-on' : ''}
          onClick={() => (onChange ? onChange(o.value) : setV(o.value))}
        >
          {o.icon && <Icon name={o.icon} size={15} />}
          {!iconOnly && o.label}
          {iconOnly && <span className="cl-sr">{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Inputs ---------------- */
export interface SearchFieldProps {
  placeholder?: string;
  shortcut?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  style?: CSSProperties;
}

export function SearchField({ placeholder = 'Search', shortcut, value, onChange, className, style }: SearchFieldProps) {
  return (
    <label className={cx('cl-search', className)} style={style}>
      <Icon name="search" size={16} />
      <input placeholder={placeholder} value={value} onChange={onChange} />
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </label>
  );
}

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
  mono?: boolean;
  rows?: number;
  className?: string;
}

export function TextField({ label, hint, error, multiline, mono, rows, className, ...rest }: TextFieldProps) {
  return (
    <label className={cx('cl-field', error && 'is-error', className)}>
      {label && <span className="cl-field-label">{label}</span>}
      {multiline ? (
        <textarea className="cl-textarea" rows={rows} {...(rest as any)} />
      ) : (
        <input className="cl-input" style={mono ? { fontFamily: 'var(--font-mono)', fontSize: 13 } : undefined} {...(rest as any)} />
      )}
      {(error || hint) && <span className="cl-field-hint">{error || hint}</span>}
    </label>
  );
}

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  children?: ReactNode;
  strike?: boolean;
}

export function Checkbox({ checked, defaultChecked, onChange, children, strike = true }: CheckboxProps) {
  const [c, setC] = useState(!!defaultChecked);
  const on = checked ?? c;
  return (
    <label className={cx('cl-check', on && strike && 'is-done')}>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => (onChange ? onChange(e.target.checked) : setC(e.target.checked))}
      />
      <span>{children}</span>
    </label>
  );
}

export const PROJECT_COLORS = ['rose', 'sky', 'sage', 'amber', 'lilac', 'stone'];
export const PEN_COLORS = ['pen-black', 'pen-cobalt', 'pen-red', 'pen-amber', 'pen-teal', 'pen-azure', 'pen-violet'];

export interface ColorPickerProps {
  colors?: string[];
  value?: string;
  onChange?: (color: string) => void;
  allowCustom?: boolean;
  label?: string;
}

export function ColorPicker({ colors = PROJECT_COLORS, value, onChange, allowCustom, label }: ColorPickerProps) {
  const [v, setV] = useState(value ?? colors[0]);
  const cur = onChange ? value : v;
  const bg = (c: string) => (c.startsWith('#') ? c : c.startsWith('pen-') ? `var(--${c})` : `var(--${c}-solid)`);
  return (
    <div className="cl-swatches" role="radiogroup" aria-label={label || 'Colour'}>
      {colors.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={cur === c}
          aria-label={c}
          className={cx('cl-swatch', cur === c && 'is-on')}
          style={{ background: bg(c) }}
          onClick={() => (onChange ? onChange(c) : setV(c))}
        />
      ))}
      {allowCustom && (
        <button className="cl-swatch is-add" aria-label="Custom colour">
          <Icon name="plus" size={16} />
        </button>
      )}
    </div>
  );
}

export interface SwitchProps {
  on?: boolean;
  onChange?: (v: boolean) => void;
  label: string;
}

export function Switch({ on, onChange, label }: SwitchProps) {
  const [v, setV] = useState(!!on);
  const cur = onChange ? on : v;
  return (
    <button
      role="switch"
      aria-checked={cur}
      aria-label={label}
      className={cx('cl-switch', cur && 'is-on')}
      onClick={() => (onChange ? onChange(!cur) : setV(!cur))}
    />
  );
}

/* ---------------- Status & meta ---------------- */
export interface TagProps {
  tone?: string;
  children: ReactNode;
  onRemove?: () => void;
  outline?: boolean;
  icon?: string;
}

export function Tag({ tone = 'stone', children, onRemove, outline, icon }: TagProps) {
  return (
    <span className={cx('cl-tag', 't-' + tint(tone), outline && 'is-outline')}>
      {icon && <Icon name={icon} size={12} stroke={2} />}
      {children}
      {onRemove && (
        <button aria-label={'Remove ' + children} onClick={onRemove}>
          <Icon name="x" size={12} stroke={2.2} />
        </button>
      )}
    </span>
  );
}

export const STATUS: Record<string, { label: string; tone: Tint; icon: string }> = {
  todo: { label: 'Not started', tone: 'stone', icon: 'clock' },
  inprogress: { label: 'In progress', tone: 'amber', icon: 'refresh' },
  review: { label: 'Under review', tone: 'lilac', icon: 'search' },
  done: { label: 'Completed', tone: 'sage', icon: 'check-circle' },
};

export interface StatusPillProps {
  status?: string;
  count?: number;
}

export function StatusPill({ status = 'todo', count }: StatusPillProps) {
  const s = STATUS[status] || STATUS.todo;
  return (
    <span className={cx('cl-status', 't-' + s.tone)}>
      <Icon name={s.icon} size={14} stroke={2} />
      {s.label}
      {count != null && <span className="cl-count">{count}</span>}
    </span>
  );
}

export const PRIORITY: Record<string, { label: string; tone: Tint }> = {
  high: { label: 'High', tone: 'rose' },
  medium: { label: 'Medium', tone: 'amber' },
  low: { label: 'Low', tone: 'sky' },
};

export interface PriorityFlagProps {
  priority?: string;
}

export function PriorityFlag({ priority = 'medium' }: PriorityFlagProps) {
  const p = PRIORITY[priority] || PRIORITY.medium;
  return (
    <span className={cx('cl-flag', 't-' + p.tone)}>
      <Icon name="flag" size={13} stroke={2} />
      {p.label}
    </span>
  );
}

export function DeltaChip({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span className={cx('cl-delta', up ? 't-sage' : 't-rose')}>
      <Icon name={up ? 'arrow-up-right' : 'arrow-down-left'} size={11} stroke={2.4} />
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

export function Avatar({ name = '', src, size = 32, tone = 'amber' }: { name?: string; src?: string; size?: number; tone?: string }) {
  const ini = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className={cx('cl-avatar', 't-' + tint(tone))} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} title={name}>
      {src ? <img src={src} alt={name} /> : ini}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="cl-kbd">{children}</kbd>;
}

export function ProgressDots({ value = 0, total = 12, tone, label = 'Progress' }: { value?: number; total?: number; tone?: string; label?: string }) {
  const on = Math.round((value / 100) * total);
  return (
    <div className={cx('cl-progress', tone && 'w-' + tint(tone))} style={{ background: 'none', border: 0 }}>
      <div className="cl-progress-head">
        <span>{label}</span>
        <span className="cl-tnum">{value}%</span>
      </div>
      <div className="cl-dots" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < on ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */
export function Window({ children, flat, style }: { children: ReactNode; flat?: boolean; style?: CSSProperties }) {
  return <div className={cx('cl', 'cl-window', flat && 'is-flat')} style={style}>{children}</div>;
}

export interface NavItemProps {
  icon?: string;
  label: string;
  active?: boolean;
  count?: number;
  color?: string;
  onClick?: () => void;
  children?: ReactNode;
}

export function NavItem({ icon, label, active, count, color, onClick, children }: NavItemProps) {
  return (
    <button type="button" className={cx('cl-nav', active && 'is-on')} onClick={onClick} aria-current={active ? 'page' : undefined}>
      {color ? <i className={cx('cl-pdot', 's-' + tint(color))} /> : icon && <Icon name={icon} size={17} />}
      <span className="cl-nav-label">{label}</span>
      {count != null && <span className="cl-nav-count">{count}</span>}
      {children}
    </button>
  );
}

export interface NavSectionProps {
  title: string;
  actions?: { icon: string; label: string; onClick?: () => void }[];
  children: ReactNode;
}

export function NavSection({ title, actions, children }: NavSectionProps) {
  return (
    <div className="cl-sb-sec">
      <div className="cl-sb-sec-head">
        <span className="cl-overline">{title}</span>
        {actions && (
          <div className="cl-row">
            {actions.map((a) => (
              <IconButton key={a.icon} icon={a.icon} label={a.label} iconSize={15} style={{ width: 24, height: 24 }} onClick={a.onClick} />
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export interface TreeNode {
  id: string;
  type: 'folder' | 'pdf' | 'notebook' | 'markdown' | 'sticky' | string;
  name: string;
  open?: boolean;
  children?: TreeNode[];
}

export function TreeItem({ item, activeId, depth = 0 }: { item: TreeNode; activeId?: string; depth?: number }) {
  const [open, setOpen] = useState(item.open ?? true);
  const isFolder = item.type === 'folder';
  const icon = isFolder ? 'folder' : item.type === 'pdf' ? 'pdf' : item.type === 'notebook' ? 'notebook' : item.type === 'sticky' ? 'sticky' : 'file';
  return (
    <div className="cl-tree">
      <NavItem
        icon={icon}
        label={item.name}
        active={activeId === item.id}
        onClick={() => isFolder && setOpen(!open)}
        count={isFolder && item.children ? item.children.length : undefined}
      />
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

export interface SidebarProps {
  activeView?: string;
  projects?: { id: string; name: string; color?: string; count?: number; active?: boolean }[];
  tree?: TreeNode[];
  tags?: { name: string; color?: string }[];
  activeFileId?: string;
  user?: { name: string; email: string };
  sync?: 'connected' | 'connecting' | 'failed' | 'idle';
  logoLight?: string;
  logoDark?: string;
  onNavigate?: (view: string) => void;
  counts?: Record<string, number>;
  onToggleSidebar?: () => void;
  onNewFolder?: () => void;
  onUploadFile?: () => void;
}

export function Sidebar({
  activeView = 'home',
  projects = [],
  tree = [],
  tags = [],
  activeFileId,
  user = { name: 'Thomas', email: 'tommytsuma7@gmail.com' },
  sync = 'connected',
  logoLight = '/assets/Logos/clio-wordmark-ink.png',
  logoDark = '/assets/Logos/clio-wordmark-paper.png',
  onNavigate,
  counts = {},
  onToggleSidebar,
  onNewFolder,
  onUploadFile,
}: SidebarProps) {
  const syncLabel = {
    connected: 'Nextcloud synced',
    connecting: 'Connecting…',
    failed: 'Sync failed — retry',
    idle: 'Nextcloud not connected',
  }[sync];
  const syncCls = { connected: '', connecting: 'is-busy', failed: 'is-fail', idle: 'is-off' }[sync];

  return (
    <aside className="cl-sidebar" aria-label="Sidebar">
      <div className="cl-sb-brand">
        {logoLight ? (
          <span>
            <img className="cl-sb-logo-light" src={logoLight} alt="Clio" style={{ height: 22 }} />
            <img className="cl-sb-logo-dark" src={logoDark || logoLight} alt="Clio" style={{ height: 22 }} />
          </span>
        ) : (
          <b style={{ fontSize: 20 }}>Clio</b>
        )}
        <IconButton icon="panel-left" label="Collapse sidebar" onClick={onToggleSidebar} />
      </div>
      <div style={{ padding: '4px 12px 0' }}>
        <SearchField placeholder="Search notes, papers…" shortcut="⌘K" />
      </div>
      <div className="cl-sb-scroll">
        <NavSection title="Workspace">
          {VIEWS.map((v) => (
            <NavItem
              key={v.id}
              icon={v.icon}
              label={v.label}
              active={activeView === v.id}
              count={counts[v.id]}
              onClick={() => onNavigate && onNavigate(v.id)}
            />
          ))}
        </NavSection>
        {projects.length > 0 && (
          <NavSection title="Projects" actions={[{ icon: 'plus', label: 'Create project', onClick: () => onNavigate && onNavigate('projects') }]}>
            {projects.map((p) => (
              <NavItem
                key={p.id}
                color={p.color}
                label={p.name}
                count={p.count}
                active={p.active}
                onClick={() => onNavigate && onNavigate('projects')}
              />
            ))}
          </NavSection>
        )}
        {(tree.length > 0 || onUploadFile || onNewFolder) && (
          <NavSection
            title="Notebooks"
            actions={[
              { icon: 'upload', label: 'Upload PDF', onClick: onUploadFile },
              { icon: 'folder-plus', label: 'New folder', onClick: onNewFolder },
            ]}
          >
            {tree.map((t) => (
              <TreeItem key={t.id} item={t} activeId={activeFileId} />
            ))}
          </NavSection>
        )}
        {tags.length > 0 && (
          <NavSection title="Tags">
            <div className="cl-sb-tags">
              {tags.map((t) => (
                <Tag key={t.name} tone={t.color}>
                  #{t.name}
                </Tag>
              ))}
            </div>
          </NavSection>
        )}
      </div>
      <div className="cl-sb-foot">
        <div className={cx('cl-sync', syncCls)}>
          <i />
          {syncLabel}
          <span style={{ flex: 1 }} />
          <IconButton icon="settings" label="Settings & connections" iconSize={15} style={{ width: 24, height: 24 }} />
        </div>
        <div className="cl-user">
          <Avatar name={user.name} size={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <b>{user.name}</b>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
          </div>
          <Icon name="chevron-right" size={16} className="cl-faint" />
        </div>
      </div>
    </aside>
  );
}

export interface TopBarProps {
  crumbs?: string[];
  sidebarOpen?: boolean;
  recording?: boolean;
  panelOpen?: boolean;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onTogglePanel?: () => void;
  onToggleSidebar?: () => void;
  showDownload?: boolean;
  children?: ReactNode;
}

export function TopBar({
  crumbs = [],
  sidebarOpen = true,
  recording,
  panelOpen,
  theme = 'light',
  onToggleTheme,
  onTogglePanel,
  onToggleSidebar,
  showDownload,
  children,
}: TopBarProps) {
  return (
    <header className="cl-topbar">
      {!sidebarOpen && <IconButton icon="panel-left" label="Open sidebar" onClick={onToggleSidebar} />}
      <nav className="cl-crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) =>
          i === crumbs.length - 1 ? (
            <b key={i}>{c}</b>
          ) : (
            <React.Fragment key={i}>
              <a>{c}</a>
              <span className="sep">/</span>
            </React.Fragment>
          )
        )}
      </nav>
      {children}
      <div className="cl-topbar-actions">
        {recording ? (
          <span className="cl-rec">
            <i />Recording 04:12
          </span>
        ) : (
          <IconButton icon="mic" label="Start recording" />
        )}
        {showDownload && <IconButton icon="download" label="Download file" />}
        <IconButton
          icon={theme === 'dark' ? 'sun' : 'moon'}
          label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={onToggleTheme}
        />
        <span className="cl-topbar-sep" />
        <Button variant={panelOpen ? 'ai' : 'ghost'} size="sm" icon="spark" onClick={onTogglePanel} aria-pressed={!!panelOpen}>
          Ask Clio
        </Button>
      </div>
    </header>
  );
}

export function ViewHeader({ title, subtitle, actions, overline }: { title: string; subtitle?: string; actions?: ReactNode; overline?: string }) {
  return (
    <div className="cl-viewhead">
      <div>
        {overline && <div className="cl-overline" style={{ marginBottom: 6 }}>{overline}</div>}
        <h1 className="cl-h-display">{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="cl-row">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, icon, actions, count }: { title: string; icon?: string; actions?: ReactNode; count?: number }) {
  return (
    <div className="cl-section-head">
      <h2 className="cl-h-lg" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && <Icon name={icon} size={20} className="cl-muted" />}
        {title}
        {count != null && <span className="cl-faint" style={{ fontWeight: 600, fontSize: 15 }}>{count}</span>}
      </h2>
      {actions && <div className="cl-row">{actions}</div>}
    </div>
  );
}

/* ---------------- Cards ---------------- */
export function Card({ children, className, hover, style, ...rest }: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cx('cl-card', hover && 'is-hover', className)} style={style} {...rest}>
      {children}
    </div>
  );
}

export function NoteGroup({ title, tone = 'sky', children, onAdd }: { title: string; tone?: string; children: ReactNode; onAdd?: () => void }) {
  return (
    <section className={cx('cl-group', 'w-' + tint(tone))}>
      <div className="cl-group-head">
        <h3>{title}</h3>
        <div className="cl-row" style={{ gap: 0 }}>
          <IconButton icon="plus" label={'New note in ' + title} onClick={onAdd} />
          <IconButton icon="more" label="Group options" />
        </div>
      </div>
      {children}
    </section>
  );
}

export interface NoteCardProps {
  title: string;
  subtitle?: string;
  body?: string;
  tags?: { name: string; color?: string }[];
  kind?: 'markdown' | 'notebook' | 'pdf' | 'sticky' | string;
  updated?: string;
  highlight?: string;
  onClick?: () => void;
}

export function NoteCard({ title, subtitle, body, tags = [], kind = 'markdown', updated, highlight, onClick }: NoteCardProps) {
  const kinds: Record<string, [string, string]> = {
    markdown: ['markdown', 'Notepad'],
    notebook: ['notebook', 'Ruled notebook'],
    pdf: ['pdf', 'PDF annotations'],
    sticky: ['sticky', 'Sticky'],
  };
  const k = kinds[kind] || kinds.markdown;
  return (
    <Card hover className="cl-note" onClick={onClick}>
      {tags.length > 0 && (
        <div className="cl-row" style={{ gap: 4 }}>
          {tags.map((t) => (
            <Tag key={t.name} tone={t.color}>
              {t.name}
            </Tag>
          ))}
        </div>
      )}
      <h4>{title}</h4>
      {subtitle && <div className="sub">{subtitle}</div>}
      {body && (
        <div className="body">
          {highlight ? <mark className="cl-mark">{highlight}</mark> : null} {body}
        </div>
      )}
      <div className="foot">
        <span className="kind">
          <Icon name={k[0]} size={14} />
          {k[1]}
        </span>
        <span>{updated}</span>
      </div>
    </Card>
  );
}

export interface ProjectCardProps {
  id?: string;
  name: string;
  context?: string;
  description?: string;
  color?: string;
  starred?: boolean;
  status?: string;
  activity?: string;
  progress?: number;
  onClick?: () => void;
}

export function ProjectCard({ name, context, description, color = 'sky', starred, status, activity, progress, onClick }: ProjectCardProps) {
  return (
    <Card hover className="cl-project" onClick={onClick}>
      <div className="cl-card-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <h4>{name}</h4>
          {context && <div className="for">{context}</div>}
        </div>
        <div className="cl-row" style={{ gap: 0 }}>
          <IconButton icon="star" label={starred ? 'Unstar' : 'Star'} className={cx('cl-star', starred && 'is-on')} iconSize={16} />
          <IconButton icon="more" label="Project options" />
        </div>
      </div>
      <p>{description}</p>
      {progress != null && (
        <div className={'w-' + tint(color)} style={{ background: 'none', border: 0 }}>
          <ProgressDots value={progress} total={14} label="Kanban progress" />
        </div>
      )}
      <div className="foot">
        <span className="cl-row" style={{ gap: 8 }}>
          <i className={cx('band', 's-' + tint(color))} />
          {activity}
        </span>
        {status && <Tag tone={STATUS[status] ? STATUS[status].tone : 'stone'}>{STATUS[status] ? STATUS[status].label : status}</Tag>}
      </div>
    </Card>
  );
}

export function AddTile({ label = 'New project', onClick, minHeight }: { label?: string; onClick?: () => void; minHeight?: number }) {
  return (
    <button className="cl-add-tile" onClick={onClick} style={minHeight ? { minHeight } : undefined}>
      <span>
        <Icon name="plus" size={26} stroke={1.5} />
        {label}
      </span>
    </button>
  );
}

export interface ProjectRowProps {
  name: string;
  context?: string;
  color?: string;
  starred?: boolean;
  status?: string;
  activity?: string;
  notes?: number;
  onClick?: () => void;
}

export function ProjectRow({ name, context, color = 'sky', starred, status, activity, notes, onClick }: ProjectRowProps) {
  return (
    <Card hover className="cl-prow" onClick={onClick}>
      <Icon name="star" size={17} className={cx('cl-star', starred && 'is-on')} fill={starred ? 'currentColor' : 'none'} />
      <span className="cl-row" style={{ gap: 10, flexWrap: 'nowrap', minWidth: 0 }}>
        <i className={cx('s-' + tint(color))} style={{ width: 8, height: 8, borderRadius: 3, flex: 'none' }} />
        <b>{name}</b>
      </span>
      <span className="m">{context}{notes != null ? ` · ${notes} notes` : ''}</span>
      <span>{status && STATUS[status] && <Tag tone={STATUS[status].tone}>{STATUS[status].label}</Tag>}</span>
      <span className="m">{activity}</span>
      <IconButton icon="more" label="Project options" />
    </Card>
  );
}

export interface TaskCardProps {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  due?: string;
  dueState?: 'soon' | 'late';
  project?: string;
  projectColor?: string;
  dragging?: boolean;
  onOpen?: () => void;
}

export function TaskCard({ id, title, description, priority = 'medium', due, dueState, project, projectColor = 'sky', dragging, onOpen }: TaskCardProps) {
  return (
    <Card hover className={cx('cl-task', dragging && 'is-dragging')} onClick={onOpen} role="button" tabIndex={0}>
      <div className="top">
        <span className="key">
          <Icon name="link" size={13} />
          {id}
        </span>
        <PriorityFlag priority={priority} />
      </div>
      <h5>{title}</h5>
      {description && <p>{description}</p>}
      <div className="meta">
        <span className="proj">
          <i className={'s-' + tint(projectColor)} />
          {project}
        </span>
        {due && (
          <span className={cx('due', dueState && 'is-' + dueState)}>
            <Icon name="calendar" size={13} />
            {due}
          </span>
        )}
      </div>
    </Card>
  );
}

export function KanbanColumn({ status = 'todo', count, children, over, onAdd }: { status?: string; count?: number; children?: ReactNode; over?: boolean; onAdd?: () => void }) {
  const s = STATUS[status] || STATUS.todo;
  return (
    <section className={cx('cl-column', over && 'is-over')} aria-label={s.label}>
      <div className="cl-column-head">
        <StatusPill status={status} count={count} />
        <div className="cl-row" style={{ gap: 0 }}>
          <IconButton icon="plus" label="Add task" onClick={onAdd} />
          <IconButton icon="more" label="Column options" />
        </div>
      </div>
      {children}
      <button className="cl-column-add" onClick={onAdd}>
        <Icon name="plus" size={15} />New task
      </button>
    </section>
  );
}

export function FolderCard({ name, count, tone = 'sky', peek = 3, onClick }: { name: string; count?: string; tone?: string; peek?: number; onClick?: () => void }) {
  return (
    <div className={cx('cl-folder', 'w-' + tint(tone))} role="button" tabIndex={0} title={'Open ' + name} onClick={onClick}>
      <div className="cl-card-head">
        <Icon name="folder" size={20} className="ico" />
        <div className="peek">
          {Array.from({ length: peek }, (_, i) => (
            <span key={i} style={{ transform: `rotate(${(i - 1) * 5}deg)` }} />
          ))}
        </div>
      </div>
      <div>
        <h4>{name}</h4>
        <div className="cnt">{count}</div>
      </div>
    </div>
  );
}

export function PaperCard({ title, authors, arxiv, pages, tags = [], annotated, status, onClick }: { title: string; authors?: string; arxiv?: string; pages?: number; tags?: { name: string; color?: string }[]; annotated?: number; status?: string; onClick?: () => void }) {
  return (
    <Card hover className="cl-paper" onClick={onClick}>
      <div className="thumb">
        <b>PDF</b>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h4>{title}</h4>
        <div className="auth">{authors}</div>
        <div className="meta">
          {arxiv && <span className="cl-mono cl-faint">arXiv:{arxiv}</span>}
          {pages && <span className="cl-mono cl-faint">· {pages} pp</span>}
          {annotated != null && (
            <Tag tone="lilac" icon="pencil">
              {annotated} notes
            </Tag>
          )}
          {status === 'local' && (
            <Tag tone="amber" icon="upload">
              Waiting to sync
            </Tag>
          )}
          {tags.map((t) => (
            <Tag key={t.name} tone={t.color}>
              #{t.name}
            </Tag>
          ))}
        </div>
      </div>
      <IconButton icon="more" label="Paper options" />
    </Card>
  );
}

export function StickyNote({ title, body, tone = 'amber', when, dragging, style, onClick }: { title: string; body: string; tone?: string; when?: string; dragging?: boolean; style?: CSSProperties; onClick?: () => void }) {
  return (
    <div className={cx('cl-sticky', 'w-' + tint(tone), dragging && 'is-dragging')} style={style} onClick={onClick}>
      <h5>{title}</h5>
      <p>{body}</p>
      {when && <span className="when">{when}</span>}
    </div>
  );
}

export interface TodoItem {
  id?: string;
  text: string;
  completed?: boolean;
  dueTime?: string;
  soon?: boolean;
}

export function TodoList({ items = [], onAddPlaceholder = 'Add a task for today…', showAdd = true, onToggleItem, onAddItem }: { items?: TodoItem[]; onAddPlaceholder?: string; showAdd?: boolean; onToggleItem?: (index: number, checked: boolean) => void; onAddItem?: (text: string) => void }) {
  const [list, setList] = useState(items);
  const [newText, setNewText] = useState('');

  const handleToggle = (i: number, v: boolean) => {
    if (onToggleItem) {
      onToggleItem(i, v);
    } else {
      setList(list.map((x, j) => (j === i ? { ...x, completed: v } : x)));
    }
  };

  const handleAddSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newText.trim()) {
      if (onAddItem) onAddItem(newText.trim());
      setNewText('');
    }
  };

  return (
    <div className="cl-todo">
      {(onToggleItem ? items : list).map((t, i) => (
        <div className="cl-todo-item" key={t.id || i}>
          <Checkbox checked={!!t.completed} onChange={(v) => handleToggle(i, v)}>
            {t.text}
          </Checkbox>
          {t.dueTime && <span className={cx('time', t.soon && !t.completed && 'is-soon')}>{t.dueTime}</span>}
          <span className="acts">
            <IconButton icon="pencil" label="Edit" iconSize={14} />
            <IconButton icon="trash" label="Delete" iconSize={14} />
          </span>
        </div>
      ))}
      {showAdd && (
        <label className="cl-todo-add" style={{ marginTop: 6 }}>
          <Icon name="plus" size={15} />
          <input
            placeholder={onAddPlaceholder}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={handleAddSubmit}
          />
          <Icon name="clock" size={15} />
        </label>
      )}
    </div>
  );
}

export function DailyCard({ date, icon = 'bulb', prose, tasksTitle = 'Today', tasks = [], footer = 'Just now', tag, showAdd, onToggleItem, onAddItem }: { date: string; icon?: string; prose?: ReactNode; tasksTitle?: string; tasks?: TodoItem[]; footer?: string; tag?: string; showAdd?: boolean; onToggleItem?: (i: number, v: boolean) => void; onAddItem?: (t: string) => void }) {
  return (
    <Card className="cl-daily">
      <div className="date">
        <h4>
          <Icon name={icon} size={20} stroke={2} />
          {date}
        </h4>
        <IconButton icon="pencil" label="Edit" iconSize={15} />
      </div>
      {prose && <p className="prose">{prose}</p>}
      <div>
        <div className="tasks-h" style={{ marginBottom: 6 }}>
          {tasksTitle}
        </div>
        <TodoList items={tasks} showAdd={showAdd} onToggleItem={onToggleItem} onAddItem={onAddItem} />
      </div>
      <div className="foot">
        <span>{footer}</span>
        <span className="cl-row" style={{ gap: 6 }}>
          {tag && <span>#{tag}</span>}
          <IconButton icon="more" label="More" iconSize={15} style={{ width: 24, height: 24 }} />
        </span>
      </div>
    </Card>
  );
}

export function AgendaItem({ time, title, detail, tone = 'sky', done }: { time: string; title: string; detail?: string; tone?: string; done?: boolean }) {
  return (
    <div className={cx('cl-agenda', done && 'is-done')}>
      <span className="t">{time}</span>
      <div className={cx('ev', 'w-' + tint(tone))}>
        <b>{title}</b>
        {detail && <span>{detail}</span>}
      </div>
    </div>
  );
}

export function CardTitle({ icon, title, info, actions = true }: { icon?: string; title: string; info?: boolean; actions?: boolean }) {
  return (
    <div className="cl-card-head">
      <span className="cl-card-title">
        {icon && <Icon name={icon} size={16} />}
        {title}
        {info && <Icon name="info" size={14} className="cl-faint" />}
      </span>
      {actions && (
        <span className="cl-card-actions">
          <IconButton icon="expand" label="Expand" iconSize={13} />
          <IconButton icon="more" label="More" iconSize={13} />
        </span>
      )}
    </div>
  );
}

export function BarChart({ data = [], labels, active, average, height = 84, tip }: { data?: number[]; labels?: string[]; active?: number; average?: number; height?: number; tip?: string | number }) {
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

export function StatCard({ icon, title, value, unit, delta, deltaLabel = 'vs last week', chart, style }: { icon?: string; title: string; value: string | number; unit?: string; delta?: number; deltaLabel?: string; chart?: any; style?: CSSProperties }) {
  return (
    <Card className="cl-stat" style={style}>
      <CardTitle icon={icon} title={title} info />
      <div className="v">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {delta != null && (
        <div className="sub">
          <DeltaChip value={delta} />
          {deltaLabel}
        </div>
      )}
      {chart && <BarChart {...chart} />}
    </Card>
  );
}

export function StreakCard({ days = 12, week = [1, 1, 1, 1, 0, 0, 0], todayIndex = 4, tasksDone = 0, notesLogged = 0 }: { days?: number; week?: number[]; todayIndex?: number; tasksDone?: number; notesLogged?: number }) {
  const L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <Card className="cl-streak">
      <CardTitle icon="flame" title="Active streak" />
      <div className="hero">
        <div className="flame">
          <Icon name="flame" size={28} stroke={1.8} />
        </div>
        <div>
          <div className="v">
            {days}
            <small>days</small>
          </div>
          <p>Write a note or finish a task today to keep it going.</p>
        </div>
      </div>
      <div className="cl-week">
        {L.map((l, i) => (
          <div key={i} className={cx(week[i] ? 'done' : '', i === todayIndex && 'today')}>
            <i>{week[i] ? <Icon name="check" size={15} stroke={2.6} /> : ''}</i>
            {l}
          </div>
        ))}
      </div>
      <div className="totals">
        <div>
          <b>{tasksDone}</b>
          <span>Tasks done</span>
        </div>
        <div>
          <b>{notesLogged}</b>
          <span>Notes logged</span>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- AI ---------------- */
export function Markdown({ children }: { children: ReactNode }) {
  if (typeof children !== 'string') {
    return <div className="md">{children}</div>;
  }

  const text = children;
  if (!text.trim()) return null;

  const parseInline = (str: string): ReactNode[] => {
    const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?:\b|_)\*[^*]+\*(?:\b|_)|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={idx}>{part.slice(1, -1)}</code>;
      }
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
        return <em key={idx}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('~~') && part.endsWith('~~')) {
        return <del key={idx}>{part.slice(2, -2)}</del>;
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a key={idx} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let currentList: ReactNode[] = [];
  let isNumberedList = false;

  const flushList = (key: string) => {
    if (currentList.length > 0) {
      if (isNumberedList) {
        elements.push(<ol key={`ol-${key}`}>{currentList}</ol>);
      } else {
        elements.push(<ul key={`ul-${key}`}>{currentList}</ul>);
      }
      currentList = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            style={{
              background: 'var(--surface-inset)',
              padding: '10px 12px',
              borderRadius: 6,
              overflowX: 'auto',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              margin: '8px 0',
            }}
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        flushList(`before-code-${i}`);
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList(`hr-${i}`);
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '12px 0' }} />);
      return;
    }

    const bulletMatch = trimmed.match(/^([-*+])\s+(.*)/);
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);

    if (bulletMatch) {
      if (isNumberedList) flushList(`num-to-bullet-${i}`);
      isNumberedList = false;
      currentList.push(<li key={`li-${i}`}>{parseInline(bulletMatch[2])}</li>);
      return;
    }

    if (numMatch) {
      if (!isNumberedList) flushList(`bullet-to-num-${i}`);
      isNumberedList = true;
      currentList.push(<li key={`li-${i}`}>{parseInline(numMatch[2])}</li>);
      return;
    }

    flushList(`end-list-${i}`);

    if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={i}>{parseInline(trimmed.slice(2))}</h2>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={i}>{parseInline(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={i}>{parseInline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith('#### ')) {
      elements.push(<h4 key={i}>{parseInline(trimmed.slice(5))}</h4>);
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={i}
          style={{
            borderLeft: '3px solid var(--ai-ink)',
            paddingLeft: 10,
            margin: '8px 0',
            color: 'var(--ink-2)',
            fontStyle: 'italic',
          }}
        >
          {parseInline(trimmed.slice(2))}
        </blockquote>
      );
    } else if (trimmed.length > 0) {
      elements.push(<p key={i}>{parseInline(trimmed)}</p>);
    }
  });

  flushList('final');
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre
        key="code-final"
        style={{
          background: 'var(--surface-inset)',
          padding: '10px 12px',
          borderRadius: 6,
          overflowX: 'auto',
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
          margin: '8px 0',
        }}
      >
        <code>{codeBlockLines.join('\n')}</code>
      </pre>
    );
  }

  return <div className="md">{elements.length > 0 ? elements : parseInline(text)}</div>;
}

export function ChatMessage({
  role = 'assistant',
  children,
  thought,
  streaming,
  loading,
  actions = true,
  onInsert,
}: {
  role?: 'user' | 'assistant';
  children: ReactNode;
  thought?: string;
  streaming?: boolean;
  loading?: boolean;
  actions?: boolean;
  onInsert?: () => void;
}) {
  if (role === 'user') return <div className="cl-msg-user">{children}</div>;
  return (
    <div className="cl-msg-ai">
      {thought && (
        <button className="cl-thought">
          <Icon name="bulb" size={16} />
          {thought}
          <Icon name="chevron-right" size={14} />
        </button>
      )}
      <Markdown>
        {loading ? (
          <span className="cl-row" style={{ gap: 8, color: 'var(--ink-2)' }}>
            <span className="cl-sync is-busy" style={{ padding: 0 }}><i /></span>
            {children}
          </span>
        ) : (
          <>
            {children}
            {streaming && <span className="cl-caret" />}
          </>
        )}
      </Markdown>
      {actions && !streaming && !loading && (
        <div className="cl-msg-acts">
          <Button variant="ghost" size="sm" icon="arrow-up-right" onClick={onInsert}>
            Insert into note
          </Button>
          <span className="sep" />
          <IconButton icon="copy" label="Copy" iconSize={15} />
          <IconButton icon="thumb-up" label="Good response" iconSize={15} />
          <IconButton icon="thumb-down" label="Bad response" iconSize={15} />
          <IconButton icon="refresh" label="Regenerate" iconSize={15} />
        </div>
      )}
    </div>
  );
}

export interface ComposerProps {
  context?: string[];
  placeholder?: string;
  model?: string;
  busy?: boolean;
  onSend?: (msg: string) => void;
}

export function Composer({ context = [], placeholder = 'Ask about this paper, or press @ to add context', model = 'gemma4 · local', busy, onSend }: ComposerProps) {
  const [v, setV] = useState('');
  const handleSend = () => {
    if (v.trim() && onSend && !busy) {
      onSend(v.trim());
      setV('');
    }
  };

  return (
    <div className="cl-composer">
      <div className="ctx">
        <IconButton icon="at" label="Add context" iconSize={16} style={{ width: 26, height: 26 }} />
        {context.map((c) => (
          <span key={c} className="cl-ctxchip">
            <Icon name="pdf" size={14} />
            <span>{c}</span>
          </span>
        ))}
      </div>
      <textarea
        rows={2}
        placeholder={placeholder}
        value={v}
        disabled={busy}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        aria-label="Message Clio"
      />
      <div className="bar">
        <IconButton icon="clip" label="Attach" iconSize={16} />
        <span className="cl-topbar-sep" style={{ height: 16, margin: '0 2px' }} />
        <span className="model">
          {model}
          <Icon name="chevron-down" size={12} />
        </span>
        <button className="cl-send" aria-label="Send" disabled={(!v && !busy) || busy} onClick={handleSend}>
          {busy ? <span style={{ width: 10, height: 10, background: 'currentColor', borderRadius: 2 }} /> : <Icon name="arrow-up" size={17} stroke={2.2} />}
        </button>
      </div>
    </div>
  );
}

export function SmartNote({
  title,
  status = 'idle',
  children,
  open: initialOpen = true,
  onGenerate,
  onRetry,
}: {
  title: string;
  status?: 'idle' | 'loading' | 'done' | 'error';
  children?: ReactNode;
  open?: boolean;
  onGenerate?: () => void;
  onRetry?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  useEffect(() => {
    if (status === 'done' || status === 'loading') {
      setIsOpen(true);
    }
  }, [status]);

  const st: Record<string, [string, string]> = {
    idle: ['Not generated', ''],
    loading: ['Generating…', 'is-loading'],
    done: ['Ready', 'is-done'],
    error: ['Failed', 'is-error'],
  };
  const currentSt = st[status] || st.idle;

  return (
    <div className={`cl-smart ${isOpen ? 'is-open' : ''}`}>
      <div
        className="cl-smart-head"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Icon
          name={status === 'done' ? 'check-circle' : status === 'error' ? 'alert' : 'spark'}
          size={16}
          className={status === 'done' ? '' : 'cl-muted'}
          style={status === 'done' ? { color: 'var(--sage-ink)' } : status === 'loading' ? { color: 'var(--ai-ink)' } : undefined}
        />
        <b style={{ flex: 1 }}>{title}</b>
        <span className={cx('cl-smart-state', currentSt[1])}>{currentSt[0]}</span>
        {status === 'idle' && (
          <Button
            size="sm"
            variant="ai"
            icon="spark"
            onClick={(e) => {
              e.stopPropagation();
              onGenerate?.();
            }}
          >
            Generate
          </Button>
        )}
        {status === 'error' && (
          <Button
            size="sm"
            variant="secondary"
            icon="refresh"
            onClick={(e) => {
              e.stopPropagation();
              onRetry?.();
            }}
          >
            Retry
          </Button>
        )}
        {status === 'done' && (
          <IconButton
            icon="refresh"
            label="Regenerate"
            iconSize={15}
            onClick={(e) => {
              e.stopPropagation();
              onGenerate?.();
            }}
          />
        )}
        <IconButton
          icon={isOpen ? 'chevron-down' : 'chevron-right'}
          label={isOpen ? 'Collapse' : 'Expand'}
          iconSize={14}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
        />
      </div>

      {isOpen && status === 'loading' && (
        <div className="cl-smart-body">
          <div className="cl-row" style={{ gap: 8, color: 'var(--ink-2)', fontSize: 13, marginBottom: 8 }}>
            <span className="cl-sync is-busy" style={{ padding: 0 }}><i /></span>
            <span>Processing document context with AI model…</span>
          </div>
          {children && typeof children === 'string' && children.trim() ? (
            <div style={{ position: 'relative' }}>
              <Markdown>{children}</Markdown>
              <span className="cl-caret" />
            </div>
          ) : (
            <>
              <div className="cl-shimmer" style={{ width: '92%', height: 14, borderRadius: 4, marginBottom: 6 }} />
              <div className="cl-shimmer" style={{ width: '78%', height: 14, borderRadius: 4, marginBottom: 6 }} />
              <div className="cl-shimmer" style={{ width: '85%', height: 14, borderRadius: 4 }} />
            </>
          )}
        </div>
      )}

      {isOpen && status === 'done' && (
        <div className="cl-smart-body">
          <Markdown>{children}</Markdown>
        </div>
      )}

      {isOpen && status === 'error' && (
        <div className="cl-smart-body" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--danger)' }}>
          Could not process document summary. Make sure a paper is active.
        </div>
      )}
    </div>
  );
}

export const SMART_PROMPTS = [
  'Summary',
  'Network Architecture',
  'Molecule Representation',
  'Conditioning Mechanism',
  'Datasets',
  'Evaluation criteria',
  'Hyperparameters',
  'Key results',
  'Challenges solved',
];

export interface AIPanelProps {
  tab?: 'chat' | 'notes';
  file?: string;
  children?: ReactNode | ((tab: string) => ReactNode);
  footer?: ReactNode;
  onClose?: () => void;
  onSend?: (msg: string) => void;
  busy?: boolean;
}

export function AIPanel({ tab = 'chat', file, children, footer, onClose, onSend, busy }: AIPanelProps) {
  const [t, setT] = useState(tab);
  return (
    <aside className="cl-ai" aria-label="Clio AI">
      <div className="cl-ai-resize" aria-hidden="true" />
      <div className="cl-ai-head">
        <span className="cl-ai-title">
          <Icon name="spark" size={17} className="spark" />
          Clio AI
          <Icon name="chevron-down" size={14} className="cl-faint" />
        </span>
        <span className="cl-row" style={{ gap: 0 }}>
          <IconButton icon="edit" label="New chat" />
          <IconButton icon="trash" label="Clear chat history" />
          <IconButton icon="x" label="Close panel" onClick={onClose} />
        </span>
      </div>
      <div className="cl-ai-tabs">
        <SegmentedControl
          value={t}
          onChange={(v) => setT(v as any)}
          options={[
            { value: 'chat', label: 'Chat', icon: 'message' },
            { value: 'notes', label: 'Smart notes', icon: 'spark' },
          ]}
        />
      </div>
      {file && (
        <div className="cl-ai-ctx">
          <Icon name="link" size={14} />
          Reading{' '}
          <b style={{ color: 'var(--ink)', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file}
          </b>
        </div>
      )}
      <div className="cl-ai-body">{typeof children === 'function' ? children(t) : children}</div>
      {t === 'chat' && (footer !== undefined ? footer : <Composer context={file ? [file] : []} onSend={onSend} busy={busy} />)}
    </aside>
  );
}

/* ---------------- Canvas & Dock ---------------- */
function PenArt({ kind, color }: { kind: string; color?: string }) {
  const c = `var(--${color || 'pen-black'})`;
  const body: Record<string, string> = {
    pen: '#2a2724',
    pencil: '#e9e4db',
    highlighter: '#f5f2ec',
    eraser: '#f5f2ec',
    ruler: '#e8cf8a',
    text: '#f5f2ec',
    sticky: '#f5f2ec',
    select: '#f5f2ec',
  };
  if (kind === 'ruler')
    return (
      <svg width="34" height="64" viewBox="0 0 34 64">
        <rect x="5" y="6" width="24" height="60" rx="3" fill="#e9d59a" stroke="#c7ad62" />
        {[14, 22, 30, 38, 46].map((y) => (
          <path key={y} d={`M5 ${y}h${y % 16 === 14 ? 10 : 6}`} stroke="#a8904a" strokeWidth="1.4" />
        ))}
      </svg>
    );
  if (kind === 'eraser')
    return (
      <svg width="34" height="64" viewBox="0 0 34 64">
        <rect x="7" y="20" width="20" height="46" rx="4" fill="#ecebe8" stroke="#cfcac2" />
        <rect x="7" y="6" width="20" height="18" rx="5" fill="#f2a3ae" stroke="#d98794" />
      </svg>
    );
  if (kind === 'highlighter')
    return (
      <svg width="34" height="64" viewBox="0 0 34 64">
        <path d="M11 4h12l2 10H9z" fill={c} opacity=".85" />
        <rect x="7" y="14" width="20" height="52" rx="4" fill="#eef4fb" stroke="#c9d6e6" />
        <rect x="7" y="26" width="20" height="5" fill={c} opacity=".6" />
      </svg>
    );
  if (kind === 'pencil')
    return (
      <svg width="34" height="64" viewBox="0 0 34 64">
        <path d="M17 2l7 18H10z" fill="#e8d2b0" />
        <path d="M17 2l2.6 6.6h-5.2z" fill={c} />
        <rect x="10" y="20" width="14" height="46" fill="#dcd6cc" stroke="#bdb5a8" />
        <path d="M14.5 20v46M19.5 20v46" stroke="#bdb5a8" />
      </svg>
    );
  if (kind === 'pen')
    return (
      <svg width="34" height="64" viewBox="0 0 34 64">
        <path d="M17 2l6 16H11z" fill={c} />
        <rect x="9" y="18" width="16" height="48" rx="5" fill={c} />
        <rect x="9" y="30" width="16" height="4" fill="#fff" opacity=".35" />
      </svg>
    );
  const glyph: Record<string, string> = { text: 'type', sticky: 'sticky', select: 'cursor' };
  return (
    <svg width="34" height="64" viewBox="0 0 34 64">
      <rect x="5" y="12" width="24" height="54" rx="8" fill={body[kind] || '#f5f2ec'} stroke="#d4cec4" />
      <g transform="translate(8 18) scale(0.75)" stroke="#5c554c" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICONS[glyph[kind] || 'cursor']} />
      </g>
    </svg>
  );
}

export const TOOLS = [
  { id: 'pen', label: 'Pen' },
  { id: 'pencil', label: 'Pencil' },
  { id: 'highlighter', label: 'Highlighter' },
  { id: 'eraser', label: 'Eraser' },
  { id: 'ruler', label: 'Ruler' },
  { id: 'text', label: 'Text' },
  { id: 'sticky', label: 'Sticky' },
  { id: 'select', label: 'Select' },
];

export interface ToolDockProps {
  active?: string;
  color?: string;
  tools?: typeof TOOLS;
  onSelect?: (toolId: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  onAddPage?: () => void;
}

export function ToolDock({ active = 'pen', color = 'pen-black', tools = TOOLS, onSelect, onUndo, onRedo, onClear, onAddPage }: ToolDockProps) {
  const [a, setA] = useState(active);
  const cur = onSelect ? active : a;
  return (
    <div className="cl-dock" role="toolbar" aria-label="Drawing tools">
      {tools.map((t) => (
        <button
          key={t.id}
          className={cx('cl-tool', cur === t.id && 'is-on')}
          aria-label={t.label}
          title={t.label}
          aria-pressed={cur === t.id}
          onClick={() => (onSelect ? onSelect(t.id) : setA(t.id))}
        >
          <PenArt kind={t.id} color={t.id === 'pen' || t.id === 'pencil' ? color : t.id === 'highlighter' ? 'pen-amber' : undefined} />
          {cur === t.id && ['pen', 'pencil', 'highlighter', 'eraser'].includes(t.id) && (
            <span className="caret">
              <Icon name="chevron-down" size={10} stroke={2.4} />
            </span>
          )}
        </button>
      ))}
      <span className="sep" />
      <IconButton icon="plus" label="Add page" onClick={onAddPage} />
      <IconButton icon="undo" label="Undo" onClick={onUndo} />
      <IconButton icon="redo" label="Redo" onClick={onRedo} />
      <IconButton icon="trash" label="Clear all annotations" onClick={onClear} />
    </div>
  );
}

export interface ToolPopoverProps {
  tool?: string;
  size?: number;
  color?: string;
  palmRejection?: boolean;
  onSizeChange?: (s: number) => void;
  onColorChange?: (c: string) => void;
}

export function ToolPopover({ tool = 'pen', size = 3, color = 'pen-black', palmRejection = true, onSizeChange, onColorChange }: ToolPopoverProps) {
  const [s, setS] = useState(size);
  const sizes = [1, 2, 3, 5, 8, 12, 16];
  return (
    <div className="cl-popover" role="dialog" aria-label="Tool settings">
      <h6>Tool</h6>
      <SegmentedControl value={tool} options={[{ value: 'pen', label: 'Pen' }, { value: 'pencil', label: 'Pencil' }, { value: 'highlighter', label: 'Marker' }]} />
      <h6>Size</h6>
      <div className="cl-sizes">
        {sizes.map((z) => (
          <button
            key={z}
            aria-label={'Size ' + z}
            className={cx('cl-size', (onSizeChange ? size : s) === z && 'is-on')}
            onClick={() => (onSizeChange ? onSizeChange(z) : setS(z))}
          >
            <i style={{ width: Math.min(22, z + 2), height: Math.min(22, z + 2) }} />
          </button>
        ))}
      </div>
      <h6>Colour</h6>
      <ColorPicker colors={PEN_COLORS} value={color} onChange={onColorChange} allowCustom label="Ink colour" />
      <div className="cl-toggle" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <span className="cl-row" style={{ gap: 8 }}>
          <Icon name="hand" size={16} className="cl-muted" />
          Palm rejection
        </span>
        <Switch on={palmRejection} label="Palm rejection" />
      </div>
    </div>
  );
}

export function NotebookPage({ width = 560, height = 720, ruled = true, lineSpacing = 32, page, children, style }: { width?: number; height?: number; ruled?: boolean; lineSpacing?: number; page?: string; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div className={cx('cl-page', ruled && 'is-ruled')} style={{ width, height, '--rule': lineSpacing + 'px', ...style } as CSSProperties}>
      {children}
      {page && <span className="cl-page-num">{page}</span>}
    </div>
  );
}

export function CanvasTagBar({ tags = [], onRemoveTag, onAddTag }: { tags?: { name: string; color?: string }[]; onRemoveTag?: (name: string) => void; onAddTag?: () => void }) {
  return (
    <div className="cl-tagbar">
      <Icon name="tag" size={15} className="cl-faint" />
      {tags.map((t) => (
        <Tag key={t.name} tone={t.color} onRemove={onRemoveTag ? () => onRemoveTag(t.name) : undefined}>
          #{t.name}
        </Tag>
      ))}
      <button className="add" onClick={onAddTag}>
        <Icon name="plus" size={12} />Add tag
      </button>
    </div>
  );
}

/* ---------------- Calendar ---------------- */
export interface MiniCalendarProps {
  month?: string;
  startOffset?: number;
  days?: number;
  today?: number;
  selected?: number;
  marked?: number[];
  onSelectDay?: (day: number) => void;
}

export function MiniCalendar({ month = 'September 2026', startOffset = 1, days = 30, today = 25, selected = 25, marked = [], onSelectDay }: MiniCalendarProps) {
  const cells: { d: number; out?: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({ d: 31 - startOffset + i + 1, out: true });
  for (let d = 1; d <= days; d++) cells.push({ d });
  while (cells.length % 7) cells.push({ d: cells.length - days - startOffset + 1, out: true });
  return (
    <div className="cl-mcal">
      <div className="cl-mcal-head">
        <b>{month}</b>
        <span className="cl-row" style={{ gap: 0 }}>
          <IconButton icon="chevron-left" label="Previous month" />
          <IconButton icon="chevron-right" label="Next month" />
        </span>
      </div>
      <div className="cl-mcal-grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {cells.map((c, i) => (
          <button
            key={i}
            className={cx(c.out && 'out', !c.out && c.d === today && 'today', !c.out && c.d === selected && 'sel', !c.out && marked.includes(c.d) && 'has')}
            onClick={() => !c.out && onSelectDay && onSelectDay(c.d)}
          >
            {c.d}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EventBlock({ title, time, tone = 'sky', done, compact, style, onClick }: { title: string; time?: string; tone?: string; done?: boolean; compact?: boolean; style?: CSSProperties; onClick?: () => void }) {
  return (
    <div className={cx('cl-event', 'w-' + tint(tone), done && 'is-done', compact && 'is-compact')} style={style} onClick={onClick}>
      <b>{title}</b>
      {time && <span>{time}</span>}
    </div>
  );
}

/* ---------------- Overlays & feedback ---------------- */
export interface ModalProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  width?: number;
  inline?: boolean;
}

export function Modal({ title, description, children, footer, onClose, width, inline = true }: ModalProps) {
  const box = (
    <div className="cl-modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { maxWidth: width } : undefined}>
      <div className="cl-modal-head">
        <div>
          <h2 className="cl-h-lg">{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <IconButton icon="x" label="Close" onClick={onClose} />
      </div>
      <div className="cl-modal-body">{children}</div>
      {footer && <div className="cl-modal-foot">{footer}</div>}
    </div>
  );
  return inline ? <div className="cl-scrim" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>{box}</div> : box;
}

export interface MenuItem {
  icon?: string;
  label?: string;
  shortcut?: string;
  danger?: boolean;
  heading?: boolean;
  onClick?: () => void;
}

export function Menu({ items = [] }: { items?: (MenuItem | '-')[] }) {
  return (
    <div className="cl-menu" role="menu">
      {items.map((it, i) =>
        it === '-' ? (
          <hr key={i} />
        ) : (it as MenuItem).label && (it as MenuItem).heading ? (
          <div className="lbl" key={i}>{(it as MenuItem).label}</div>
        ) : (
          <button key={i} role="menuitem" className={(it as MenuItem).danger ? 'is-danger' : ''} onClick={(it as MenuItem).onClick}>
            {(it as MenuItem).icon && <Icon name={(it as MenuItem).icon!} size={16} />}
            {(it as MenuItem).label}
            {(it as MenuItem).shortcut && <span className="k">{(it as MenuItem).shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}

export function Tooltip({ children, shortcut }: { children: ReactNode; shortcut?: string }) {
  return (
    <span className="cl-tip" role="tooltip">
      {children}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </span>
  );
}

export function Banner({ tone = 'info', icon, title, children, action }: { tone?: 'info' | 'ai' | 'danger' | 'success'; icon?: string; title?: string; children: ReactNode; action?: ReactNode }) {
  const ic = icon || { info: 'info', ai: 'spark', danger: 'alert', success: 'check-circle' }[tone];
  return (
    <div className={cx('cl-banner', 'is-' + tone)} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="ico">
        <Icon name={ic} size={16} />
      </span>
      <span className="txt">
        {title && <b>{title} </b>}
        {children}
      </span>
      {action}
    </div>
  );
}

export function EmptyState({ icon = 'folder', title, children, action }: { icon?: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="cl-empty">
      <span className="ico">
        <Icon name={icon} size={22} />
      </span>
      <h4>{title}</h4>
      <p>{children}</p>
      {action}
    </div>
  );
}

export interface QuickActionItem {
  icon: string;
  label: string;
  tone?: string;
  onClick?: () => void;
}

export function QuickActions({ items = [] }: { items?: QuickActionItem[] }) {
  return (
    <div className="cl-quick">
      {items.map((q) => (
        <button key={q.label} onClick={q.onClick}>
          <span className={cx('ico', 't-' + tint(q.tone))}>
            <Icon name={q.icon} size={14} stroke={2} />
          </span>
          {q.label}
        </button>
      ))}
    </div>
  );
}

export interface ConnectionFormProps {
  status?: 'connected' | 'connecting' | 'failed' | 'idle';
  url?: string;
  serverUrl?: string;
  username?: string;
  password?: string;
  papersPath?: string;
  syncPath?: string;
  connected?: boolean;
  busy?: boolean;
  error?: string | null;
  onConnect?: (url: string, username: string, pass: string) => void;
  onSave?: (data: { url: string; username: string; papersPath: string; syncPath: string }) => void;
}

export function ConnectionForm({
  status,
  url,
  serverUrl = 'http://100.100.133.10:30027',
  username = 'aeacus',
  password = '',
  papersPath = '/',
  syncPath = '/Chlio',
  connected = false,
  busy = false,
  error,
  onConnect,
  onSave,
}: ConnectionFormProps) {
  const [u, setU] = useState(url || serverUrl);
  const [user, setUser] = useState(username);
  const [pass, setPass] = useState(password);
  const [pp, setPp] = useState(papersPath);
  const [sp, setSp] = useState(syncPath);

  const effectiveStatus = status || (connected ? 'connected' : busy ? 'connecting' : error ? 'failed' : 'idle');

  const s = {
    connected: ['Connected', `Synced with ${u}`],
    connecting: ['Connecting…', 'Checking WebDAV credentials'],
    failed: ['Connection failed', error || 'Unauthorized — check app password'],
    idle: ['Not connected', 'Enter password to connect'],
  }[effectiveStatus];

  return (
    <div className="cl-conn">
      <div className="cl-conn-status">
        <span className="ico">
          <Icon name="cloud" size={18} />
        </span>
        <span className="t">
          <b>Nextcloud · {s[0]}</b>
          <span>{s[1]}</span>
        </span>
        <span className={cx('cl-sync', { connected: '', connecting: 'is-busy', failed: 'is-fail', idle: 'is-off' }[effectiveStatus])} style={{ padding: 0 }}>
          <i />
        </span>
      </div>
      <TextField label="Server URL" value={u} onChange={(e) => setU(e.target.value)} mono />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <TextField label="Username" value={user} onChange={(e) => setUser(e.target.value)} />
        <TextField label="App password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••••" />
      </div>
      <label className="cl-field">
        <span className="cl-field-label">Papers folder</span>
        <div className="cl-pathrow">
          <input className="cl-input" value={pp} onChange={(e) => setPp(e.target.value)} />
          <Button icon="folder">Browse</Button>
        </div>
      </label>
      <label className="cl-field">
        <span className="cl-field-label">Upload & sync folder</span>
        <div className="cl-pathrow">
          <input className="cl-input" value={sp} onChange={(e) => setSp(e.target.value)} />
          <Button icon="folder">Browse</Button>
        </div>
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        {onConnect && (
          <Button variant="primary" icon="check" disabled={busy} onClick={() => onConnect(u, user, pass)}>
            {busy ? 'Connecting…' : 'Connect Nextcloud'}
          </Button>
        )}
        {onSave && (
          <Button variant="ghost" icon="check" onClick={() => onSave({ url: u, username: user, papersPath: pp, syncPath: sp })}>
            Save settings
          </Button>
        )}
      </div>
    </div>
  );
}

export { Icon, ICONS };
