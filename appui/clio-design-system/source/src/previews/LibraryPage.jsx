// @card group="Pages" height=860 width=1440 page
import { C, mount } from "./_mount.js";
import { App } from "./_shell.jsx";
mount(<App view="nextcloud" crumbs={['Library', 'Papers', 'Diffusion']}>
  <div className="cl-view">
    <C.ViewHeader overline="Nextcloud · /Clio/Papers/Diffusion" title="Diffusion" subtitle="18 papers · 4 notepads · 3 stickies · 2 folders"
      actions={<><C.SearchField placeholder="Search folders & papers…" style={{ width: 240 }} /><C.Button icon="sync">Refresh</C.Button></>} />
    <C.QuickActions items={[{ icon: 'arxiv', label: 'Import arXiv paper', tone: 'rose' }, { icon: 'upload', label: 'Upload PDF', tone: 'sky' }, { icon: 'markdown', label: 'New notepad', tone: 'lilac' }, { icon: 'sticky', label: 'New sticky', tone: 'amber' }, { icon: 'folder-plus', label: 'New subfolder', tone: 'stone' }]} />
    <div className="cl-section" style={{ marginTop: 28 }}>
      <C.SectionHeader title="Folders" count={2} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, paddingTop: 8 }}><C.FolderCard name="Supplementary" count="6 files" tone="sky" /><C.FolderCard name="Code artifacts" count="3 files" tone="stone" /></div>
    </div>
    <div className="cl-section">
      <C.SectionHeader title="Papers" count={18} actions={<C.SegmentedControl iconOnly options={[{ value: 'l', label: 'List', icon: 'list' }, { value: 'g', label: 'Grid', icon: 'grid' }]} />} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <C.PaperCard title="Graph VQ-Transformer (GVT): Fast and Accurate Molecular Generation" authors="Chen, Okafor, Liu et al." arxiv="2512.02667" pages={18} annotated={12} tags={[{ name: 'diffusion', color: 'lilac' }]} />
        <C.PaperCard title="Equivariant Diffusion for Molecule Generation in 3D" authors="Hoogeboom, Satorras, Vignac, Welling" arxiv="2203.17003" pages={21} status="local" />
        <C.PaperCard title="DiGress: Discrete Denoising Diffusion for Graph Generation" authors="Vignac, Krawczuk, Siraudin et al." arxiv="2209.14734" pages={24} tags={[{ name: 'to-read', color: 'amber' }]} />
        <C.PaperCard title="GeoDiff: A Geometric Diffusion Model for Molecular Conformation" authors="Xu, Yu, Song et al." arxiv="2203.02923" pages={19} annotated={3} />
      </div>
    </div>
    <div className="cl-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div><C.SectionHeader title="Notepads" count={4} />
        <div className="cl-col"><C.NoteCard title="Experiment notes" body="Compare validity/uniqueness across GVT, EDM, DiGress at 1k samples." updated="Today" /></div></div>
      <div><C.SectionHeader title="Sticky board" count={3} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><C.StickyNote title="Key hypothesis" body="Discrete latents trade diversity for speed." when="Sep 24" /><C.StickyNote tone="rose" title="Paper question" body="Why no QM9 baseline for GVT?" when="Today" /></div></div>
    </div>
  </div>
</App>);
