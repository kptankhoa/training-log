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

describe('generalRules store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty string', async () => {
    const { generalRules } = await import('./generalRules');
    expect(get(generalRules)).toBe('');
  });

  it('populates from Firestore when the doc exists', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, data: () => ({ content: '## Warm up before every session' }) });
      return () => {};
    });
    const { generalRules, initGeneralRules } = await import('./generalRules');
    initGeneralRules('user1');
    expect(get(generalRules)).toBe('## Warm up before every session');
  });

  it('stays empty when the Firestore doc does not exist', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => false });
      return () => {};
    });
    const { generalRules, initGeneralRules } = await import('./generalRules');
    initGeneralRules('user1');
    expect(get(generalRules)).toBe('');
  });

  it('saveGeneralRules calls setDoc with merge', async () => {
    mockOnSnapshot.mockImplementation((_r, cb) => { cb({ exists: () => false }); return () => {}; });
    const { saveGeneralRules } = await import('./generalRules');
    await saveGeneralRules('user1', '## Rules');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { content: '## Rules' },
      { merge: true }
    );
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'meta', 'generalRules');
  });
});
