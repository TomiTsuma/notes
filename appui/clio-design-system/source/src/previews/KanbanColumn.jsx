// @card group="Cards" height=440
import { C, mount } from "./_mount.js";
import { TASKS } from './_data.js';
mount(<div style={{display:'grid',gridTemplateColumns:'repeat(2,280px)',gap:16,alignItems:'start'}}><C.KanbanColumn status="inprogress" count={2}>{TASKS.inprogress.map(t=><C.TaskCard key={t.id} {...t} />)}</C.KanbanColumn><C.KanbanColumn status="review" count={1} over>{TASKS.review.map(t=><C.TaskCard key={t.id} {...t} />)}</C.KanbanColumn></div>);
