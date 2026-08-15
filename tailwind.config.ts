import type { Config } from "tailwindcss";

/**
 * Tokens live in app/globals.css as CSS custom properties; this file only maps
 * them into Tailwind's scales. Adding a color here without adding it there is
 * always a bug.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "var(--page)",
        "page-deep": "var(--page-deep)",
        card: "var(--card)",
        "card-raised": "var(--card-raised)",
        "card-sunken": "var(--card-sunken)",

        navy: {
          DEFAULT: "var(--navy)",
          deep: "var(--navy-deep)",
          soft: "var(--navy-soft)",
          wash: "var(--navy-wash)",
        },

        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          decor: "var(--ink-decor)",
        },
        "on-navy": "var(--on-navy)",

        line: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          navy: "var(--border-navy)",
        },

        oak: {
          DEFAULT: "var(--oak)",
          light: "var(--oak-light)",
          pale: "var(--oak-pale)",
          dark: "var(--oak-dark)",
          edge: "var(--oak-edge)",
        },
        handle: "var(--handle)",

        stable: {
          DEFAULT: "var(--stable)",
          bg: "var(--stable-bg)",
          line: "var(--stable-line)",
        },
        attention: {
          DEFAULT: "var(--attention)",
          bg: "var(--attention-bg)",
          line: "var(--attention-line)",
        },
        urgent: {
          DEFAULT: "var(--urgent)",
          bg: "var(--urgent-bg)",
          line: "var(--urgent-line)",
        },
        info: {
          DEFAULT: "var(--info)",
          bg: "var(--info-bg)",
          line: "var(--info-line)",
        },
        neutral: {
          DEFAULT: "var(--neutral)",
          bg: "var(--neutral-bg)",
          line: "var(--neutral-line)",
        },
      },

      fontFamily: {
        ui: "var(--font-ui)",
      },

      borderRadius: {
        card: "var(--radius-card)",
        panel: "var(--radius-panel)",
        chip: "var(--radius-chip)",
      },

      boxShadow: {
        sm: "var(--shadow-sm)",
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        bar: "var(--shadow-bar)",
      },

      maxWidth: {
        ward: "1360px",
      },
    },
  },
  plugins: [],
};

export default config;
