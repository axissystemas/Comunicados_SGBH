/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#006a5b',
        'primary-container': '#008573',
        secondary: '#7d5700',
        'secondary-container': '#ffc55f',
        tertiary: '#ba112c',
        background: '#f8fafa',
        surface: '#f8fafa',
        'surface-container-low': '#f2f4f4',
        'surface-container-high': '#eceeee',
        'surface-container-highest': '#e1e3e3',
        'on-surface': '#191c1d',
        'on-surface-variant': '#3e4946',
        'outline-variant': '#bdc9c5',
      },
      fontFamily: {
        headline: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui'],
        body: ['var(--font-inter)', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
