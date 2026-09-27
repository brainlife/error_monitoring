/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brainlife Official Palette
        'brainlife-slate': '#2D3748',
        'brainlife-slate-hover': '#232B38',
        'brainlife-slate-active': '#4A5568',
        'brainlife-slate-light': '#3A4352',
        
        // Brainlife Section Colors (exact from themeMui.ts)
        'section-projects': '#3A6F7C',
        'section-apps': '#486C98',
        'section-resources': '#5C8A6C',
        'section-datatypes': '#5C4F6E',

        // Theme palette mappings (Brainlife ash-slate matching Image 1)
        'bg-dark': '#161C26',        // Deep ash-slate canvas
        'bg-deeper': '#121620',      // Inset panel background
        'bg-deepest': '#0F121A',     // Deepest terminal surface
        'surface-glass': '#1E2532',  // Ash-slate surface cards
        'border-glass': '#2D3748',   // Brainlife slate borders
        'border-glass-hover': '#4A5568',
        'accent-cyan': '#4FD1C5',    // Brainlife Cyan Accent
        'accent-cyan-dim': '#319795',
        'accent-purple': '#9F7AEA',  // Soft Datatypes Mauve/Purple
        'status-success': '#48BB78', // Success Green
        'status-warning': '#ECC94B', // Warning Gold
        'status-error': '#F56565',   // Error Red
        'status-running': '#4299E1', // Running Blue/Cyan
        'text-main': '#F7FAFC',      // Crisp white text
        'text-muted': '#A0AEC0',     // Slate ash-grey muted text
        'text-faint': '#718096',     // Subdued slate text
      },
      spacing: {
        '4.5': '1.125rem',
      },
      fontFamily: {
        sans: ['Work Sans', 'Roboto', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      backdropBlur: {
        glass: '16px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 4px 12px -2px rgba(45, 55, 72, 0.08), 0 2px 4px -2px rgba(45, 55, 72, 0.04)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
        'pulse-glow-cyan': 'pulse-glow-cyan 2s infinite',
        'breath': 'breath 3s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-up': 'fade-up 0.4s ease-out backwards',
        'shimmer': 'shimmer 2.5s linear infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%': { boxShadow: '0 0 0 0 rgba(56, 161, 105, 0.4)' },
          '70%': { boxShadow: '0 0 0 8px rgba(56, 161, 105, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(56, 161, 105, 0)' },
        },
        'pulse-glow-cyan': {
          '0%': { boxShadow: '0 0 0 0 rgba(49, 130, 206, 0.4)' },
          '70%': { boxShadow: '0 0 0 8px rgba(49, 130, 206, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(49, 130, 206, 0)' },
        },
        'breath': {
          '0%, 100%': { opacity: '0.7' },
          '50%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(6px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
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
