/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF8F0',
        ink: '#1A1A1A',
        primary: {
          DEFAULT: '#FF5A1F',
          dark: '#E04E15',
          light: '#FF7A4A',
        },
        wa: {
          DEFAULT: '#25D366',
          dark: '#1FB855',
        },
      },
      fontFamily: {
        display: ['Bricolage Grotesque', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
