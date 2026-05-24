import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Marine-themed palette tuned for outdoor/sunlight legibility (NFR-011).
        chart: {
          water: '#9ec9e8',
          waterDeep: '#5fa3cd',
          land: '#e8e2d4',
          landMuted: '#cdc6b6',
          buoyRed: '#d4392b',
          buoyGreen: '#2f8f3f',
          hazard: '#ff9500',
          route: '#0a84ff',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f5f5f7',
          inverse: '#0b1d2a',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      // Touch targets meet NFR-010 (44pt minimum).
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};

export default config;
