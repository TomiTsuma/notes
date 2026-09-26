// @card group="Cards" height=220
import { C, mount } from "./_mount.js";
import { TASKS } from './_data.js';
mount(<div style={{display:'grid',gridTemplateColumns:'repeat(3,260px)',gap:16,alignItems:'start'}}><C.TaskCard {...TASKS.inprogress[0]} /><C.TaskCard {...TASKS.review[0]} /><C.TaskCard {...TASKS.todo[1]} dragging /></div>);
