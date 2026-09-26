// @card group="AI" height=470
import { C, mount } from "./_mount.js";
import { GVT_SUMMARY } from './_data.js';
mount(<div style={{background:'var(--ai-wash)',padding:20,borderRadius:18,maxWidth:400}} className="cl-col"><C.ChatMessage role="user">What makes GVT faster than diffusion baselines?</C.ChatMessage>
<C.ChatMessage thought="Thought for 6 seconds"><h3>Two reasons</h3><ul><li>{GVT_SUMMARY}</li><li>Sampling is a single autoregressive pass over ~<code>64</code> codes instead of hundreds of denoising steps.</li></ul></C.ChatMessage>
<C.ChatMessage streaming>Section 5.2 reports 40× fewer network evaluations</C.ChatMessage></div>);
