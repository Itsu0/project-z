import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ember: {
          bg0:      '#0f0008',
          bg1:      '#1c0a14',
          bg2:      '#221020',
          bg3:      '#2a1428',
          bg4:      '#341830',
          surface:  '#2e1828',
          border:   'rgba(255,255,255,0.06)',
          border2:  'rgba(255,255,255,0.10)',
          text1:    '#e4e5e9',
          text2:    '#a8a9af',
          text3:    '#5f6068',
          accent:   '#f59e0b',
          accent2:  '#dc2626',
          online:   '#22c55e',
          voice:    '#4a9eff',
          mention:  '#f87171',
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'DM Sans', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'ember-gradient': 'linear-gradient(135deg, #dc2626, #f59e0b)',
        'ember-radial': 'radial-gradient(ellipse 800px 400px at 50% 100%, #dc262625 0%, transparent 60%), radial-gradient(ellipse 500px 350px at 0% 30%, #f59e0b18 0%, transparent 55%)',
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'speaking': 'speaking 0.8s ease-in-out infinite',
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.85)' },
        },
        'speaking': {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
