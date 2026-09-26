// @card group="Inputs" height=110
import { C, mount } from "./_mount.js";

mount(<div className="cl-col"><div><div className="cl-field-label" style={{marginBottom:8}}>Project colour</div><C.ColorPicker value="lilac" /></div><div><div className="cl-field-label" style={{marginBottom:8}}>Ink</div><C.ColorPicker colors={C.PEN_COLORS} value="pen-cobalt" allowCustom /></div></div>);
