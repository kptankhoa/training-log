import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockCollection = vi.fn(() => ({}));
const mockDoc = vi.fn(() => ({}));

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
}));

describe('bodyMeasurements store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty array', async () => {
    const { bodyMeasurements } = await import('./bodyMeasurements');
    expect(get(bodyMeasurements)).toEqual([]);
  });

  it('initBodyMeasurements populates store sorted by date key ascending', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        docs: [
          { id: '2026-01-01', data: () => ({ chest: 100, waist: 80 }) },
          { id: '2023-11-26', data: () => ({ chest: 95 }) },
        ],
      });
      return () => {};
    });
    const { bodyMeasurements, initBodyMeasurements } = await import('./bodyMeasurements');
    initBodyMeasurements('user1');
    const result = get(bodyMeasurements);
    expect(result.map((r) => r.id)).toEqual(['2023-11-26', '2026-01-01']);
  });

  it('keeps only the fields present in the Firestore doc (no defaulting to 0)', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ docs: [{ id: '2026-06-10', data: () => ({ chest: 100 }) }] });
      return () => {};
    });
    const { bodyMeasurements, initBodyMeasurements } = await import('./bodyMeasurements');
    initBodyMeasurements('user1');
    const [entry] = get(bodyMeasurements);
    expect(entry).toEqual({ id: '2026-06-10', chest: 100 });
    expect(entry.waist).toBeUndefined();
  });

  it('saveBodyMeasurement calls setDoc with the partial payload and merge:true', async () => {
    const { saveBodyMeasurement } = await import('./bodyMeasurements');
    await saveBodyMeasurement('user1', '2026-06-23', { chest: 101, waist: 82 });
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { chest: 101, waist: 82 }, { merge: true });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'measurements', '2026-06-23');
  });

  it('deleteBodyMeasurement calls deleteDoc with correct ref', async () => {
    const { deleteBodyMeasurement } = await import('./bodyMeasurements');
    await deleteBodyMeasurement('user1', '2026-06-23');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'measurements', '2026-06-23');
  });
});
