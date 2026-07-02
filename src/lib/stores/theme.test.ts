import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn(() => ({}));

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
}));

describe('theme store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it('defaults to dark when localStorage has no cached value', async () => {
    const { theme } = await import('./theme');
    expect(get(theme)).toBe('dark');
  });

  it('initializes from a cached light value in localStorage', async () => {
    localStorage.setItem('theme', 'light');
    const { theme } = await import('./theme');
    expect(get(theme)).toBe('light');
  });

  it('initTheme sets the store to light when the doc says light', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ data: () => ({ theme: 'light' }) });
      return () => {};
    });
    const { theme, initTheme } = await import('./theme');
    initTheme('user1');
    expect(get(theme)).toBe('light');
  });

  it('initTheme defaults to dark when the doc has no theme field', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ data: () => undefined });
      return () => {};
    });
    const { theme, initTheme } = await import('./theme');
    initTheme('user1');
    expect(get(theme)).toBe('dark');
  });

  it('setTheme calls setDoc with the given value and merge:true', async () => {
    const { setTheme } = await import('./theme');
    await setTheme('user1', 'light');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { theme: 'light' }, { merge: true });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'meta', 'preferences');
  });

  it('initTheme returns an unsubscribe function', async () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const { initTheme } = await import('./theme');
    const returned = initTheme('user1');
    expect(returned).toBe(unsub);
  });
});
