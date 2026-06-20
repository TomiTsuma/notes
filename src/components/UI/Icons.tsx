import React from 'react';

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Fountain-pen nib — drawing tool */
export const PenIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M17.5 4.5 L20.5 7.5 L9.5 18.5 L6 21 L8.5 17.5 Z" />
    <path d="M15 7 L18 10" strokeWidth={1.2} opacity={0.55} />
    <path d="M6 21 L4.5 22.5" />
  </svg>
);

/** Chisel-tip marker — highlighter */
export const HighlighterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M18 3.5 L21 6.5 L10.5 17 H8 V14.5 Z" />
    <path d="M8 14.5 L6.5 16 L8 17.5 H10.5" />
    <path d="M15.5 6 L18.5 9" strokeWidth={1.1} opacity={0.5} />
    <line x1="3" y1="22" x2="22" y2="22" />
  </svg>
);

/** T inside corner-handle selection frame — text tool */
export const TextIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    {/* Corner bracket — top-left */}
    <path d="M3 8 V5 C3 3.9 3.9 3 5 3 H8" />
    {/* Corner bracket — top-right */}
    <path d="M16 3 H19 C20.1 3 21 3.9 21 5 V8" />
    {/* Corner bracket — bottom-right */}
    <path d="M21 16 V19 C21 20.1 20.1 21 19 21 H16" />
    {/* Corner bracket — bottom-left */}
    <path d="M8 21 H5 C3.9 21 3 20.1 3 19 V16" />
    {/* T letterform */}
    <line x1="8" y1="9.5" x2="16" y2="9.5" strokeWidth={1.8} />
    <line x1="12" y1="9.5" x2="12" y2="17" strokeWidth={1.8} />
  </svg>
);

/** Flat block eraser with face-divide line */
export const EraserIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    {/* Eraser body */}
    <path d="M4 17 L11.5 9.5 L21 19 L13.5 22 H4 Z" />
    {/* Face-divide line (used vs fresh) */}
    <line x1="11.5" y1="9.5" x2="4" y2="17" strokeWidth={1.2} opacity={0.5} />
    {/* Baseline */}
    <line x1="3" y1="22" x2="22" y2="22" />
  </svg>
);

/** Sticky note with corner fold */
export const StickyNoteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M5 4 C5 3.4 5.4 3 6 3 H16 L21 8 V20 C21 20.6 20.6 21 20 21 H6 C5.4 21 5 20.6 5 20 V4 Z" />
    <path d="M16 3 V8 H21" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </svg>
);

/* ─── UI / Navigation icons ─────────────────────────────────────────── */

export const HomeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M3 10.5 L12 3 L21 10.5 V20 C21 20.6 20.6 21 20 21 H16 V15 H8 V21 H4 C3.4 21 3 20.6 3 20 Z" />
  </svg>
);

export const ProjectsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M3 6 C3 4.9 3.9 4 5 4 H10 L12 6 H19 C20.1 6 21 6.9 21 8 V19 C21 20.1 20.1 21 19 21 H5 C3.9 21 3 20.1 3 19 Z" />
  </svg>
);

export const KanbanIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <line x1="9" y1="8" x2="3" y2="8" />
    <line x1="15" y1="13" x2="9" y2="13" />
    <line x1="21" y1="8" x2="15" y2="8" />
  </svg>
);

export const CalendarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <rect x="7" y="14" width="3" height="3" rx="0.5" />
    <rect x="14" y="14" width="3" height="3" rx="0.5" />
  </svg>
);

export const CanvasIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M17 3.5 L20.5 7 L9 18.5 L5.5 20.5 L7.5 17 Z" />
    <path d="M14.5 6 L18 9.5" strokeWidth={1.2} opacity={0.5} />
  </svg>
);

export const CloudIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M18 10 C18 10 18.5 9 18.5 8 C18.5 5.8 16.7 4 14.5 4 C13 4 11.7 4.8 11 6 C10.5 5.4 9.8 5 9 5 C7.3 5 6 6.3 6 8 C6 8.2 6 8.5 6.1 8.7 C4.3 9.2 3 10.9 3 13 C3 15.8 5.2 18 8 18 H19 C21.2 18 23 16.2 23 14 C23 12 21.7 10.3 19.8 10.1" strokeWidth={1.5} />
  </svg>
);

export const TagIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M12.5 3 L21 11.5 C21.6 12.1 21.6 13 21 13.6 L13.6 21 C13 21.6 12.1 21.6 11.5 21 L3 12.5 V4 C3 3.4 3.4 3 4 3 Z" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const FolderIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M3 6 C3 4.9 3.9 4 5 4 H10 L12 6 H19 C20.1 6 21 6.9 21 8 V18 C21 19.1 20.1 20 19 20 H5 C3.9 20 3 19.1 3 18 Z" />
  </svg>
);

export const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M21 15 V19 C21 20.1 20.1 21 19 21 H5 C3.9 21 3 20.1 3 19 V15" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export const RefreshIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M4 4 V10 H10" />
    <path d="M4 10 C5.5 6 9.5 3 14 3 C18.4 3 22 6.6 22 11 C22 15.4 18.4 19 14 19 C10.5 19 7.5 17 6 14" />
  </svg>
);

export const StreakIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M13 2 C13 2 14 7 11 10 C10 11 9 11.5 8 11.5 C8 11.5 9 9 7 8 C7 8 7 13 4 15.5 C3 16.5 3 18 3 18 C3 21 6 22 9 22 C14 22 17 19 17 15.5 C17 12.5 15 11 14 10 C13 9 13 6 13 6" strokeWidth={1.6} />
    <path d="M10 22 C10 22 10.5 19.5 12 18 C13 17 14 17 14 17" strokeWidth={1.3} opacity={0.6} />
  </svg>
);

export const AgendaIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="7" y1="15" x2="17" y2="15" />
    <line x1="7" y1="19" x2="14" y2="19" />
  </svg>
);

export const TaskSummaryIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M9 11 L11 13 L15 9" />
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <line x1="9" y1="7" x2="15" y2="7" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);

export const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12 L11 14.5 L15.5 9.5" />
  </svg>
);

export const PlusCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

export const FileIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M14 2 H6 C4.9 2 4 2.9 4 4 V20 C4 21.1 4.9 22 6 22 H18 C19.1 22 20 21.1 20 20 V8 Z" />
    <path d="M14 2 V8 H20" />
  </svg>
);

export const NotebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M4 19.5 C4 18.1 5.1 17 6.5 17 H20" />
    <path d="M6.5 2 H20 V22 H6.5 C5.1 22 4 20.9 4 19.5 V4.5 C4 3.1 5.1 2 6.5 2 Z" />
    <line x1="9" y1="7" x2="16" y2="7" />
    <line x1="9" y1="11" x2="16" y2="11" />
  </svg>
);

export const WallpaperIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15 L16 10 L11 15 L8 12 L3 17" />
  </svg>
);

export const DailyFocusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7 V12 L15 15" />
    <path d="M8.5 4.5 C9.5 3.8 10.7 3.4 12 3.4" strokeWidth={1.3} strokeDasharray="1.5 1.5" />
  </svg>
);

export const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const ChevronRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

export const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
