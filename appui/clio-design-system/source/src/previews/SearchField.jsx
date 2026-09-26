// @card group="Inputs" height=64
import { C, mount } from "./_mount.js";

mount(<div className="cl-row" style={{flexWrap:'nowrap'}}><C.SearchField placeholder="Search notes, papers…" shortcut="⌘K" style={{width:300}} /><C.SearchField placeholder="Search folders & papers…" style={{width:260}} /></div>);
