// @card group="Calendar" height=110
import { C, mount } from "./_mount.js";

mount(<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}><C.EventBlock title="Lab meeting" time="11:30–12:15" tone="rose" /><C.EventBlock title="Write methods" time="14:00–16:00" tone="lilac" /><C.EventBlock title="Read GVT §4" time="09:00–10:00" tone="sky" done /><div className="cl-col" style={{gap:4}}><C.EventBlock compact title="Supervisor sync" tone="amber" /><C.EventBlock compact title="+2 more" tone="stone" /></div></div>);
