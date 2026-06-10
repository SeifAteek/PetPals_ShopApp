/** Tailwind preset — colors align with iOS `PetPalsPalette.classic` */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#f2a4a5',
          50: '#fdf4f4',
          100: '#fce8e8',
          200: '#f9d0d1',
          300: '#f5b0b1',
          400: '#f2a4a5',
          500: '#f2a4a5',
          600: '#e88a8b',
          700: '#d46e6f',
          800: '#964042',
          900: '#7a3839',
        },
        honeydew: '#f2ffe9',
        blush: '#f2a4a5',
        almond: '#e5d4c5',
        cerulean: {
          DEFAULT: '#3078a4',
          light: '#4a94c4',
        },
        navy: {
          DEFAULT: '#090087',
          dark: '#010a2e',
        },
        pp: {
          honeydew: '#f2ffe9',
          blush: '#f2a4a5',
          almond: '#e5d4c5',
          cerulean: '#3078a4',
          navy: '#090087',
          'navy-dark': '#010a2e',
        },
      },
      fontFamily: {
        sans: [
          'Nunito',
          'ui-rounded',
          'SF Pro Rounded',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        display: [
          'Nunito',
          'ui-rounded',
          'SF Pro Rounded',
          '-apple-system',
          'sans-serif',
        ],
      },
      borderRadius: {
        pp: '32px',
        'pp-sm': '18px',
        'pp-md': '24px',
        'pp-lg': '32px',
        'pp-xl': '40px',
        'pp-2xl': '48px',
        pill: '9999px',
      },
      boxShadow: {
        pp: '0 6px 16px rgba(9, 0, 135, 0.12)',
        'pp-float': '0 12px 24px rgba(9, 0, 135, 0.14)',
        glow: '0 0 40px -8px rgba(242, 164, 165, 0.45)',
      },
      backgroundImage: {
        'pp-brand': 'linear-gradient(135deg, #f2a4a5 0%, rgba(48, 120, 164, 0.85) 55%, #090087 100%)',
      },
    },
  },
};
