// @card group="Status" height=90
import { C, mount } from "./_mount.js";

mount(<div className="cl-row" style={{gap:32,alignItems:'flex-start'}}><div className="w-lilac" style={{width:220,background:'none'}}><C.ProgressDots value={62} total={14} label="Kanban progress" /></div><div className="w-sage" style={{width:220,background:'none'}}><C.ProgressDots value={100} total={14} /></div></div>);
