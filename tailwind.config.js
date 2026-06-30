import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        gb: {
          bg:     '#1d2021',
          bg0:    '#161819',
          bg1:    '#282828',
          bg2:    '#3c3836',
          bg3:    '#504945',
          fg:     '#ebdbb2',
          fg2:    '#d5c4a1',
          fg3:    '#bdae93',
          gray:   '#928374',
          red:    '#fb4934',
          green:  '#b8bb26',
          yellow: '#fabd2f',
          blue:   '#83a598',
          purple: '#d3869b',
          aqua:   '#8ec07c',
          orange: '#fe8019',
        }
      }
    }
  },
  plugins: [typography]
};
