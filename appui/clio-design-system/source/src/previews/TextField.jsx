// @card group="Inputs" height=250
import { C, mount } from "./_mount.js";

mount(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,maxWidth:640}}>
<C.TextField label="Project name" placeholder="e.g. Molecular Research" />
<C.TextField label="arXiv id or URL" defaultValue="2512.02667" mono hint="IDs, arxiv: links and abs/ URLs all work." />
<C.TextField label="Description" multiline placeholder="Optional description detailing aims…" />
<C.TextField label="Server URL" defaultValue="cloud.example" error="Enter a full URL starting with https://" />
</div>);
