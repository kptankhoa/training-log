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

describe('measurements store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty array', async () => {
    const { measurements } = await import('./measurements');
    expect(get(measurements)).toEqual([]);
  });

  it('initMeasurements populates store sorted by date key ascending', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        docs: [
          { id: '2026-01-01', data: () => ({ weight: 80, muscleMass: 36, fatMass: 16, bfp: 20, score: 80 }) },
          { id: '2023-11-26', data: () => ({ weight: 74.7, muscleMass: 33.4, fatMass: 15.6, bfp: 20.9, score: 79 }) },
        ],
      });
      return () => {};
    });
    const { measurements, initMeasurements } = await import('./measurements');
    initMeasurements('user1');
    const result = get(measurements);
    expect(result.map((r) => r.id)).toEqual(['2023-11-26', '2026-01-01']);
  });

  it('saveMeasurement calls setDoc with merge', async () => {
    const { saveMeasurement } = await import('./measurements');
    await saveMeasurement('user1', '2026-06-23', { weight: 80.5, muscleMass: 36.7, fatMass: 16.5, bfp: 20.5, score: 83 });
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { weight: 80.5, muscleMass: 36.7, fatMass: 16.5, bfp: 20.5, score: 83 },
      { merge: true }
    );
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'metrics', '2026-06-23');
  });

  it('deleteMeasurement calls deleteDoc with correct ref', async () => {
    const { deleteMeasurement } = await import('./measurements');
    await deleteMeasurement('user1', '2026-06-23');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'metrics', '2026-06-23');
  });
});
