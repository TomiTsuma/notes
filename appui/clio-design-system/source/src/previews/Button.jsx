// @card group="Actions" height=96
import { C, mount } from "./_mount.js";

mount(<div className="cl-col" style={{gap:14}}>
 <div className="cl-row"><C.Button variant="primary" icon="plus">New task</C.Button><C.Button icon="upload">Upload</C.Button><C.Button variant="ghost">Cancel</C.Button><C.Button variant="ai" icon="spark">Ask Clio</C.Button><C.Button variant="danger" icon="trash">Delete</C.Button></div>
 <div className="cl-row"><C.Button variant="primary" size="sm" icon="plus">Create</C.Button><C.Button size="sm" iconRight="chevron-down">Daily tasks</C.Button><C.Button size="sm" variant="ghost" icon="filter">Filters</C.Button><C.Button variant="primary" disabled>Saving…</C.Button></div>
</div>);
