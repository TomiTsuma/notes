// @card group="Cards" height=240
import { C, mount } from "./_mount.js";
import { PROJECTS } from './_data.js';
mount(<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>{PROJECTS.slice(0,2).map(p=><C.ProjectCard key={p.id} {...p} />)}<C.AddTile label="New project" /></div>);
