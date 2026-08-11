/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Stadium Dark - broadcast-graphics inspired cricket theme
        background: '#0B1220',
        surface: '#131C2E',
        'surface-hover': '#1A2338',
        'surface-alt': '#1E2841',
        border: {
          DEFAULT: '#243049',
          strong: '#2F3E5C',
        },
        ink: {
          DEFAULT: '#F1F5F9', // primary text
          secondary: '#96A3BC', // secondary text
          muted: '#6B7A99', // muted/placeholder text
        },
        pitch: {
          50: '#EAFBF1',
          400: '#4ADE80',
          500: '#22C55E', // primary brand green
          600: '#16A34A',
          700: '#15803D',
          900: '#0D3B22',
        },
        gold: {
          400: '#FBBF54',
          500: '#F5A623', // accent
          600: '#D97706',
        },
        wicket: {
          400: '#F87171',
          500: '#EF4444', // danger/wicket red
          600: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
        glow: '0 0 0 1px rgba(34,197,94,0.4), 0 0 20px rgba(34,197,94,0.15)',
      },
    },
  },
  plugins: [],
};
