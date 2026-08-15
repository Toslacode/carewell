import type { SVGProps } from "react";

/**
 * One stroke-drawn icon set, 24-grid, 1.5 stroke — matching the light line
 * weight in the reference screens. Icons are decorative here: every one is
 * paired with a visible text label in the UI, so they carry aria-hidden and
 * meaning never rests on the glyph alone.
 */

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconUser = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
  </Svg>
);

export const IconUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" />
    <path d="M16 5.6a3.2 3.2 0 0 1 0 6.3M17.5 14.8c2.1.6 3.5 2.2 3.5 4.7" />
  </Svg>
);

export const IconClipboard = (p: P) => (
  <Svg {...p}>
    <path d="M9 4.5h6M8 6.5h8a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 16 20.5H8A1.5 1.5 0 0 1 6.5 19V8A1.5 1.5 0 0 1 8 6.5Z" />
    <path d="M9.5 3.5h5V6h-5z" />
    <path d="M9.5 11h5M9.5 14.5h3.5" />
  </Svg>
);

export const IconHeart = (p: P) => (
  <Svg {...p}>
    <path d="M12 19.5s-6.8-4.2-6.8-9A3.7 3.7 0 0 1 12 8.4a3.7 3.7 0 0 1 6.8 2.1c0 4.8-6.8 9-6.8 9Z" />
  </Svg>
);

export const IconBed = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 18v-8M3.5 13.5h17V18M20.5 18v-4" />
    <circle cx="8" cy="11" r="1.8" />
    <path d="M11.5 13.5v-2a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3" />
  </Svg>
);

export const IconChat = (p: P) => (
  <Svg {...p}>
    <path d="M20 12.5c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 0 1-2.6-.35L5 20.5l1.2-3.1A6.3 6.3 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5Z" />
  </Svg>
);

export const IconDocument = (p: P) => (
  <Svg {...p}>
    <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z" />
    <path d="M13.5 3.5v5h5M8.5 12.5h7M8.5 16h4.5" />
  </Svg>
);

export const IconVitals = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 12.5h4l2-4.5 3 9 2.2-5.5 1.6 3h4.2" />
  </Svg>
);

export const IconFlask = (p: P) => (
  <Svg {...p}>
    <path d="M10 3.5v5.2L5.4 17a2 2 0 0 0 1.7 3h9.8a2 2 0 0 0 1.7-3L14 8.7V3.5" />
    <path d="M9 3.5h6M7.6 14h8.8" />
  </Svg>
);

export const IconStethoscope = (p: P) => (
  <Svg {...p}>
    <path d="M6 3.5v5a4 4 0 0 0 8 0v-5" />
    <path d="M6 3.5H4.5M14 3.5h1.5M10 12.5v2.5a4 4 0 0 0 8 0v-1" />
    <circle cx="18" cy="13" r="2" />
  </Svg>
);

export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5 13.6 9 18 10.6 13.6 12.2 12 16.7 10.4 12.2 6 10.6 10.4 9Z" />
    <path d="M18 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
  </Svg>
);

export const IconMic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="10.5" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
  </Svg>
);

export const IconPause = (p: P) => (
  <Svg {...p}>
    <rect x="8" y="6" width="3" height="12" rx="1" />
    <rect x="13" y="6" width="3" height="12" rx="1" />
  </Svg>
);

export const IconStop = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5 10 17.5 19 7" />
  </Svg>
);

export const IconPencil = (p: P) => (
  <Svg {...p}>
    <path d="M15.2 5.3 18.7 8.8M4.5 19.5l1-3.7 10-10a1.8 1.8 0 0 1 2.5 0l1.2 1.2a1.8 1.8 0 0 1 0 2.5l-10 10Z" />
  </Svg>
);

export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 6.5h15M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7" />
    <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
    <path d="M10.5 10v6.5M13.5 10v6.5" />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Svg>
);

export const IconArrowBack = (p: P) => (
  // Points right — the "back" direction in an RTL layout.
  <Svg {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Svg>
);

export const IconChevron = (p: P) => (
  // Points left — the "forward / drill in" direction in RTL.
  <Svg {...p}>
    <path d="M14.5 6l-6 6 6 6" />
  </Svg>
);

export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);

export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5 21 19.5H3Z" />
    <path d="M12 10v4.2M12 17.2v.1" />
  </Svg>
);

export const IconDoor = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 20.5V4.8a1.3 1.3 0 0 1 1.1-1.3l7-1a1.3 1.3 0 0 1 1.4 1.3v16.7" />
    <path d="M4.5 20.5h15M13.5 12.2v1.6" />
  </Svg>
);

export const IconWheat = (p: P) => (
  // The footer mark from the reference screens.
  <Svg {...p}>
    <path d="M12 21V8" />
    <path d="M12 8c0-2 1.2-3.6 3-4.5.4 2.2-.6 4-3 4.5ZM12 8c0-2-1.2-3.6-3-4.5-.4 2.2.6 4 3 4.5Z" />
    <path d="M12 13c0-1.8 1.1-3.2 2.7-4 .4 2-.5 3.6-2.7 4ZM12 13c0-1.8-1.1-3.2-2.7-4-.4 2 .5 3.6 2.7 4Z" />
    <path d="M12 17.5c0-1.6 1-2.9 2.4-3.6.3 1.8-.5 3.2-2.4 3.6ZM12 17.5c0-1.6-1-2.9-2.4-3.6-.3 1.8.5 3.2 2.4 3.6Z" />
  </Svg>
);
