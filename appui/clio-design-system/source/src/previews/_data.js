export const LOGO = '/_blob/48862c486b7814c25c7d20b73dfd3ee6';
export const LOGO_DARK = '/_blob/1e724baa501fc0a4d6955d6f4cf82e5f';
export const PROJECTS = [
  { id: 'p1', name: 'Molecular Generation Review', color: 'lilac', count: 14, context: 'Scoping review · PRISMA-ScR', description: 'Diffusion-based generative models for de novo molecule design — screening, extraction and synthesis.', status: 'inprogress', activity: 'Active today', starred: true, progress: 62, notes: 14 },
  { id: 'p2', name: 'MSc Dissertation', color: 'sky', count: 9, context: 'Data Science', description: 'Proposal, literature map and methods chapter drafts with supervisor feedback.', status: 'review', activity: 'Active 1 day ago', starred: true, progress: 40, notes: 9 },
  { id: 'p3', name: 'Soil Spectra Pipeline', color: 'sage', count: 6, context: 'Agronomy ML', description: 'Outlier detection for MIR spectra and model cards for the fertility report.', status: 'inprogress', activity: 'Active 3 days ago', progress: 75, notes: 6 },
  { id: 'p4', name: 'Geothermal Reading List', color: 'amber', count: 4, context: 'Side research', description: 'Papers on ML for reservoir temperature prediction.', status: 'todo', activity: 'Active 2 weeks ago', progress: 10, notes: 4 },
];
export const TAGS = [
  { name: 'diffusion', color: 'lilac' }, { name: 'methods', color: 'sky' }, { name: 'to-read', color: 'amber' }, { name: 'results', color: 'sage' }, { name: 'meeting', color: 'rose' },
];
export const TREE = [
  { id: 'f1', type: 'folder', name: 'Papers', children: [
    { id: 'n1', type: 'pdf', name: 'Graph VQ-Transformer (GVT).pdf' },
    { id: 'n2', type: 'pdf', name: 'EDM — Equivariant Diffusion.pdf' },
  ] },
  { id: 'f2', type: 'folder', name: 'Lecture notes', open: false, children: [{ id: 'n4', type: 'notebook', name: 'Week 3' }] },
  { id: 'n3', type: 'notebook', name: 'Reading log' },
  { id: 'n5', type: 'markdown', name: 'Supervisor meeting' },
];
export const TASKS = {
  todo: [
    { id: 'CLIO-31', title: 'Extract hyperparameters from 12 papers', description: 'Fill the extraction sheet: steps, noise schedule, sampler.', priority: 'medium', due: 'Oct 2', project: 'Molecular Gen', projectColor: 'lilac' },
    { id: 'CLIO-34', title: 'Book supervisor check-in', priority: 'low', due: 'Oct 6', project: 'MSc Dissertation', projectColor: 'sky' },
  ],
  inprogress: [
    { id: 'CLIO-28', title: 'Write methods section draft', description: 'Search strategy, eligibility criteria, charting form.', priority: 'high', due: 'Today', dueState: 'soon', project: 'Molecular Gen', projectColor: 'lilac' },
    { id: 'CLIO-22', title: 'Tune isolation forest threshold', priority: 'medium', due: 'Sep 29', project: 'Soil Spectra', projectColor: 'sage' },
  ],
  review: [
    { id: 'CLIO-19', title: 'Proposal chapter 2 — literature map', description: 'Waiting on comments from Dr. Otieno.', priority: 'high', due: 'Sep 23', dueState: 'late', project: 'MSc Dissertation', projectColor: 'sky' },
  ],
  done: [
    { id: 'CLIO-12', title: 'PRISMA flow diagram v1', priority: 'medium', due: 'Sep 18', project: 'Molecular Gen', projectColor: 'lilac' },
    { id: 'CLIO-15', title: 'Import 40 arXiv papers to Library', priority: 'low', due: 'Sep 15', project: 'Molecular Gen', projectColor: 'lilac' },
  ],
};
export const TODOS = [
  { id: 't1', text: 'Read GVT section 4 (sampling)', completed: true, dueTime: '09:00' },
  { id: 't2', text: 'Annotate EDM results table', completed: true },
  { id: 't3', text: 'Send extraction sheet to Mirriam', completed: false, dueTime: '14:30', soon: true },
  { id: 't4', text: 'Draft discussion outline', completed: false, dueTime: '17:00' },
];
export const GVT_SUMMARY = 'GVT compresses molecular graphs into discrete codes with a graph VQ-VAE, then models the code sequence with a Transformer — generating valid molecules far faster than diffusion baselines.';
