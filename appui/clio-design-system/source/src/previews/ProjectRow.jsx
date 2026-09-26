// @card group="Cards" height=190
import { C, mount } from "./_mount.js";
import { PROJECTS } from './_data.js';
mount(<div className="cl-col" style={{gap:8}}>{PROJECTS.slice(0,3).map(p=><C.ProjectRow key={p.id} {...p} />)}</div>);
