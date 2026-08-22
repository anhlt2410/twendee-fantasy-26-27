import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    screens: {
      xs: "420px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
    extend: {
      colors: {
        // Royal Aqua — FPL purple base + cyan-green accents
        sea: {
          bg: "#0d0a1f",
          bg2: "#15112f",
          surface: "#1b1640",
          surface2: "#231c4d",
          border: "#332a56",
          teal: "#2dd4bf",
          rose: "#fb7185",
          emerald: "#34d399",
          amber: "#fbbf24",
          text: "#e8eef7",
          muted: "#9a97bd",
        },
      },
      backgroundImage: {
        "sea-header": "linear-gradient(150deg,#37003c 0%,#3a1668 60%,#24215e 100%)",
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(45,212,191,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
