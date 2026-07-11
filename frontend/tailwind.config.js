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
