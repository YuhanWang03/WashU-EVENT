import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        gcal: {
          blue:      "#8fa8b8",   // dusty steel blue — primary accent
          bluehover: "#7898a8",   // slightly deeper on hover
          bg:        "#f7f3ef",   // warm off-white canvas
          panel:     "#faf8f5",   // card / panel surface
          border:    "#dcd6ce",   // soft warm border
          text:      "#4a4540",   // warm charcoal
          subtext:   "#9a9088",   // muted warm gray
          today:     "#8fa8b8",   // today highlight (same as primary)
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
