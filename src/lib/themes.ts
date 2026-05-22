

interface ThemeVars {
  bg0: string; bg1: string; bg2: string; bg3: string; bg4: string
  surface: string
  accent: string; accent2: string
  gradient: string; glow: string
}

export const THEME_CONFIGS: Record<string, ThemeVars> = {
  ember: {
    bg0: '#0f0008', bg1: '#1c0a14', bg2: '#221020', bg3: '#2a1428', bg4: '#341830',
    surface: '#2e1828',
    accent: '#f59e0b', accent2: '#dc2626',
    gradient: 'linear-gradient(135deg, #dc2626, #f59e0b)',
    glow: `radial-gradient(ellipse 800px 400px at 50% 100%, #dc262622 0%, transparent 60%),
           radial-gradient(ellipse 500px 350px at 0% 30%, #f59e0b15 0%, transparent 55%),
           radial-gradient(ellipse 400px 300px at 100% 0%, #ec489910 0%, transparent 65%)`,
  },
  ocean: {
    bg0: '#00080f', bg1: '#050f1c', bg2: '#0a1624', bg3: '#0f1e2f', bg4: '#14263a',
    surface: '#0d1c2c',
    accent: '#06b6d4', accent2: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    glow: `radial-gradient(ellipse 800px 400px at 50% 100%, #3b82f622 0%, transparent 60%),
           radial-gradient(ellipse 500px 350px at 0% 30%, #06b6d415 0%, transparent 55%),
           radial-gradient(ellipse 400px 300px at 100% 0%, #818cf810 0%, transparent 65%)`,
  },
  forest: {
    bg0: '#020b05', bg1: '#071209', bg2: '#0b180e', bg3: '#101f13', bg4: '#152618',
    surface: '#0e1d11',
    accent: '#22c55e', accent2: '#15803d',
    gradient: 'linear-gradient(135deg, #15803d, #22c55e)',
    glow: `radial-gradient(ellipse 800px 400px at 50% 100%, #15803d22 0%, transparent 60%),
           radial-gradient(ellipse 500px 350px at 0% 30%, #22c55e15 0%, transparent 55%),
           radial-gradient(ellipse 400px 300px at 100% 0%, #4ade8010 0%, transparent 65%)`,
  },
  purple: {
    bg0: '#08030f', bg1: '#110819', bg2: '#170e22', bg3: '#1e142c', bg4: '#261a36',
    surface: '#1b1228',
    accent: '#a855f7', accent2: '#7c3aed',
    gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    glow: `radial-gradient(ellipse 800px 400px at 50% 100%, #7c3aed22 0%, transparent 60%),
           radial-gradient(ellipse 500px 350px at 0% 30%, #a855f715 0%, transparent 55%),
           radial-gradient(ellipse 400px 300px at 100% 0%, #c084fc10 0%, transparent 65%)`,
  },
  rose: {
    bg0: '#0f0208', bg1: '#1c0710', bg2: '#220b16', bg3: '#2a101d', bg4: '#341525',
    surface: '#2b0f1e',
    accent: '#f43f5e', accent2: '#e11d48',
    gradient: 'linear-gradient(135deg, #e11d48, #f43f5e)',
    glow: `radial-gradient(ellipse 800px 400px at 50% 100%, #e11d4822 0%, transparent 60%),
           radial-gradient(ellipse 500px 350px at 0% 30%, #f43f5e15 0%, transparent 55%),
           radial-gradient(ellipse 400px 300px at 100% 0%, #fb718510 0%, transparent 65%)`,
  },
  midnight: {
    bg0: '#02020a', bg1: '#080812', bg2: '#0d0d1a', bg3: '#121220', bg4: '#181826',
    surface: '#101020',
    accent: '#818cf8', accent2: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #818cf8)',
    glow: `radial-gradient(ellipse 800px 400px at 50% 100%, #6366f122 0%, transparent 60%),
           radial-gradient(ellipse 500px 350px at 0% 30%, #818cf815 0%, transparent 55%),
           radial-gradient(ellipse 400px 300px at 100% 0%, #a5b4fc10 0%, transparent 65%)`,
  },
  sunset: {
    bg0: '#0f0600', bg1: '#1c0e04', bg2: '#22130a', bg3: '#2a1910', bg4: '#341f15',
    surface: '#2a1710',
    accent: '#f97316', accent2: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899, #f97316)',
    glow: `radial-gradient(ellipse 800px 400px at 50% 100%, #ec489922 0%, transparent 60%),
           radial-gradient(ellipse 500px 350px at 0% 30%, #f9731615 0%, transparent 55%),
           radial-gradient(ellipse 400px 300px at 100% 0%, #fb923c10 0%, transparent 65%)`,
  },
  arctic: {
    bg0: '#03080f', bg1: '#060f18', bg2: '#0a1520', bg3: '#0f1c28', bg4: '#142230',
    surface: '#0c1a26',
    accent: '#7dd3fc', accent2: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8, #7dd3fc)',
    glow: `radial-gradient(ellipse 800px 400px at 50% 100%, #38bdf822 0%, transparent 60%),
           radial-gradient(ellipse 500px 350px at 0% 30%, #7dd3fc15 0%, transparent 55%),
           radial-gradient(ellipse 400px 300px at 100% 0%, #bae6fd10 0%, transparent 65%)`,
  },
}

export const THEME_META: Record<string, { label: string; color: string }> = {
  ember:    { label: 'Ember',    color: 'linear-gradient(135deg,#dc2626,#f59e0b)' },
  ocean:    { label: 'Ocean',    color: 'linear-gradient(135deg,#3b82f6,#06b6d4)' },
  forest:   { label: 'Forest',   color: 'linear-gradient(135deg,#15803d,#22c55e)' },
  purple:   { label: 'Purple',   color: 'linear-gradient(135deg,#7c3aed,#a855f7)' },
  rose:     { label: 'Rose',     color: 'linear-gradient(135deg,#e11d48,#f43f5e)' },
  midnight: { label: 'Midnight', color: 'linear-gradient(135deg,#6366f1,#818cf8)' },
  sunset:   { label: 'Sunset',   color: 'linear-gradient(135deg,#ec4899,#f97316)' },
  arctic:   { label: 'Arctic',   color: 'linear-gradient(135deg,#38bdf8,#7dd3fc)' },
}

export function applyColorTheme(themeId: string): void {
  const t = THEME_CONFIGS[themeId] ?? THEME_CONFIGS.ember
  const r = document.documentElement
  r.style.setProperty('--eb-bg0',     t.bg0)
  r.style.setProperty('--eb-bg1',     t.bg1)
  r.style.setProperty('--eb-bg2',     t.bg2)
  r.style.setProperty('--eb-bg3',     t.bg3)
  r.style.setProperty('--eb-bg4',     t.bg4)
  r.style.setProperty('--eb-surface', t.surface)
  r.style.setProperty('--eb-accent',  t.accent)
  r.style.setProperty('--eb-accent2', t.accent2)
  r.style.setProperty('--eb-gradient', t.gradient)
  r.style.setProperty('--eb-glow',    t.glow)
}
