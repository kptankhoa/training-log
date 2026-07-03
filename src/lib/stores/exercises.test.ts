import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn(() => ({}));
const mockCollection = vi.fn(() => ({}));

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  onSnapshot: mockOnSnapshot,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  doc: mockDoc,
}));

describe('exercises store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty array', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { exercises } = await import('./exercises');
    expect(get(exercises)).toEqual([]);
  });

  it('populates exercises from Firestore snapshot', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ docs: [{ id: 'ex1', data: () => ({ name: 'Bench Press', deleted: false }) }] });
      return () => {};
    });
    const { exercises, initExercises } = await import('./exercises');
    initExercises('user1');
    expect(get(exercises)).toEqual([{ id: 'ex1', name: 'Bench Press', deleted: false }]);
  });

  it('activeExercises excludes deleted exercises', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        docs: [
          { id: 'ex1', data: () => ({ name: 'Bench Press', deleted: false }) },
          { id: 'ex2', data: () => ({ name: 'Old Move', deleted: true }) },
        ],
      });
      return () => {};
    });
    const { activeExercises, initExercises } = await import('./exercises');
    initExercises('user1');
    expect(get(activeExercises).length).toBe(1);
    expect(get(activeExercises)[0].name).toBe('Bench Press');
  });

  it('addExercise calls addDoc with deleted: false and returns the new id', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    mockAddDoc.mockResolvedValue({ id: 'new-ex-id' });
    const { addExercise } = await import('./exercises');
    const id = await addExercise('user1', 'Bench Press');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), { name: 'Bench Press', deleted: false });
    expect(id).toBe('new-ex-id');
  });

  it('deleteExercise calls updateDoc with deleted: true', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { deleteExercise } = await import('./exercises');
    await deleteExercise('user1', 'ex1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { deleted: true });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'exercises', 'ex1');
  });

  it('updateExerciseSplits calls updateDoc with the new splitIds', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateExerciseSplits } = await import('./exercises');
    await updateExerciseSplits('user1', 'ex1', ['split1', 'split2']);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { splitIds: ['split1', 'split2'] });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'exercises', 'ex1');
  });

  it('updateExerciseType calls updateDoc with the new type', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateExerciseType } = await import('./exercises');
    await updateExerciseType('user1', 'ex1', 'bodyweight');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { type: 'bodyweight' });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'exercises', 'ex1');
  });

  it('updateExerciseEquipment calls updateDoc with the new equipment', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateExerciseEquipment } = await import('./exercises');
    await updateExerciseEquipment('user1', 'ex1', 'dumbbell');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { equipment: 'dumbbell' });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'exercises', 'ex1');
  });

  it('updateExerciseEquipment clears equipment when passed null', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateExerciseEquipment } = await import('./exercises');
    await updateExerciseEquipment('user1', 'ex1', null);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { equipment: null });
  });

  it('updateExerciseSingleArm calls updateDoc with the new flag', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateExerciseSingleArm } = await import('./exercises');
    await updateExerciseSingleArm('user1', 'ex1', true);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { singleArm: true });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'exercises', 'ex1');
  });
});
