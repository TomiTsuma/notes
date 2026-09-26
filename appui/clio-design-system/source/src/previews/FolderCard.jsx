// @card group="Cards" height=180
import { C, mount } from "./_mount.js";

mount(<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,paddingTop:10}}><C.FolderCard name="Papers" count="42 papers" tone="sky" /><C.FolderCard name="Diffusion" count="18 papers · 4 notes" tone="lilac" /><C.FolderCard name="Soil spectra" count="6 notepads" tone="sage" /><C.FolderCard name="Inbox" count="Empty" tone="stone" peek={0} /></div>);
