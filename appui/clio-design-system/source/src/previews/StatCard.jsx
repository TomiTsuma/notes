// @card group="Data" height=290
import { C, mount } from "./_mount.js";

mount(<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
<C.StatCard icon="check-circle" title="Tasks done" value="48" delta={12} chart={{data:[3,5,2,6,4,7,5],labels:['M','T','W','T','F','S','S'],active:4,average:4.6}} />
<C.StatCard icon="notebook" title="Notes logged" value="126" delta={-4} chart={{data:[8,4,6,3,9,5,7,6,4,10,8,6,7,9],active:9}} />
<C.StatCard icon="kanban" title="Kanban progress" value="62" unit="%" delta={8} deltaLabel="this week" />
</div>);
