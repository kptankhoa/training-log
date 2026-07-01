import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn(() => ({}));
const mockCollection = vi.fn(() => ({}));

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
}));

describe('days store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty object', async () => {
    const { allDays } = await import('./days');
    expect(get(allDays)).toEqual({});
  });

  it('populates allDays from Firestore snapshot', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ docs: [{ id: '2026-06-10', data: () => ({ tags: ['tag1'], label: 'Leg day', note: '# PR' }) }] });
      return () => {};
    });
    const { allDays, initDays } = await import('./days');
    initDays('user1');
    expect(get(allDays)['2026-06-10']).toEqual({ tags: ['tag1'], label: 'Leg day', note: '# PR' });
  });

  it('keeps every month in allDays, unfiltered', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        docs: [
          { id: '2026-06-10', data: () => ({ tags: ['tag1'], label: '', note: '' }) },
          { id: '2026-05-20', data: () => ({ tags: ['tag2'], label: '', note: '' }) },
        ],
      });
      return () => {};
    });
    const { allDays, initDays } = await import('./days');
    initDays('user1');
    expect(Object.keys(get(allDays)).sort()).toEqual(['2026-05-20', '2026-06-10']);
  });

  it('filterDaysByMonth returns only entries matching the given year/month', async () => {
    const { filterDaysByMonth } = await import('./days');
    const all = {
      '2026-06-10': { tags: ['tag1'], label: '', note: '' },
      '2026-05-20': { tags: ['tag2'], label: '', note: '' },
    };
    expect(Object.keys(filterDaysByMonth(all, 2026, 6))).toEqual(['2026-06-10']);
  });

  it('saveDay calls setDoc with correct path and data', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { saveDay } = await import('./days');
    const entry = { tags: ['tag1'], label: 'Push day', note: '' };
    await saveDay('user1', '2026-06-10', entry);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), entry, { merge: true });
  });
});
