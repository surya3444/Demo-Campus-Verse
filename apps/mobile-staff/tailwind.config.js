/** @type {import('tailwindcss').Config} */
// CampusVerse brand: the web app's navy + cyan and its Plus Jakarta Sans / DM Sans pair.
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#042A6C',
          50: '#F0F5FE',
          100: '#E1ECFE',
          200: '#C4D9FD',
          300: '#84AFFB',
          400: '#3A80F8',
          500: '#0749BB',
          600: '#053495',
          700: '#042A6C',
          800: '#031F4F',
          900: '#02173B',
        },
        cyan: {
          DEFAULT: '#0AC5FF',
          50: '#EBFAFF',
          100: '#D6F5FF',
          200: '#99E6FF',
          300: '#47D1FF',
          400: '#0AC5FF',
          500: '#00A8E0',
          600: '#008AB8',
          700: '#006B8F',
        },
        secondary: {
          DEFAULT: '#526C98',
          50: '#F9F8F5',
          100: '#EDF0F3',
          200: '#DAE0E7',
          300: '#D3DAE4',
          400: '#8998B3',
          500: '#526C98',
          600: '#3E5683',
          700: '#2E4470',
          800: '#042A6C',
          900: '#02173B',
        },
      },
      fontFamily: {
        display: ['PlusJakartaSans_700Bold'],
        sans: ['DMSans_400Regular'],
        mono: ['CVMono_400Regular'],
      },
    },
  },
  plugins: [],
};
