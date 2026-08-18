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
        // Midnight Aqua
        sea: {
          bg: "#0b1220",
          bg2: "#0f1a2e",
          surface: "#16233b",
          surface2: "#1b2a45",
          border: "#24354f",
          teal: "#2dd4bf",
          emerald: "#34d399",
          amber: "#fbbf24",
          text: "#e8eef7",
          muted: "#8aa0bd",
        },
      },
      backgroundImage: {
        "sea-header": "linear-gradient(150deg,#0f1a2e 0%,#16233b 60%,#132b3d 100%)",
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(45,212,191,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
