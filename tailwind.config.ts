import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        panel: "var(--panel)",
        glass: "var(--glass)",
        "glass-border": "var(--glass-border)",
        accent: "var(--accent)",
        "accent-glow": "var(--accent-glow)",
        "text-main": "var(--text-main)",
        "text-muted": "var(--text-muted)",
        danger: "var(--danger)",
        warning: "var(--warning)",
        success: "var(--success)",
        "row-hover": "var(--row-hover)",
        "row-selected": "var(--row-selected)",
      },
    },
  },
  plugins: [],
};
export default config;
