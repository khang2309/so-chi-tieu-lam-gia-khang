/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#fdf8f0',
          card: '#fffdfa',
          sheet: '#fbf5eb',
          cream: '#f5ebe0',
          line: '#ebdcc9',
          darkline: '#d4bfab',
          border: '#e6d8c3',
        },
        ink: {
          DEFAULT: '#3e332a',
          dark: '#2c241d',
          muted: '#7a6a58',
          faint: '#a89886',
        },
        vintage: {
          accent: '#a25832', // warm terracotta / leather
          gold: '#c28b38',
          sage: '#4b7355',
          rose: '#b24c43',
          blue: '#3b6e8c',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
        handwriting: ['"Caveat"', 'cursive'],
      },
      boxShadow: {
        'paper': '0 2px 8px -2px rgba(62, 51, 42, 0.08), 0 1px 3px -1px rgba(62, 51, 42, 0.05)',
        'paper-lg': '0 8px 24px -4px rgba(62, 51, 42, 0.12), 0 3px 8px -2px rgba(62, 51, 42, 0.06)',
      }
    },
  },
  plugins: [],
}
