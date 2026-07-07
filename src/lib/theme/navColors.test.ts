import { describe, it, expect } from 'vitest';
import { NAV_COLORS, navColorClasses, navBorderClass, navTextClass, navBgClass } from './navColors';

describe('NAV_COLORS', () => {
  it('assigns a distinct color to each of the 6 nav routes', () => {
    const routes = ['/', '/calendar', '/train', '/splits', '/stats', '/settings'];
    const colors = routes.map((r) => NAV_COLORS[r]);
    expect(new Set(colors).size).toBe(routes.length);
  });
});

describe('navColorClasses', () => {
  it('returns light/dark text classes and a matching glow class for a known route', () => {
    const classes = navColorClasses('/train');
    expect(classes).toContain('text-gb-light-orange');
    expect(classes).toContain('dark:text-gb-orange');
    expect(classes).toContain('glow-orange');
  });

  it('resolves each mapped route to a color whose classes are internally consistent', () => {
    for (const [route, color] of Object.entries(NAV_COLORS)) {
      const classes = navColorClasses(route);
      expect(classes).toContain(`text-gb-light-${color}`);
      expect(classes).toContain(`dark:text-gb-${color}`);
      expect(classes).toContain(`glow-${color}`);
    }
  });

  it('falls back to green for an unknown route', () => {
    expect(navColorClasses('/does-not-exist')).toBe(navColorClasses('/'));
  });
});

describe('navBorderClass / navTextClass / navBgClass', () => {
  it('returns the matching literal border/text/bg pair for a known route', () => {
    expect(navBorderClass('/settings')).toBe('border-gb-light-yellow dark:border-gb-yellow');
    expect(navTextClass('/settings')).toBe('text-gb-light-yellow dark:text-gb-yellow');
    expect(navBgClass('/stats')).toBe('bg-gb-light-aqua dark:bg-gb-aqua');
  });

  it('resolves every mapped route to internally consistent literal classes', () => {
    for (const [route, color] of Object.entries(NAV_COLORS)) {
      expect(navBorderClass(route)).toBe(`border-gb-light-${color} dark:border-gb-${color}`);
      expect(navTextClass(route)).toBe(`text-gb-light-${color} dark:text-gb-${color}`);
      expect(navBgClass(route)).toBe(`bg-gb-light-${color} dark:bg-gb-${color}`);
    }
  });
});
