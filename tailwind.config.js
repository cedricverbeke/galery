/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0D0D0D',
          900: '#161616',
          800: '#1F1F1F',
          700: '#262626',
          600: '#2E2E2E',
          500: '#3A3A3A',
        },
        sand: {
          50: '#F8F3EC',
          100: '#EFE6D8',
          200: '#E5D3B8',
          300: '#D4B996',
          400: '#C6A880',
          500: '#B8976E',
          600: '#9C7E58',
          700: '#7E6446',
          800: '#5F4B34',
          900: '#40321F',
        },
        cream: '#F5F5F5',
        muted: '#A3A3A3',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.2em',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        scaleIn: 'scaleIn 0.25s ease-out',
        slideUp: 'slideUp 0.35s ease-out',
        popIn: 'popIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};
