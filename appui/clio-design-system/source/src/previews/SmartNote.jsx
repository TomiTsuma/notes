// @card group="AI" height=380
import { C, mount } from "./_mount.js";
import { GVT_SUMMARY } from './_data.js';
mount(<div className="cl-col" style={{background:'var(--ai-wash)',padding:16,borderRadius:18,maxWidth:400,gap:10}}><C.SmartNote title="Summary" status="done"><p>{GVT_SUMMARY}</p></C.SmartNote><C.SmartNote title="Network Architecture" status="loading" /><C.SmartNote title="Datasets" status="idle" /><C.SmartNote title="Hyperparameters" status="error" /></div>);
