// @card group="Pages" height=860 width=1440 page
import { C, mount } from "./_mount.js";
import { App } from "./_shell.jsx";
import { TASKS } from "./_data.js";
mount(<App view="kanban" crumbs={['Home', 'Kanban Board']}>
  <div className="cl-view" style={{ paddingBottom: 24 }}>
    <C.ViewHeader title="Kanban Board" subtitle="Track research tasks from idea to done."
      actions={<><C.Button iconRight="chevron-down"><span style={{ width: 8, height: 8, borderRadius: 3, background: 'var(--lilac-solid)' }} />All projects</C.Button><C.Button variant="ghost" icon="filter">Filters</C.Button><C.Button variant="primary" icon="plus">New task</C.Button></>} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
      {['todo', 'inprogress', 'review', 'done'].map((s) => (
        <C.KanbanColumn key={s} status={s} count={TASKS[s].length} over={s === 'review'}>
          {TASKS[s].map((t, i) => <C.TaskCard key={t.id} {...t} dragging={s === 'review' && false} />)}
        </C.KanbanColumn>
      ))}
    </div>
  </div>
</App>);
