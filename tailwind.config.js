/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#faf9f7',
          100: '#f5f2ed',
          200: '#e8e3d9',
          300: '#d8d1c4',
          400: '#c5bbab',
          500: '#a99d8b',
          600: '#8d8171',
          700: '#6d655a',
          800: '#534e47',
          900: '#3d3a36',
        },
        sage: {
          50: '#f6f8f6',
          100: '#e8ede8',
          200: '#d0dbd0',
          300: '#afc2af',
          400: '#8aa88a',
          500: '#6b8e6b',
          600: '#547254',
          700: '#435a43',
          800: '#364836',
          900: '#2d3c2d',
        },
      },
    },
  },
  plugins: [],
}
