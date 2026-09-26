// @card group="Cards" height=200
import { C, mount } from "./_mount.js";

mount(<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}><C.StickyNote title="Key hypothesis" body="Discrete latents trade diversity for speed." when="Sep 24" /><C.StickyNote tone="rose" title="Reminder" body="Ask about GEOM split used in table 3." when="Today" /><C.StickyNote tone="sage" title="Idea" body="Reuse the codebook for scaffold search." when="Sep 20" dragging /><C.StickyNote tone="sky" title="Paper question" body="Why no QM9 baseline for GVT?" /></div>);
