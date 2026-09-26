// @card group="Cards" height=420
import { C, mount } from "./_mount.js";
import { TODOS } from './_data.js';
mount(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}}><C.DailyCard date="2026-09-25" tasksTitle="Today" tasks={TODOS} showAdd footer="4 tasks · 2 done" /><C.DailyCard date="2026-09-24" icon="edit3" prose={<span><em>Slightly better focus.</em> Finished the screening pass and flagged 12 papers for extraction.</span>} tasksTitle="Tasks for tomorrow" tasks={TODOS.slice(2)} tag="review" /></div>);
