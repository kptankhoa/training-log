import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Sidebar from './Sidebar.svelte';

vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn((cb) => {
      cb({ url: { pathname: '/' } });
      return () => {};
    })
  }
}));

describe('Sidebar', () => {
  it('renders Calendar, Stats, and Settings links', () => {
    const { getAllByText } = render(Sidebar);
    // Text appears twice: desktop + mobile nav
    expect(getAllByText('Calendar').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Stats').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
  });

  it('links point to correct hrefs', () => {
    const { container } = render(Sidebar);
    const links = container.querySelectorAll('a[href]');
    const hrefs = [...links].map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/stats');
    expect(hrefs).toContain('/settings');
  });
});
