import React from 'react';

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

export const PenIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...iconProps} {...props}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
  </svg>
);

export const HighlighterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...iconProps} {...props}>
    <path d="M19.07 4.93l-4 4 2.83 2.83 4-4-2.83-2.83zM15.07 8.93l-7 7-2.83-2.83 7-7 2.83 2.83zM8.07 15.93l-4.5 4.5h4l2.5-2.5-2-2z"/>
  </svg>
);

export const TextIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...iconProps} {...props}>
    <path d="M4 7V4h16v3M12 4v16"/>
  </svg>
);

export const EraserIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...iconProps} {...props}>
    <path d="M20.5 4.5l-4-4L2 15l4 4 15-15zM2 15h20"/>
  </svg>
);

export const StickyNoteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...iconProps} {...props}>
    <path d="M16 3H4v18h16V7l-4-4zM16 7h-4V3"/>
  </svg>
);
