/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#050811',
        'bg-deeper': '#09111d',
        'bg-deepest': '#0d1525',
        'surface-glass': 'rgba(18, 24, 38, 0.72)',
        'border-glass': 'rgba(255, 255, 255, 0.08)',
        'border-glass-hover': 'rgba(255, 255, 255, 0.2)',
        'accent-cyan': '#00E5FF',
        'accent-cyan-dim': '#00B8D4',
        'accent-purple': '#8B5CF6',
        'status-success': '#10B981',
        'status-warning': '#F59E0B',
        'status-error': '#EF4444',
        'status-running': '#00E5FF',
        'text-main': '#F8FAFC',
        'text-muted': '#CBD5E1',
        'text-faint': '#94A3B8',
      },
      spacing: {
        '4.5': '1.125rem',
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      backdropBlur: {
        glass: '16px',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
        'pulse-glow-cyan': 'pulse-glow-cyan 2s infinite',
        'breath': 'breath 3s ease-in-out infinite',
        'slide-in': 'slide-in 0.4s ease-out',
        'fade-up': 'fade-up 0.5s ease-out backwards',
        'shimmer': 'shimmer 2.5s linear infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.5)' },
          '70%': { boxShadow: '0 0 0 10px rgba(16, 185, 129, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' },
        },
        'pulse-glow-cyan': {
          '0%': { boxShadow: '0 0 0 0 rgba(56, 189, 248, 0.5)' },
          '70%': { boxShadow: '0 0 0 10px rgba(56, 189, 248, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(56, 189, 248, 0)' },
        },
        'breath': {
          '0%, 100%': { opacity: '0.6', filter: 'drop-shadow(0 0 4px hsl(180 100% 50%))' },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 12px hsl(180 100% 50%))' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
