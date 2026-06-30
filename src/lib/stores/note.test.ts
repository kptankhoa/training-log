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

describe('note store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty string', async () => {
    const { globalNote } = await import('./note');
    expect(get(globalNote)).toBe('');
  });

  it('populates from Firestore when doc exists', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, data: () => ({ globalNote: '## June Program' }) });
      return () => {};
    });
    const { globalNote, initNote } = await import('./note');
    initNote('user1');
    expect(get(globalNote)).toBe('## June Program');
  });

  it('stays empty when Firestore doc does not exist', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => false });
      return () => {};
    });
    const { globalNote, initNote } = await import('./note');
    initNote('user1');
    expect(get(globalNote)).toBe('');
  });

  it('saveNote calls setDoc with merge', async () => {
    mockOnSnapshot.mockImplementation((_r, cb) => { cb({ exists: () => false }); return () => {}; });
    const { saveNote } = await import('./note');
    await saveNote('user1', '## My Note');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { globalNote: '## My Note' },
      { merge: true }
    );
  });
});
