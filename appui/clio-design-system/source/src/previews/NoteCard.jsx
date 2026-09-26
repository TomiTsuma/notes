// @card group="Cards" height=250
import { C, mount } from "./_mount.js";

mount(<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
<C.NoteCard title="Reading log" kind="notebook" body="GVT beats EDM on validity at 40× fewer sampling steps." updated="Just now" tags={[{name:'results',color:'sage'}]} />
<C.NoteCard title="GVT annotations" kind="pdf" subtitle="12 highlights · 3 pages" body="Codebook size 512 — check ablation in table 6." updated="1h ago" />
<C.NoteCard title="Open questions" body="Does the VQ bottleneck hurt scaffold diversity on GEOM-Drugs?" updated="Sep 21" tags={[{name:'to-read',color:'amber'}]} />
</div>);
