import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // Executive-recruiting palette: one dominant neutral (ivory/stone) with
        // navy/charcoal text and champagne gold reserved for sparing accents.
        navy: "#0B1220",
        charcoal: "#18212F",
        ivory: "#F7F4ED",
        stone: "#E7E2D8",
        gold: {
          DEFAULT: "#B99A5E",
          light: "#D9C79A",
          dark: "#8F7443",
        },
        success: "#237A57",
        amber: "#B7791F",
        danger: "#A34A4A",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(11 18 32 / 0.04), 0 1px 3px 0 rgb(11 18 32 / 0.06)",
        "card-hover": "0 4px 14px -2px rgb(11 18 32 / 0.08), 0 2px 6px -2px rgb(11 18 32 / 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
