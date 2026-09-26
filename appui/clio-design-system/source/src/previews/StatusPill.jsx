// @card group="Status" height=64
import { C, mount } from "./_mount.js";

mount(<div className="cl-row"><C.StatusPill status="todo" count={2} /><C.StatusPill status="inprogress" count={4} /><C.StatusPill status="review" count={1} /><C.StatusPill status="done" count={12} /></div>);
