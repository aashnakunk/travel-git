/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0f14',
        panel: '#11161d',
        'panel-2': '#161c25',
        edge: '#2a323d',
        muted: '#8b98a8',
        accent: '#3b9bff',
        'accent-2': '#22d3ee',
        merge: '#a371f7',
        added: '#3fb950',
        removed: '#f85149',
        gold: '#f0b429',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(59,155,255,0.15), 0 8px 30px rgba(0,0,0,0.4)',
        card: '0 1px 0 rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.25)',
      },
      backgroundImage: {
        'hero-grid':
          'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
        'accent-gradient': 'linear-gradient(135deg, #3b9bff 0%, #a371f7 100%)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-slow': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'slide-in-logo': {
          '0%': { opacity: '0', transform: 'translateX(-60px) scale(0.8) rotate(-12deg)' },
          '60%': { opacity: '1', transform: 'translateX(8px) scale(1.05) rotate(0deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1) rotate(0deg)' },
        },
        'slide-in-word': {
          '0%': { opacity: '0', transform: 'translateX(40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'splash-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0', visibility: 'hidden' },
        },
        'draw-path': {
          '0%': { strokeDashoffset: '300' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-in-slow': 'fade-in-slow 0.6s ease-out both',
        float: 'float 4s ease-in-out infinite',
        'slide-in-logo': 'slide-in-logo 0.9s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in-word': 'slide-in-word 0.7s ease-out both',
        'splash-out': 'splash-out 0.6s ease-in forwards',
        'draw-path': 'draw-path 1.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}
