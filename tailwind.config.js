import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
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
          light: {
            bg:     '#e5e1c8',
            bg0:    '#ded1ad',
            bg1:    '#e7ddb8',
            bg2:    '#d7c7a3',
            bg3:    '#c1b092',
            fg:     '#3c3836',
            fg2:    '#504945',
            fg3:    '#665c54',
            gray:   '#928374',
            red:    '#9d0006',
            green:  '#79740e',
            yellow: '#b57614',
            blue:   '#076678',
            purple: '#8f3f71',
            aqua:   '#427b58',
            orange: '#af3a03',
          },
        }
      }
    }
  },
  plugins: [typography]
};
