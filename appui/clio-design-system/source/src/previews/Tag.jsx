// @card group="Status" height=100
import { C, mount } from "./_mount.js";

mount(<div className="cl-col" style={{gap:10}}><div className="cl-row" style={{gap:6}}>{['rose','sky','sage','amber','lilac','stone'].map(t=><C.Tag key={t} tone={t}>#{t}</C.Tag>)}</div>
<div className="cl-row" style={{gap:6}}><C.Tag tone="lilac" onRemove={()=>{}}>#diffusion</C.Tag><C.Tag tone="sky" icon="pencil">3 notes</C.Tag><C.Tag outline>Draft</C.Tag></div></div>);
