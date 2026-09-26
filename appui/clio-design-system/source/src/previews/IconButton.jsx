// @card group="Actions" height=56
import { C, mount } from "./_mount.js";

mount(<div className="cl-row"><C.IconButton icon="panel-left" label="Toggle sidebar" /><C.IconButton icon="mic" label="Record" /><C.IconButton icon="download" label="Download" /><C.IconButton icon="moon" label="Dark mode" /><C.IconButton icon="grid" label="Grid" active /><C.IconButton icon="more" label="More" /><C.IconButton icon="settings" label="Settings" outlined size="lg" dot /></div>);
