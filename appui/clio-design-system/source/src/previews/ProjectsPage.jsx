// @card group="Pages" height=860 width=1440 page
import { C, mount } from "./_mount.js";
import { App } from "./_shell.jsx";
import { PROJECTS } from "./_data.js";
const React = window.React;
function Page() {
  const [mode, setMode] = React.useState('grid');
  return (
    <App view="projects" crumbs={['Home', 'Project Hub']}>
      <div className="cl-view">
        <C.ViewHeader title="Project Hub" subtitle="Group notebooks, papers and tasks by what you’re working towards."
          actions={<><C.SearchField placeholder="Search projects" style={{ width: 220 }} /><C.SegmentedControl iconOnly value={mode} onChange={setMode} options={[{ value: 'grid', label: 'Grid view', icon: 'grid' }, { value: 'list', label: 'List view', icon: 'list' }]} /><C.Button variant="primary" icon="plus">New project</C.Button></>} />
        <div className="cl-row" style={{ marginBottom: 20 }}>
          <C.SegmentedControl options={[{ value: 'all', label: 'All · 4' }, { value: 'star', label: 'Starred · 2' }, { value: 'done', label: 'Completed' }]} />
          <span style={{ flex: 1 }} />
          <C.Button variant="ghost" size="sm" icon="filter">Status</C.Button><C.Button variant="ghost" size="sm" iconRight="chevron-down">By activity</C.Button>
        </div>
        {mode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {PROJECTS.map((p) => <C.ProjectCard key={p.id} {...p} />)}
            <C.AddTile label="New project" />
          </div>
        ) : (
          <div className="cl-col" style={{ gap: 8 }}>{PROJECTS.map((p) => <C.ProjectRow key={p.id} {...p} />)}</div>
        )}
        <div className="cl-section">
          <C.SectionHeader title="Unsorted notes" icon="file" count={3} actions={<C.Button size="sm" icon="link">Link to project</C.Button>} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <C.NoteCard title="Random ideas" body="Could a VQ codebook help retrieve similar soil spectra?" updated="Sep 22" />
            <C.NoteCard title="Conference deadlines" kind="notebook" body="NeurIPS workshop — Oct 10. MLSB — Oct 3." updated="Sep 19" tags={[{ name: 'to-read', color: 'amber' }]} />
            <C.NoteCard title="Unfiled PDF" kind="pdf" body="Scaffold-constrained generation (2024)." updated="Sep 12" />
          </div>
        </div>
      </div>
    </App>
  );
}
mount(<Page />);
