// @card group="Cards" height=420
import { C, mount } from "./_mount.js";

mount(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
<C.NoteGroup title="Diffusion models" tone="lilac"><C.NoteCard title="Forward process" subtitle="Week 1 · lecture notes" tags={[{name:'Studies',color:'sky'}]} highlight="What is noise scheduling?" body="The forward process gradually adds Gaussian noise to atom coordinates and types until the molecule is indistinguishable from noise." updated="2h ago" /></C.NoteGroup>
<C.NoteGroup title="Meetings" tone="rose"><C.NoteCard title="Supervisor sync" kind="notebook" tags={[{name:'meeting',color:'rose'}]} body="Narrow scope to 2020–2026. Add an evaluation-metrics table. Next check-in Oct 6." updated="Yesterday" /></C.NoteGroup>
</div>);
