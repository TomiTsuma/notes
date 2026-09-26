// @card group="Pages" height=860 width=1440 page
import { C, mount } from "./_mount.js";
import { App } from "./_shell.jsx";
import { PROJECTS, TODOS } from "./_data.js";
mount(<App view="home" crumbs={['Home', 'Dashboard']}>
  <div className="cl-view">
    <C.ViewHeader overline="Friday, 25 September" title="Good afternoon, Thomas" subtitle="3 tasks due today · 2 papers waiting to be read."
      actions={<><C.Button icon="upload">Upload</C.Button><C.Button variant="primary" icon="plus">New note</C.Button></>} />
    <C.QuickActions items={[{ icon: 'arxiv', label: 'Import arXiv', tone: 'rose' }, { icon: 'notebook', label: 'New notebook', tone: 'sky' }, { icon: 'sticky', label: 'New sticky', tone: 'amber' }, { icon: 'canvas', label: 'Open canvas', tone: 'lilac' }, { icon: 'calendar', label: 'Add event', tone: 'sage' }]} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.15fr', gap: 16, marginTop: 24, alignItems: 'start' }}>
      <C.StreakCard days={12} week={[1, 1, 1, 1, 1, 0, 0]} todayIndex={4} tasksDone={48} notesLogged={126} />
      <C.Card style={{ padding: '16px 18px 8px' }}>
        <C.CardTitle icon="calendar" title="Today’s agenda" actions={false} />
        <div style={{ marginTop: 8 }}>
          <C.AgendaItem time="09:00" title="Read GVT §4" detail="Molecular Gen" tone="lilac" done />
          <C.AgendaItem time="11:30" title="Lab meeting" detail="Room 204 · 45 min" tone="rose" />
          <C.AgendaItem time="14:30" title="Extraction sheet review" detail="Soil Spectra" tone="sage" />
          <C.AgendaItem time="17:00" title="Supervisor email" detail="MSc Dissertation" tone="sky" />
        </div>
      </C.Card>
      <C.DailyCard date="2026-09-25" tasksTitle="Today’s tasks" tasks={TODOS} showAdd footer="4 tasks · 2 done" />
    </div>
    <div className="cl-section">
      <C.SectionHeader title="Active projects" icon="hub" actions={<C.Button variant="ghost" size="sm" iconRight="chevron-right">Project Hub</C.Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {PROJECTS.slice(0, 3).map((p) => <C.ProjectCard key={p.id} {...p} />)}
        <C.AddTile label="New project" />
      </div>
    </div>
    <div className="cl-section">
      <C.SectionHeader title="Recent notebooks" icon="notebook" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <C.NoteCard title="Reading log" kind="notebook" body="GVT beats EDM on validity at 40× fewer sampling steps." updated="Just now" tags={[{ name: 'results', color: 'sage' }]} />
        <C.NoteCard title="GVT annotations" kind="pdf" subtitle="12 highlights" body="Codebook size 512 — check the ablation in table 6." updated="1h ago" />
        <C.NoteCard title="Supervisor meeting" body="Narrow scope to 2020–2026. Add an evaluation-metrics table." updated="Yesterday" tags={[{ name: 'meeting', color: 'rose' }]} />
      </div>
    </div>
  </div>
</App>);
