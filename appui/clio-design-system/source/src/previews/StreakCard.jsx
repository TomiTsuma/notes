// @card group="Data" height=330
import { C, mount } from "./_mount.js";

mount(<div style={{maxWidth:360}}><C.StreakCard days={12} week={[1,1,1,1,1,0,0]} todayIndex={4} tasksDone={48} notesLogged={126} /></div>);
