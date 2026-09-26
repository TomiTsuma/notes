// @card group="Pages" height=860 width=1440 page
import { C, mount } from "./_mount.js";
import { App } from "./_shell.jsx";
import { TASKS } from "./_data.js";
mount(<App view="projects" crumbs={['Project Hub', 'Molecular Generation Review']}>
  <div className="cl-view">
    <div className="cl-group w-lilac" style={{ padding: '24px 28px', gap: 16, marginBottom: 24 }}>
      <div className="cl-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div>
          <div className="cl-row" style={{ gap: 8, marginBottom: 8 }}><C.Tag tone="lilac">Scoping review</C.Tag><C.StatusPill status="inprogress" /></div>
          <h1 className="cl-h-display">Molecular Generation Review</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-2)', maxWidth: 620 }}>Diffusion-based generative models for de novo molecule design — screening, extraction and synthesis for the PRISMA-ScR review.</p>
        </div>
        <div className="cl-row" style={{ flexWrap: 'nowrap' }}><C.Button icon="pencil">Edit</C.Button><C.Button variant="primary" icon="plus">New note</C.Button><C.IconButton icon="more" label="Project options" /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <C.Card className="cl-stat" style={{ padding: '12px 16px' }}><span className="cl-overline">Notebooks</span><div className="v" style={{ fontSize: 24, margin: 0 }}>6</div></C.Card>
        <C.Card className="cl-stat" style={{ padding: '12px 16px' }}><span className="cl-overline">Linked files</span><div className="v" style={{ fontSize: 24, margin: 0 }}>18</div></C.Card>
        <C.Card className="cl-stat" style={{ padding: '12px 16px' }}><span className="cl-overline">Open tasks</span><div className="v" style={{ fontSize: 24, margin: 0 }}>5</div></C.Card>
        <C.Card style={{ padding: '12px 16px' }} className="w-lilac"><C.ProgressDots value={62} total={16} label="Kanban progress" /></C.Card>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24, alignItems: 'start' }}>
      <div>
        <C.SectionHeader title="Notebooks & notes" icon="notebook" actions={<><C.Button size="sm" icon="notebook">New notebook</C.Button><C.Button size="sm" icon="markdown">New note</C.Button></>} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <C.NoteCard title="Screening log" kind="notebook" body="412 records → 96 full texts → 38 included." updated="Today" tags={[{ name: 'methods', color: 'sky' }]} />
          <C.NoteCard title="GVT annotations" kind="pdf" body="Codebook size 512 — check the ablation in table 6." updated="1h ago" />
          <C.NoteCard title="Charting form" body="Model family · representation · conditioning · datasets · metrics." updated="Sep 22" />
          <C.AddTile label="Link an unsorted note" minHeight={150} />
        </div>
      </div>
      <C.Card style={{ padding: 16 }}>
        <C.CardTitle icon="kanban" title="Kanban tasks" actions={false} />
        <div className="cl-col" style={{ gap: 10, marginTop: 12 }}>
          {[...TASKS.inprogress.slice(0, 1), ...TASKS.todo.slice(0, 1), ...TASKS.done.slice(0, 1)].map((t, i) => (
            <div key={t.id} className="cl-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
              <div style={{ minWidth: 0 }}><div className="cl-mono cl-faint">{t.id}</div><b style={{ fontSize: 13.5 }}>{t.title}</b></div>
              <C.StatusPill status={['inprogress', 'todo', 'done'][i]} />
            </div>
          ))}
          <C.Button variant="ghost" size="sm" iconRight="chevron-right">Open board</C.Button>
        </div>
      </C.Card>
    </div>
  </div>
</App>);
