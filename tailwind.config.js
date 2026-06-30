import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        gb: {
          bg:     '#282828',
          bg1:    '#3c3836',
          bg2:    '#504945',
          bg3:    '#665c54',
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
