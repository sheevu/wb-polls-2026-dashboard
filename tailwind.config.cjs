/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        bjp: '#ff8c1a',
        tmc: '#009966',
        inc: '#1a73e8',
        left: '#c62828',
        neutralParty: '#cccccc',
      },
    },
  },
  plugins: [],
};
