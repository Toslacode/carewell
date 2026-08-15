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
        page: "rgb(var(--page-rgb) / <alpha-value>)",
        "page-deep": "rgb(var(--page-deep-rgb) / <alpha-value>)",
        card: "rgb(var(--card-rgb) / <alpha-value>)",
        "card-raised": "rgb(var(--card-raised-rgb) / <alpha-value>)",
        "card-sunken": "rgb(var(--card-sunken-rgb) / <alpha-value>)",

        navy: {
          DEFAULT: "rgb(var(--navy-rgb) / <alpha-value>)",
          deep: "rgb(var(--navy-deep-rgb) / <alpha-value>)",
          soft: "rgb(var(--navy-soft-rgb) / <alpha-value>)",
          wash: "rgb(var(--navy-wash-rgb) / <alpha-value>)",
        },
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",

        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          muted: "rgb(var(--ink-muted-rgb) / <alpha-value>)",
          decor: "rgb(var(--ink-decor-rgb) / <alpha-value>)",
        },
        "on-navy": "rgb(var(--on-navy-rgb) / <alpha-value>)",

        line: {
          DEFAULT: "rgb(var(--border-rgb) / <alpha-value>)",
          strong: "rgb(var(--border-strong-rgb) / <alpha-value>)",
          navy: "rgb(var(--border-navy-rgb) / <alpha-value>)",
        },

        oak: {
          DEFAULT: "rgb(var(--oak-rgb) / <alpha-value>)",
          light: "rgb(var(--oak-light-rgb) / <alpha-value>)",
          pale: "rgb(var(--oak-pale-rgb) / <alpha-value>)",
          dark: "rgb(var(--oak-dark-rgb) / <alpha-value>)",
          edge: "rgb(var(--oak-edge-rgb) / <alpha-value>)",
        },
        handle: "rgb(var(--handle-rgb) / <alpha-value>)",

        stable: {
          DEFAULT: "rgb(var(--stable-rgb) / <alpha-value>)",
          bg: "rgb(var(--stable-bg-rgb) / <alpha-value>)",
          line: "rgb(var(--stable-line-rgb) / <alpha-value>)",
        },
        attention: {
          DEFAULT: "rgb(var(--attention-rgb) / <alpha-value>)",
          bg: "rgb(var(--attention-bg-rgb) / <alpha-value>)",
          line: "rgb(var(--attention-line-rgb) / <alpha-value>)",
        },
        urgent: {
          DEFAULT: "rgb(var(--urgent-rgb) / <alpha-value>)",
          bg: "rgb(var(--urgent-bg-rgb) / <alpha-value>)",
          line: "rgb(var(--urgent-line-rgb) / <alpha-value>)",
        },
        info: {
          DEFAULT: "rgb(var(--info-rgb) / <alpha-value>)",
          bg: "rgb(var(--info-bg-rgb) / <alpha-value>)",
          line: "rgb(var(--info-line-rgb) / <alpha-value>)",
        },
        neutral: {
          DEFAULT: "rgb(var(--neutral-rgb) / <alpha-value>)",
          bg: "rgb(var(--neutral-bg-rgb) / <alpha-value>)",
          line: "rgb(var(--neutral-line-rgb) / <alpha-value>)",
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
