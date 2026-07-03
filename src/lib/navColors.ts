import type { GruvboxColor } from './types';

// Each nav route gets its own accent color — the active nav item and that
// page's title/heading share it, so the color reads as "which page am I on"
// rather than every page glowing the same uniform green.
export const NAV_COLORS: Record<string, GruvboxColor> = {
  '/': 'green',
  '/calendar': 'blue',
  '/train': 'orange',
  '/splits': 'purple',
  '/stats': 'aqua',
  '/settings': 'yellow',
};

export function navColor(path: string): GruvboxColor {
  return NAV_COLORS[path] ?? 'green';
}

// Tailwind's JIT scanner only detects complete class-name strings written
// literally in source files — it can't see the result of runtime string
// interpolation (e.g. `${prefix}-gb-light-${color}`), so every class this
// module can return has to be spelled out verbatim below, not assembled.
const TEXT_CLASSES: Record<GruvboxColor, string> = {
  red: 'text-gb-light-red dark:text-gb-red',
  green: 'text-gb-light-green dark:text-gb-green',
  yellow: 'text-gb-light-yellow dark:text-gb-yellow',
  blue: 'text-gb-light-blue dark:text-gb-blue',
  purple: 'text-gb-light-purple dark:text-gb-purple',
  aqua: 'text-gb-light-aqua dark:text-gb-aqua',
  orange: 'text-gb-light-orange dark:text-gb-orange',
};

const BORDER_CLASSES: Record<GruvboxColor, string> = {
  red: 'border-gb-light-red dark:border-gb-red',
  green: 'border-gb-light-green dark:border-gb-green',
  yellow: 'border-gb-light-yellow dark:border-gb-yellow',
  blue: 'border-gb-light-blue dark:border-gb-blue',
  purple: 'border-gb-light-purple dark:border-gb-purple',
  aqua: 'border-gb-light-aqua dark:border-gb-aqua',
  orange: 'border-gb-light-orange dark:border-gb-orange',
};

const BG_CLASSES: Record<GruvboxColor, string> = {
  red: 'bg-gb-light-red dark:bg-gb-red',
  green: 'bg-gb-light-green dark:bg-gb-green',
  yellow: 'bg-gb-light-yellow dark:bg-gb-yellow',
  blue: 'bg-gb-light-blue dark:bg-gb-blue',
  purple: 'bg-gb-light-purple dark:bg-gb-purple',
  aqua: 'bg-gb-light-aqua dark:bg-gb-aqua',
  orange: 'bg-gb-light-orange dark:bg-gb-orange',
};

const GLOW_CLASSES: Record<GruvboxColor, string> = {
  red: 'glow-red',
  green: 'glow-green',
  yellow: 'glow-yellow',
  blue: 'glow-blue',
  purple: 'glow-purple',
  aqua: 'glow-aqua',
  orange: 'glow-orange',
};

export function navTextClass(path: string): string {
  return TEXT_CLASSES[navColor(path)];
}

export function navBorderClass(path: string): string {
  return BORDER_CLASSES[navColor(path)];
}

export function navBgClass(path: string): string {
  return BG_CLASSES[navColor(path)];
}

export function navColorClasses(path: string): string {
  const color = navColor(path);
  return `${TEXT_CLASSES[color]} ${GLOW_CLASSES[color]}`;
}
