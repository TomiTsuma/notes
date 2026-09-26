// @card group="Overlays" height=560
import { C, mount } from "./_mount.js";

mount(<div style={{position:'relative',height:540,borderRadius:16,overflow:'hidden',background:'var(--surface)'}}><C.Modal title="Create project" description="Projects group notebooks, papers and Kanban tasks." footer={<><C.Button variant="ghost">Cancel</C.Button><C.Button variant="primary">Create project</C.Button></>}>
<C.TextField label="Project name" placeholder="e.g. Molecular Research" /><C.TextField label="Description" multiline placeholder="Optional description detailing aims…" /><div className="cl-field"><span className="cl-field-label">Colour</span><C.ColorPicker value="lilac" /></div></C.Modal></div>);
