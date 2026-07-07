import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn(() => ({}));
const mockCollection = vi.fn(() => ({}));
const mockQuery = vi.fn((ref) => ref);

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('$lib/theme', () => ({
  nextColor: vi.fn(() => 'red'),
  COLOR_ORDER: ['red', 'green', 'yellow', 'blue', 'purple', 'aqua', 'orange'],
}));
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  onSnapshot: mockOnSnapshot,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  doc: mockDoc,
  query: mockQuery,
}));

describe('tags store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty array', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { tags } = await import('./tags');
    expect(get(tags)).toEqual([]);
  });

  it('populates tags from Firestore snapshot', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => {
      cb({ docs: [{ id: 'tag1', data: () => ({ name: 'Weight Lifting', color: 'blue', deleted: false }) }] });
      return () => {};
    });
    const { tags, initTags } = await import('./tags');
    initTags('user1');
    expect(get(tags)).toEqual([{ id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false }]);
  });

  it('activeTags excludes deleted tags', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => {
      cb({
        docs: [
          { id: 'tag1', data: () => ({ name: 'Boxing', color: 'red', deleted: false }) },
          { id: 'tag2', data: () => ({ name: 'Old', color: 'gray', deleted: true }) },
        ]
      });
      return () => {};
    });
    const { activeTags, initTags } = await import('./tags');
    initTags('user1');
    expect(get(activeTags).length).toBe(1);
    expect(get(activeTags)[0].name).toBe('Boxing');
  });

  it('addTag calls addDoc with auto-assigned color', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { addTag } = await import('./tags');
    await addTag('user1', 'Boxing');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Boxing', color: 'red', deleted: false })
    );
  });

  it('deleteTag calls updateDoc with deleted: true', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { deleteTag } = await import('./tags');
    await deleteTag('user1', 'tag1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { deleted: true });
  });

  it('updateTagColor calls updateDoc with new color', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateTagColor } = await import('./tags');
    await updateTagColor('user1', 'tag1', 'purple');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { color: 'purple' });
  });

  it('updateTagSubscriptionPeriods calls updateDoc with the given periods array', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateTagSubscriptionPeriods } = await import('./tags');
    const periods = [{ startDate: '2026-01-01', endDate: '2026-03-31' }];
    await updateTagSubscriptionPeriods('user1', 'tag1', periods);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { subscriptionPeriods: periods });
  });
});
