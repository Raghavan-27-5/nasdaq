/** @type {import('tailwindcss').Config} */

// ---------------------------------------------------------------------------
// "Ink & Signal" design system
// Institutional quant terminal: near-black graphite canvas, hairline borders,
// one restrained signal accent, tabular numerals everywhere.
// Sharp radii (2-4px) on purpose - rounded-xl-everything reads as generic.
// ---------------------------------------------------------------------------

const ink = {
  950: '#08090B', // app canvas
  900: '#0B0D10', // page background
  850: '#0E1013', // panel base
  800: '#12151A', // raised surface
  750: '#171B21', // hover surface
  700: '#1C1F24', // hairline border
  650: '#242931', // emphasised border
  600: '#2E343D', // strong border / divider on hover
}

const fg = {
  hi: '#E9ECEF', // primary text
  base: '#AEB6C1', // secondary text
  dim: '#7A828E', // muted text
  mute: '#565E69', // disabled / watermark
}

const sig = {
  pos: '#4ADE9E', // signal green - primary accent
  posDim: '#2F8F63',
  neg: '#F4553F',
  negDim: '#93362A',
  warn: '#F5A524',
  info: '#5B8DEF',
  alt: '#A78BFA',
  cyan: '#22D3EE',
}

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { ...ink, DEFAULT: ink[900] },
        fg: { ...fg, DEFAULT: fg.base },
        sig: sig,
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.02em' }],
        '3xs': ['0.625rem', { lineHeight: '0.8125rem', letterSpacing: '0.06em' }],
        micro: ['0.75rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        none: '0px',
        xs: '2px',
        sm: '3px',
        DEFAULT: '4px',
        md: '5px',
        lg: '6px',
        xl: '8px',
      },
      boxShadow: {
        // Very restrained - depth from borders, not from drop shadows.
        panel: '0 1px 0 0 rgba(255,255,255,0.02) inset, 0 1px 2px -1px rgba(0,0,0,0.6)',
        pop: '0 12px 32px -8px rgba(0,0,0,0.75), 0 0 0 1px #242931',
        focus: '0 0 0 1px #0E1013, 0 0 0 3px rgba(74,222,158,0.18)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        inout: 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.25s ease-out both',
      },
    },
  },
  plugins: [],
}
