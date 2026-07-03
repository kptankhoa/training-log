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

describe('restTimerMuted store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it('defaults to unmuted when localStorage has no cached value', async () => {
    const { restTimerMuted } = await import('./restTimerMuted');
    expect(get(restTimerMuted)).toBe(false);
  });

  it('initializes from a cached true value in localStorage', async () => {
    localStorage.setItem('restTimerMuted', 'true');
    const { restTimerMuted } = await import('./restTimerMuted');
    expect(get(restTimerMuted)).toBe(true);
  });

  it('initRestTimerMuted sets the store to true when the doc says true', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ data: () => ({ restTimerMuted: true }) });
      return () => {};
    });
    const { restTimerMuted, initRestTimerMuted } = await import('./restTimerMuted');
    initRestTimerMuted('user1');
    expect(get(restTimerMuted)).toBe(true);
  });

  it('initRestTimerMuted defaults to false when the doc has no field', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ data: () => undefined });
      return () => {};
    });
    const { restTimerMuted, initRestTimerMuted } = await import('./restTimerMuted');
    initRestTimerMuted('user1');
    expect(get(restTimerMuted)).toBe(false);
  });

  it('setRestTimerMuted calls setDoc with the given value and merge:true', async () => {
    const { setRestTimerMuted } = await import('./restTimerMuted');
    await setRestTimerMuted('user1', true);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { restTimerMuted: true }, { merge: true });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'meta', 'preferences');
  });

  it('setRestTimerMuted updates the store optimistically before the write resolves', async () => {
    const { restTimerMuted, setRestTimerMuted } = await import('./restTimerMuted');
    const setPromise = setRestTimerMuted('user1', true);
    expect(get(restTimerMuted)).toBe(true); // already true, without awaiting setPromise
    await setPromise;
  });

  it('setRestTimerMuted updates the store locally without writing when there is no userId', async () => {
    const { restTimerMuted, setRestTimerMuted } = await import('./restTimerMuted');
    await setRestTimerMuted('', true);
    expect(get(restTimerMuted)).toBe(true);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('initRestTimerMuted returns an unsubscribe function', async () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const { initRestTimerMuted } = await import('./restTimerMuted');
    const returned = initRestTimerMuted('user1');
    expect(returned).toBe(unsub);
  });
});
