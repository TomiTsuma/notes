// @card group="Navigation" height=130
import { C, mount } from "./_mount.js";

mount(<div className="cl-col" style={{gap:12}}><div style={{border:'1px solid var(--line)',borderRadius:12,overflow:'hidden'}}><C.TopBar crumbs={['Library','Papers','Graph VQ-Transformer (GVT).pdf']} showDownload /></div>
<div style={{border:'1px solid var(--line)',borderRadius:12,overflow:'hidden'}}><C.TopBar crumbs={['Home','Dashboard']} recording panelOpen sidebarOpen={false} /></div></div>);
