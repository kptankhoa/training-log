import type { GruvboxColor } from './types';

export const GRUVBOX_COLORS: Record<GruvboxColor, string> = {
  red:    '#fb4934',
  green:  '#b8bb26',
  yellow: '#fabd2f',
  blue:   '#83a598',
  purple: '#d3869b',
  aqua:   '#8ec07c',
  orange: '#fe8019',
};

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
