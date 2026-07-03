import { derived } from 'svelte/store';
import { theme } from './stores/theme';
import type { GruvboxColor } from './types';

const GRUVBOX_DARK: Record<GruvboxColor, string> = {
  red:    '#fb4934',
  green:  '#b8bb26',
  yellow: '#fabd2f',
  blue:   '#83a598',
  purple: '#d3869b',
  aqua:   '#8ec07c',
  orange: '#fe8019',
};

const GRUVBOX_LIGHT: Record<GruvboxColor, string> = {
  red:    '#9d0006',
  green:  '#68630c',
  yellow: '#86570f',
  blue:   '#076678',
  purple: '#8f3f71',
  aqua:   '#3a6b4d',
  orange: '#af3a03',
};

export const gruvboxColors = derived(theme, ($theme) => ($theme === 'dark' ? GRUVBOX_DARK : GRUVBOX_LIGHT));

export const COLOR_ORDER: GruvboxColor[] = [
  'red', 'green', 'yellow', 'blue', 'purple', 'aqua', 'orange'
];

export function nextColor(usedColors: GruvboxColor[]): GruvboxColor {
  const used = new Set(usedColors);
  for (const color of COLOR_ORDER) {
    if (!used.has(color)) return color;
  }
  return COLOR_ORDER[usedColors.length % COLOR_ORDER.length];
}
