// @card group="Canvas" height=400
import { C, mount } from "./_mount.js";

mount(<div style={{background:'var(--surface-inset)',padding:20,borderRadius:16}}><div className="cl-tagbar" style={{borderRadius:10,marginBottom:16,border:'1px solid var(--line)'}}><C.Icon name="tag" size={15} className="cl-faint" /><C.Tag tone="lilac" onRemove={()=>{}}>#diffusion</C.Tag><button className="add"><C.Icon name="plus" size={12} />Add tag</button></div>
<C.NotebookPage width={520} height={300} page="3 / 7"><span className="cl-page-text" style={{left:84,top:31}}>Noise schedule — cosine vs linear?</span>
<svg width="520" height="300"><path d="M84 110 C 150 96, 220 124, 300 104 S 420 100, 460 112" fill="none" stroke="var(--pen-cobalt)" strokeWidth="2.4" strokeLinecap="round" /><path d="M84 150 h210" stroke="var(--marker-yellow)" strokeWidth="18" strokeLinecap="round" /><path d="M310 190 l40 40 M350 190 l-40 40" stroke="var(--pen-red)" strokeWidth="2.2" strokeLinecap="round" /></svg>
<span className="cl-page-text" style={{left:84,top:127}}>GVT: codebook 512, 64 tokens</span>
<div className="cl-page-sticky w-amber" style={{left:360,top:180}}>Check ablation in table 6</div></C.NotebookPage></div>);
