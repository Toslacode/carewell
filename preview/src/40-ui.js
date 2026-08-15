/* ===========================================================================
   Rendering helpers, icon set and shared fragments.

   The preview renders with template strings and a delegated click handler
   rather than a framework — one file, no build step, no network. The markup and
   class names mirror the React components one-for-one so a change in either
   place is easy to carry across.
   =========================================================================== */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const cx = (...parts) => parts.filter(Boolean).join(" ");

/* ------------------------------------------------------------------- icons */
/* 24-grid, 1.5 stroke, decorative: every icon is paired with a visible label. */

/** `attrs` is raw markup, not a class name — every call site passes a sizing
 *  style (and occasionally a class), and an SVG left unsized expands to fill
 *  whatever box it lands in. */
const svg = (body, attrs) =>
  `<svg ${attrs || ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const I = {
  user: (c) => svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/>', c),
  users: (c) =>
    svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5"/><path d="M16 5.6a3.2 3.2 0 0 1 0 6.3M17.5 14.8c2.1.6 3.5 2.2 3.5 4.7"/>', c),
  clipboard: (c) =>
    svg('<path d="M9 4.5h6M8 6.5h8a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 16 20.5H8A1.5 1.5 0 0 1 6.5 19V8A1.5 1.5 0 0 1 8 6.5Z"/><path d="M9.5 3.5h5V6h-5z"/><path d="M9.5 11h5M9.5 14.5h3.5"/>', c),
  heart: (c) => svg('<path d="M12 19.5s-6.8-4.2-6.8-9A3.7 3.7 0 0 1 12 8.4a3.7 3.7 0 0 1 6.8 2.1c0 4.8-6.8 9-6.8 9Z"/>', c),
  bed: (c) =>
    svg('<path d="M3.5 18v-8M3.5 13.5h17V18M20.5 18v-4"/><circle cx="8" cy="11" r="1.8"/><path d="M11.5 13.5v-2a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3"/>', c),
  chat: (c) => svg('<path d="M20 12.5c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 0 1-2.6-.35L5 20.5l1.2-3.1A6.3 6.3 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5Z"/>', c),
  document: (c) =>
    svg('<path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z"/><path d="M13.5 3.5v5h5M8.5 12.5h7M8.5 16h4.5"/>', c),
  vitals: (c) => svg('<path d="M3.5 12.5h4l2-4.5 3 9 2.2-5.5 1.6 3h4.2"/>', c),
  flask: (c) => svg('<path d="M10 3.5v5.2L5.4 17a2 2 0 0 0 1.7 3h9.8a2 2 0 0 0 1.7-3L14 8.7V3.5"/><path d="M9 3.5h6M7.6 14h8.8"/>', c),
  stethoscope: (c) =>
    svg('<path d="M6 3.5v5a4 4 0 0 0 8 0v-5"/><path d="M6 3.5H4.5M14 3.5h1.5M10 12.5v2.5a4 4 0 0 0 8 0v-1"/><circle cx="18" cy="13" r="2"/>', c),
  sparkle: (c) =>
    svg('<path d="M12 4.5 13.6 9 18 10.6 13.6 12.2 12 16.7 10.4 12.2 6 10.6 10.4 9Z"/><path d="M18 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/>', c),
  mic: (c) => svg('<rect x="9" y="3" width="6" height="10.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/>', c),
  pause: (c) => svg('<rect x="8" y="6" width="3" height="12" rx="1"/><rect x="13" y="6" width="3" height="12" rx="1"/>', c),
  stop: (c) => svg('<rect x="7" y="7" width="10" height="10" rx="2"/>', c),
  check: (c) => svg('<path d="M5 12.5 10 17.5 19 7"/>', c),
  pencil: (c) => svg('<path d="M15.2 5.3 18.7 8.8M4.5 19.5l1-3.7 10-10a1.8 1.8 0 0 1 2.5 0l1.2 1.2a1.8 1.8 0 0 1 0 2.5l-10 10Z"/>', c),
  trash: (c) =>
    svg('<path d="M4.5 6.5h15M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7"/><path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5"/><path d="M10.5 10v6.5M13.5 10v6.5"/>', c),
  plus: (c) => svg('<path d="M12 5.5v13M5.5 12h13"/>', c),
  back: (c) => svg('<path d="M4.5 12h15M13.5 6l6 6-6 6"/>', c),
  chevron: (c) => svg('<path d="M14.5 6l-6 6 6 6"/>', c),
  chevronDown: (c) => svg('<path d="M6 9.5l6 6 6-6"/>', c),
  alert: (c) => svg('<path d="M12 4.5 21 19.5H3Z"/><path d="M12 10v4.2M12 17.2v.1"/>', c),
  door: (c) =>
    svg('<path d="M6.5 20.5V4.8a1.3 1.3 0 0 1 1.1-1.3l7-1a1.3 1.3 0 0 1 1.4 1.3v16.7"/><path d="M4.5 20.5h15M13.5 12.2v1.6"/>', c),
  gear: (c) =>
    svg('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-1H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H10a1.6 1.6 0 0 0 1-1.47V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V10a1.6 1.6 0 0 0 1.47 1H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.47 1Z"/>', c),
  moon: (c) => svg('<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z"/>', c),
  sun: (c) =>
    svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>', c),
  logout: (c) => svg('<path d="M14.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h7a1.5 1.5 0 0 0 1.5-1.5v-2.5"/><path d="M9.5 12h10M16.5 8.5 20 12l-3.5 3.5"/>', c),
  motion: (c) => svg('<path d="M4 12h4l2-5 3 10 2-5h5"/>', c),
  assistant: (c) =>
    svg('<path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H12l-4.5 3.5V15.5H6.5a2 2 0 0 1-2-2Z"/><path d="M9 9.5h6M9 12.5h3.5"/>', c),
  close: (c) => svg('<path d="M6 6l12 12M18 6L6 18"/>', c),
  send: (c) => svg('<path d="M20 4 3.5 11l6.5 2.2L12.2 20Z"/><path d="M10 13.2 20 4"/>', c),
  chevronUp: (c) => svg('<path d="M6 14.5l6-6 6 6"/>', c),
  clarioMark: (c) =>
    svg('<path d="M12 7.7c-1.3-1-3-1.6-4.8-1.6-.5 0-.85.35-.85.8v6.25c0 .45.4.8.85.8 1.8 0 3.5.5 4.8 1.55"/><path d="M12 7.7c1.3-1 3-1.6 4.8-1.6.5 0 .85.35.85.8v6.25c0 .45-.4.8-.85.8-1.8 0-3.5.5-4.8 1.55"/><path d="M12 7.7v7.8" stroke-width="1.1"/><path d="m15.7 5.3 1.8 1.8-4.05 4.05-2.2.4.4-2.2z" fill="var(--accent)" stroke="var(--accent)" stroke-width="1"/><path d="M10.25 16.8c-.8-.75-1.7-1.3-2.8-1.55-.7-.15-1.25.2-1.35.8-.1.55.2 1 .75 1.25 1.25.55 2.25 1.25 3.05 2.15" stroke-width="1.3"/><path d="M13.75 16.8c.8-.75 1.7-1.3 2.8-1.55.7-.15 1.25.2 1.35.8.1.55-.2 1-.75 1.25-1.25.55-2.25 1.25-3.05 2.15" stroke-width="1.3"/>', c),
  wheat: (c) =>
    svg('<path d="M12 21V8"/><path d="M12 8c0-2 1.2-3.6 3-4.5.4 2.2-.6 4-3 4.5ZM12 8c0-2-1.2-3.6-3-4.5-.4 2.2.6 4 3 4.5Z"/><path d="M12 13c0-1.8 1.1-3.2 2.7-4 .4 2-.5 3.6-2.7 4ZM12 13c0-1.8-1.1-3.2-2.7-4-.4 2 .5 3.6 2.7 4Z"/><path d="M12 17.5c0-1.6 1-2.9 2.4-3.6.3 1.8-.5 3.2-2.4 3.6ZM12 17.5c0-1.6-1-2.9-2.4-3.6-.3 1.8.5 3.2 2.4 3.6Z"/>', c),
};

const iconStyle = (px) => `style="width:${px}px;height:${px}px;flex-shrink:0"`;

/* -------------------------------------------------------------- fragments */

/** Status is never communicated by color alone: every pill carries a glyph and
 *  the written label, so it survives colorblindness and corridor glare. */
function pill(d, size) {
  return `<span class="pill ${size === "sm" ? "sm " : ""}tone-${d.tone}"><i aria-hidden="true">${d.glyph}</i>${esc(d.label)}</span>`;
}

function countBadge(text, tone) {
  return `<span class="pill sm tone-${tone || "neutral"}">${esc(text)}</span>`;
}

function panelHead(icon, title, trailing) {
  return `<div class="panel-head"><h2><span class="i">${icon}</span>${esc(title)}</h2>${trailing || ""}</div>`;
}

function emptyState(icon, title, hint) {
  return `<div class="empty-state"><span class="icon">${icon}</span><p class="title">${esc(title)}</p>${
    hint ? `<p class="hint">${esc(hint)}</p>` : ""
  }</div>`;
}

function lockup() {
  return `<span class="lockup"><span class="mark">${I.clarioMark('style="width:22px;height:22px"')}</span><span class="word">CLARI<b>O</b></span></span>`;
}

function header(opts) {
  const mid = opts.back
    ? `<button class="back-link" data-go="${esc(opts.back.to)}">${I.back(iconStyle(18))}${esc(opts.back.label)}</button>`
    : opts.rule
      ? `<span class="rule"><i></i>${esc(opts.rule)}<i></i></span>`
      : "";
  return `<header class="app-header"><div class="bar ward">
    <button class="lockup-btn" data-go="rooms" style="border:0;background:none;padding:0;cursor:pointer" title="חזרה לבחירת חדר">${lockup()}<span class="sr-only">חזרה לבחירת חדר</span></button>
    <div class="mid"><p class="ward-name">מחלקה פנימית ב׳</p>${mid}</div>
  </div></header>`;
}

function footer() {
  return `<footer class="app-footer">
    <span class="glyph">${I.wheat(iconStyle(20))}</span>
    <p>כאן מתחילה ההחלמה</p>
    <p>אב־טיפוס להדגמה · כל הנתונים בדיוניים</p>
  </footer>`;
}

/** The CSS door: recessed frame in a pale wall, light oak slab, dark neutral
 *  lever, downlight above, bumper rails at hip height. */
function doorSlab(number, opts) {
  const o = opts || {};
  return `<div class="door${o.open ? " open" : ""}${o.dim ? " dim" : ""}"${o.style ? ` style="${o.style}"` : ""}>
    <div class="wall"></div>
    <div class="downlight"></div>
    <div class="rails"><span></span><span></span></div>
    <div class="plaque"><span></span></div>
    <div class="frame">
      <span class="fixture"></span>
      <div class="room-light"></div>
      <div class="slab">
        <span class="num">${number}</span>
        <span class="lever-a"></span>
        <span class="lever-b"></span>
      </div>
      <span class="leak"></span>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- reveals */

/** IntersectionObserver stagger — mirrors components/motion/Reveal.tsx.
 *  Disconnects after firing so nothing re-animates on scroll-back. */
function armReveals(root) {
  const nodes = root.querySelectorAll(".reveal:not(.shown)");
  if (!nodes.length) return;
  if (calm()) {
    nodes.forEach((n) => n.classList.add("shown"));
    return;
  }
  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("shown");
        obs.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  nodes.forEach((n) => io.observe(n));
}

/** A value the AI placed in the last few seconds still carries its wash. */
function isFresh(addedAt) {
  return typeof addedAt === "number" && Date.now() - addedAt < 2600;
}
