const palette = require('./constants/palette');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  // Folder colors come from data in services/, which Tailwind does not scan.
  safelist: [
    'bg-primary-container',
    'bg-secondary-container',
    'bg-tertiary-container',
    'bg-error-container',
    'text-primary',
    'text-on-primary-container',
    'text-on-secondary-container',
    'text-on-tertiary-container',
    'text-on-error-container',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Colors are CSS variables so the theme can switch at runtime (see constants/theme.tsx).
      colors: Object.fromEntries(
        Object.keys(palette.light).map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`]),
      ),
      borderRadius: {
        DEFAULT: '4px',
        lg: '8px',
        xl: '12px',
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '32px',
      },
      spacing: {
        'margin-mobile': '16px',
        'margin-tablet': '24px',
        gutter: '12px',
        'stack-sm': '8px',
        'stack-md': '16px',
        'stack-lg': '24px',
      },
      fontFamily: {
        inter: ['InterTight_400Regular'],
        'inter-medium': ['InterTight_500Medium'],
        'inter-semibold': ['InterTight_600SemiBold'],
        'inter-bold': ['InterTight_700Bold'],
      },
      fontSize: {
        'large-title': ['34px', { lineHeight: '40px', letterSpacing: -0.8, fontWeight: '700' }],
        'display-lg': ['32px', { lineHeight: '40px', letterSpacing: -0.64, fontWeight: '700' }],
        'headline-lg-mobile': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'title-md': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: 0.24, fontWeight: '500' }],
        'label-caps': ['11px', { lineHeight: '16px', letterSpacing: 0.55, fontWeight: '700' }],
      },
    },
  },
  plugins: [],
};
