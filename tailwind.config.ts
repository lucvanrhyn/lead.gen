import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./tests/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        surface: "var(--color-surface)",
        "surface-strong": "var(--color-surface-strong)",
        cream: "var(--color-cream)",
        amber: "var(--color-amber)",
        rust: "var(--color-rust)",
        tan: "var(--color-tan)",
      },
      fontFamily: {
        display: ["var(--font-playfair-display)", "serif"],
        sans: ["var(--font-dm-sans)", "sans-serif"],
        serif: ["var(--font-dm-serif-display)", "serif"],
      },
      boxShadow: {
        glow: "0 24px 80px rgba(0, 0, 0, 0.32)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at top, rgba(210, 180, 140, 0.16), transparent 40%), linear-gradient(135deg, rgba(139, 105, 20, 0.1), transparent 55%)",
      },
    },
  },
  plugins: [],
};

export default config;
