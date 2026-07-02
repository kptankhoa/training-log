import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockCollection = vi.fn(() => ({}));
const mockDoc = vi.fn(() => ({}));

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
}));

describe('splits store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty array', async () => {
    const { splits } = await import('./splits');
    expect(get(splits)).toEqual([]);
  });

  it('initSplits populates store sorted by sortOrder', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        docs: [
          { id: 'b', data: () => ({ label: 'B', sortOrder: 2, content: 'bbb', color: 'red' }) },
          { id: 'a', data: () => ({ label: 'A', sortOrder: 1, content: 'aaa', color: 'blue' }) },
        ],
      });
      return () => {};
    });
    const { splits, initSplits } = await import('./splits');
    initSplits('user1');
    const result = get(splits);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });

  it('initSplits returns unsubscribe function', async () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const { initSplits } = await import('./splits');
    const returned = initSplits('user1');
    expect(returned).toBe(unsub);
  });

  it('addSplit calls addDoc with next sortOrder and cycled color', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ docs: [] });
      return () => {};
    });
    mockAddDoc.mockResolvedValue({ id: 'new1' });
    const { addSplit, initSplits } = await import('./splits');
    initSplits('user1');
    await addSplit('user1');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        label: 'New split',
        sortOrder: 1,
        content: '',
        color: expect.any(String),
      })
    );
  });

  it('addSplit uses maxSortOrder + 1 when splits exist', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        docs: [
          { id: 'n1', data: () => ({ label: 'A', sortOrder: 5, content: '', color: 'blue' }) },
        ],
      });
      return () => {};
    });
    mockAddDoc.mockResolvedValue({ id: 'new2' });
    const { addSplit, initSplits } = await import('./splits');
    initSplits('user1');
    await addSplit('user1');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sortOrder: 6 })
    );
  });

  it('saveSplit calls updateDoc with provided data', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    const { saveSplit } = await import('./splits');
    await saveSplit('user1', 'split123', { label: 'Push day', sortOrder: 1, content: '## Push', color: 'red' });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { label: 'Push day', sortOrder: 1, content: '## Push', color: 'red' }
    );
  });

  it('deleteSplit calls deleteDoc with correct ref', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    const { deleteSplit } = await import('./splits');
    await deleteSplit('user1', 'split456');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'notes', 'split456');
  });
});
