// @card group="Inputs" height=120
import { C, mount } from "./_mount.js";

mount(<div className="cl-col" style={{gap:8}}><C.Checkbox defaultChecked>Resolve the technical issues with IT.</C.Checkbox><C.Checkbox>Prepare for the presentation on Friday.</C.Checkbox><div className="cl-row" style={{gap:10}}><C.Switch on label="Palm rejection" /><span>Palm rejection</span></div></div>);
