// @card group="Status" height=56
import { C, mount } from "./_mount.js";

mount(<div className="cl-row"><C.PriorityFlag priority="high" /><C.PriorityFlag priority="medium" /><C.PriorityFlag priority="low" /><span style={{width:16}} /><C.DeltaChip value={12} /><C.DeltaChip value={-4} /><C.Kbd>⌘K</C.Kbd></div>);
