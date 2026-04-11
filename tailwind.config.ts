import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gcal: {
          blue: "#1a73e8",
          bluehover: "#185abc",
          bg: "#ffffff",
          panel: "#f8fafd",
          border: "#dadce0",
          text: "#3c4043",
          subtext: "#5f6368",
          today: "#1a73e8",
        },
      },
      fontFamily: {
        sans: [
          "Google Sans",
          "Roboto",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
