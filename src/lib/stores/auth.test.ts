import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/firebase', () => ({
  auth: {},
  db: {}
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

describe('auth store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes with null user when not signed in', async () => {
    const { onAuthStateChanged } = await import('firebase/auth');
    (onAuthStateChanged as ReturnType<typeof vi.fn>).mockImplementation((_auth, cb) => {
      cb(null);
      return () => {};
    });
    const { user } = await import('./auth');
    expect(get(user)).toBeNull();
  });

  it('updates user store when auth state changes to a user', async () => {
    const mockUser = { uid: 'abc123', email: 'test@example.com' };
    const { onAuthStateChanged } = await import('firebase/auth');
    (onAuthStateChanged as ReturnType<typeof vi.fn>).mockImplementation((_auth, cb) => {
      cb(mockUser);
      return () => {};
    });
    const { user } = await import('./auth');
    expect(get(user)).toEqual(mockUser);
  });
});
