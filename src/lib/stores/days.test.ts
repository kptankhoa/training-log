import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn(() => ({}));
const mockCollection = vi.fn(() => ({}));
const mockQuery = vi.fn((ref) => ref);
const mockWhere = vi.fn();
const mockDocumentId = vi.fn(() => '__name__');

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  query: mockQuery,
  where: mockWhere,
  documentId: mockDocumentId,
}));

describe('days store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty object', async () => {
    const { days } = await import('./days');
    expect(get(days)).toEqual({});
  });

  it('populates days from Firestore snapshot', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => {
      cb({ docs: [{ id: '2026-06-10', data: () => ({ tags: ['tag1'], label: 'Leg day', note: '# PR' }) }] });
      return () => {};
    });
    const { days, initDays } = await import('./days');
    initDays('user1', 2026, 6);
    expect(get(days)['2026-06-10']).toEqual({ tags: ['tag1'], label: 'Leg day', note: '# PR' });
  });

  it('filters days to the requested month, but allDays keeps every month', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => {
      cb({
        docs: [
          { id: '2026-06-10', data: () => ({ tags: ['tag1'], label: '', note: '' }) },
          { id: '2026-05-20', data: () => ({ tags: ['tag2'], label: '', note: '' }) },
        ],
      });
      return () => {};
    });
    const { days, allDays, initDays } = await import('./days');
    initDays('user1', 2026, 6);
    expect(Object.keys(get(days))).toEqual(['2026-06-10']);
    expect(Object.keys(get(allDays)).sort()).toEqual(['2026-05-20', '2026-06-10']);
  });

  it('saveDay calls setDoc with correct path and data', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { saveDay } = await import('./days');
    const entry = { tags: ['tag1'], label: 'Push day', note: '' };
    await saveDay('user1', '2026-06-10', entry);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), entry, { merge: true });
  });
});
