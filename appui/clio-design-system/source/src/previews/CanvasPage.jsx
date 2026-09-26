// @card group="Pages" height=860 width=1440 page
import { C, mount } from "./_mount.js";
import { App } from "./_shell.jsx";
import { GVT_SUMMARY } from "./_data.js";
const panel = (
  <C.AIPanel file="Graph VQ-Transformer (GVT).pdf" tab="chat">
    {(t) => t === 'chat' ? <>
      <C.ChatMessage role="user">What makes GVT faster than diffusion baselines?</C.ChatMessage>
      <C.ChatMessage thought="Thought for 6 seconds"><h3>Two reasons</h3><ul><li>{GVT_SUMMARY}</li><li>Sampling is one autoregressive pass over ~64 codes instead of hundreds of denoising steps.</li></ul></C.ChatMessage>
      <C.ChatMessage role="user">Where do they report the speed-up?</C.ChatMessage>
      <C.ChatMessage streaming>Section 5.2 and table 4 report 40× fewer network evaluations</C.ChatMessage>
    </> : C.SMART_PROMPTS.map((p, i) => <C.SmartNote key={p} title={p} status={i === 0 ? 'done' : i === 1 ? 'loading' : 'idle'}><p>{GVT_SUMMARY}</p></C.SmartNote>)}
  </C.AIPanel>
);
mount(<App view="canvas" crumbs={['Papers', 'Graph VQ-Transformer (GVT).pdf']} panel={panel} activeFileId="n1" showDownload>
  <C.CanvasTagBar tags={[{ name: 'diffusion', color: 'lilac' }, { name: 'methods', color: 'sky' }]} />
  <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
    <div className="cl-canvas">
      <C.NotebookPage width={620} height={800} ruled={false} page="4 / 18">
        <div style={{ position: 'absolute', inset: '48px 56px', fontFamily: 'var(--font-serif)', fontSize: 13.5, lineHeight: '21px', color: 'var(--ink)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>4. Sampling with discrete codes</div>
          <p style={{ margin: '0 0 10px' }}>Given a trained codebook, generation reduces to predicting a sequence of <span style={{ background: 'var(--marker-yellow)' }}>64 discrete tokens with a causal Transformer</span>, followed by a single decoder pass that reconstructs atom types and bonds.</p>
          <p style={{ margin: '0 0 10px' }}>Unlike score-based diffusion, no iterative denoising is required, and validity is enforced by the decoder’s valence-aware head.</p>
          <p style={{ margin: 0, color: 'var(--ink-2)' }}>Table 4 compares wall-clock sampling time on GEOM-Drugs across batch sizes…</p>
        </div>
        <svg width="620" height="800"><path d="M300 150 C 340 142, 420 160, 470 150" fill="none" stroke="var(--pen-red)" strokeWidth="2.2" strokeLinecap="round" /><path d="M500 120 q 30 -10 40 20 q 6 20 -20 26" fill="none" stroke="var(--pen-cobalt)" strokeWidth="2" strokeLinecap="round" /></svg>
        <div className="cl-page-sticky w-amber" style={{ left: 380, top: 320 }}>Compare with EDM’s 1000 steps — cite in methods.</div>
      </C.NotebookPage>
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 20, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 12, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto' }}><C.ToolDock active="pen" color="pen-red" /></div>
    </div>
  </div>
</App>);
