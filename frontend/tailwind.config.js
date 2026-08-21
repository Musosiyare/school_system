/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef1f8",
          100: "#dbe1f0",
          200: "#b3c0e0",
          400: "#5b74ab",
          500: "#2b3a67",
          600: "#22304f",
          700: "#1a2540",
          800: "#141c33",
          900: "#0c1120",
        },
        // Signature accent for the nav/header chrome — a muted, antique gold
        // that reads as "academic prestige" against the deep navy, not a
        // literal warning/yellow. Used sparingly: active-state marks, the
        // logo mark, and hairline dividers only.
        gold: {
          300: "#e3cd93",
          400: "#d4b96a",
          500: "#c6a24b",
          600: "#a9863a",
        },
        superuser: "#6b46c1",
        manager: "#2b3a67",
        teacher: "#0d9488",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "sans-serif",
        ],
        display: ["Playfair Display", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
