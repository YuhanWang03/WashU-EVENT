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
          blue:      "#7B57D2",   // Material You purple — primary
          bluehover: "#6A48C0",   // deeper purple on hover
          bg:        "#F5EEFF",   // light lavender background
          panel:     "#FEFAFF",   // near-white panel surface
          border:    "#CAC4D0",   // Material outline
          text:      "#1C1B1F",   // Material on-surface
          subtext:   "#49454F",   // Material on-surface-variant
          today:     "#7B57D2",   // today highlight
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
