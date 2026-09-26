// @card group="Overlays" height=330
import { C, mount } from "./_mount.js";

mount(<div className="cl-row" style={{alignItems:'flex-start',gap:32}}><C.Menu items={[{icon:'folder',label:'Open'},{icon:'pencil',label:'Rename',shortcut:'F2'},{icon:'tag',label:'Manage tags'},{icon:'hub',label:'Move to project…'},{icon:'download',label:'Download'},'-',{icon:'trash',label:'Delete',danger:true}]} /><div style={{paddingTop:30}}><C.Tooltip shortcut="⌘J">Share feedback</C.Tooltip></div></div>);
