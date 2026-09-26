// @card group="Navigation" height=720
import { C, mount } from "./_mount.js";
import { LOGO, LOGO_DARK, PROJECTS, TREE, TAGS } from './_data.js';
mount(<div style={{height:700,display:'flex',border:'1px solid var(--line)',borderRadius:16,overflow:'hidden',width:258}}><C.Sidebar logoLight={LOGO} logoDark={LOGO_DARK} activeView="canvas" projects={PROJECTS.slice(0,3)} tree={TREE} tags={TAGS} activeFileId="n1" counts={{kanban:7}} /></div>);
