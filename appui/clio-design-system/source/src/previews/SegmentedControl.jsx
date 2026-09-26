// @card group="Actions" height=96
import { C, mount } from "./_mount.js";

mount(<div className="cl-col"><C.SegmentedControl options={[{value:'day',label:'Day'},{value:'week',label:'Week'},{value:'month',label:'Month'}]} value="week" />
<div className="cl-row"><C.SegmentedControl options={[{value:'k',label:'Kanban',icon:'kanban'},{value:'c',label:'Calendar',icon:'calendar'}]} /><C.SegmentedControl iconOnly options={[{value:'g',label:'Grid view',icon:'grid'},{value:'l',label:'List view',icon:'list'}]} /></div></div>);
