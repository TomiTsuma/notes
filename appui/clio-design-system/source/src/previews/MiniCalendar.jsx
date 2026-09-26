// @card group="Calendar" height=330
import { C, mount } from "./_mount.js";

mount(<C.Card style={{maxWidth:300}}><C.MiniCalendar marked={[3,9,14,18,23,25,29]} /></C.Card>);
