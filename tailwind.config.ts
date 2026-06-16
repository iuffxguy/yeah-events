import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        yeah: {
          // Fixed brand colors — same in both themes
          yellow: "#FFE034",
          coral: "#FF4D4D",
          teal: "#00C2A8",
          navy: "#0D0F1A",   // always-dark (used for text on colored badges)
          muted: "#6B7280",
          // Theme-aware colors — defined as CSS variables
          bg:   "rgb(var(--yeah-bg)   / <alpha-value>)",  // page background
          ink:  "rgb(var(--yeah-ink)  / <alpha-value>)",  // card/surface background
          fg:   "rgb(var(--yeah-fg)   / <alpha-value>)",  // primary text
          line: "rgb(var(--yeah-line) / <alpha-value>)",  // borders & overlays
        },
      },
      animation: {
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
