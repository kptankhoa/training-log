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

describe('restTimerSound store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it('defaults to ding when localStorage has no cached value', async () => {
    const { restTimerSound } = await import('./restTimerSound');
    expect(get(restTimerSound)).toBe('ding');
  });

  it('initializes from a cached value in localStorage', async () => {
    localStorage.setItem('restTimerSound', 'ding3');
    const { restTimerSound } = await import('./restTimerSound');
    expect(get(restTimerSound)).toBe('ding3');
  });

  it('ignores an invalid cached value', async () => {
    localStorage.setItem('restTimerSound', 'not-a-sound');
    const { restTimerSound } = await import('./restTimerSound');
    expect(get(restTimerSound)).toBe('ding');
  });

  it('initRestTimerSound sets the store from the doc', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ data: () => ({ restTimerSound: 'ding2' }) });
      return () => {};
    });
    const { restTimerSound, initRestTimerSound } = await import('./restTimerSound');
    initRestTimerSound('user1');
    expect(get(restTimerSound)).toBe('ding2');
  });

  it('initRestTimerSound defaults to ding when the doc has no field', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ data: () => undefined });
      return () => {};
    });
    const { restTimerSound, initRestTimerSound } = await import('./restTimerSound');
    initRestTimerSound('user1');
    expect(get(restTimerSound)).toBe('ding');
  });

  it('setRestTimerSound calls setDoc with the given value and merge:true', async () => {
    const { setRestTimerSound } = await import('./restTimerSound');
    await setRestTimerSound('user1', 'ding2');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { restTimerSound: 'ding2' }, { merge: true });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'meta', 'preferences');
  });

  it('initRestTimerSound returns an unsubscribe function', async () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const { initRestTimerSound } = await import('./restTimerSound');
    const returned = initRestTimerSound('user1');
    expect(returned).toBe(unsub);
  });
});
