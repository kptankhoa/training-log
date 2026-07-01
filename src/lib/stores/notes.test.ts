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

describe('notes store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty array', async () => {
    const { notes } = await import('./notes');
    expect(get(notes)).toEqual([]);
  });

  it('initNotes populates store sorted by sortOrder', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        docs: [
          { id: 'b', data: () => ({ label: 'B', sortOrder: 2, content: 'bbb', color: 'red' }) },
          { id: 'a', data: () => ({ label: 'A', sortOrder: 1, content: 'aaa', color: 'blue' }) },
        ],
      });
      return () => {};
    });
    const { notes, initNotes } = await import('./notes');
    initNotes('user1');
    const result = get(notes);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });

  it('initNotes returns unsubscribe function', async () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const { initNotes } = await import('./notes');
    const returned = initNotes('user1');
    expect(returned).toBe(unsub);
  });

  it('addNote calls addDoc with next sortOrder and cycled color', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ docs: [] });
      return () => {};
    });
    mockAddDoc.mockResolvedValue({ id: 'new1' });
    const { addNote, initNotes } = await import('./notes');
    initNotes('user1');
    await addNote('user1');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        label: 'New note',
        sortOrder: 1,
        content: '',
        color: expect.any(String),
      })
    );
  });

  it('addNote uses maxSortOrder + 1 when notes exist', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        docs: [
          { id: 'n1', data: () => ({ label: 'A', sortOrder: 5, content: '', color: 'blue' }) },
        ],
      });
      return () => {};
    });
    mockAddDoc.mockResolvedValue({ id: 'new2' });
    const { addNote, initNotes } = await import('./notes');
    initNotes('user1');
    await addNote('user1');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sortOrder: 6 })
    );
  });

  it('saveNote calls updateDoc with provided data', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    const { saveNote } = await import('./notes');
    await saveNote('user1', 'note123', { label: 'Push day', sortOrder: 1, content: '## Push', color: 'red' });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { label: 'Push day', sortOrder: 1, content: '## Push', color: 'red' }
    );
  });

  it('deleteNote calls deleteDoc with correct ref', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    const { deleteNote } = await import('./notes');
    await deleteNote('user1', 'note456');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'notes', 'note456');
  });
});
