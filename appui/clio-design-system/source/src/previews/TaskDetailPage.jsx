// @card group="Pages" height=860 width=1440 page
import { C, mount } from "./_mount.js";
import { App } from "./_shell.jsx";
import { TASKS } from "./_data.js";
mount(<App view="kanban" crumbs={['Kanban Board', 'CLIO-28']}>
  <div className="cl-view" style={{ position: 'relative' }}>
    <C.ViewHeader title="Kanban Board" actions={<C.Button variant="primary" icon="plus">New task</C.Button>} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
      {['todo', 'inprogress', 'review', 'done'].map((s) => <C.KanbanColumn key={s} status={s} count={TASKS[s].length}>{TASKS[s].map((t) => <C.TaskCard key={t.id} {...t} />)}</C.KanbanColumn>)}
    </div>
  </div>
  <C.Modal title="Write methods section draft" description="CLIO-28 · Molecular Generation Review" width={560}
    footer={<><C.Button variant="danger" icon="trash" className="left">Delete</C.Button><C.Button variant="ghost">Cancel</C.Button><C.Button variant="primary">Save changes</C.Button></>}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
      <div className="cl-field"><span className="cl-field-label">Status</span><C.Button iconRight="chevron-down" style={{ justifyContent: 'space-between' }}><C.StatusPill status="inprogress" /></C.Button></div>
      <div className="cl-field"><span className="cl-field-label">Priority</span><C.Button iconRight="chevron-down" style={{ justifyContent: 'space-between' }}><C.PriorityFlag priority="high" /></C.Button></div>
      <C.TextField label="Due date" type="text" defaultValue="Fri, 25 Sep" />
    </div>
    <C.TextField label="Title" defaultValue="Write methods section draft" />
    <C.TextField label="Description" multiline defaultValue="Search strategy, eligibility criteria, charting form. Cite PRISMA-ScR checklist items 5–12." />
    <C.Banner tone="info">Created 18 Sep · last moved to <b>In progress</b> 2 days ago</C.Banner>
  </C.Modal>
</App>);
