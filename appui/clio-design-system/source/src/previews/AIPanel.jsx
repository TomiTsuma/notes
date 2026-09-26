// @card group="AI" height=720
import { C, mount } from "./_mount.js";
import { GVT_SUMMARY } from './_data.js';
mount(<div style={{height:700,display:'flex',border:'1px solid var(--line)',borderRadius:16,overflow:'hidden',width:382}}><C.AIPanel file="Graph VQ-Transformer (GVT).pdf">{(t)=> t==='chat' ? <><C.ChatMessage role="user">Summarise the method in two lines.</C.ChatMessage><C.ChatMessage thought="Thought for 4 seconds"><p>{GVT_SUMMARY}</p></C.ChatMessage></> : C.SMART_PROMPTS.slice(0,5).map((p,i)=><C.SmartNote key={p} title={p} status={i===0?'done':i===1?'loading':'idle'}><p>{GVT_SUMMARY}</p></C.SmartNote>)}</C.AIPanel></div>);
