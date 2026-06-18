/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        earth: {
          50: '#faf7f2',
          100: '#f0e8dc',
          200: '#e0d0b8',
          300: '#cfb48e',
          400: '#bf996a',
          500: '#a87d4d',
          600: '#8b6340',
          700: '#6e4d34',
          800: '#5a3f2c',
          900: '#4a3425',
        }
      }
    },
  },
  plugins: [],
}
