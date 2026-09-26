import { C } from './_mount.js';
import { LOGO, LOGO_DARK, PROJECTS, TREE, TAGS } from './_data.js';
const React = window.React;
export function App({ view, crumbs, panel, children, activeFileId, showDownload, sidebar = true }) {
  const [theme, setTheme] = React.useState(document.documentElement.getAttribute('data-theme') || 'light');
  const [open, setOpen] = React.useState(!!panel);
  const toggle = () => { const t = theme === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', t); setTheme(t); };
  return (
    <div style={{ padding: 24, height: 860, boxSizing: 'border-box', background: 'var(--canvas)' }}>
      <C.Window>
        {sidebar && <C.Sidebar logoLight={LOGO} logoDark={LOGO_DARK} activeView={view} projects={PROJECTS.slice(0, 3)} tree={TREE} tags={TAGS} activeFileId={activeFileId} counts={{ kanban: 7 }} />}
        <main className="cl-main">
          <C.TopBar crumbs={crumbs} theme={theme} onToggleTheme={toggle} panelOpen={open} onTogglePanel={() => setOpen(!open)} showDownload={showDownload} />
          {children}
        </main>
        {open && panel}
      </C.Window>
    </div>
  );
}
