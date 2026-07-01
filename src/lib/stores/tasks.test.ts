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

describe('tasks store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty array', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { tasks } = await import('./tasks');
    expect(get(tasks)).toEqual([]);
  });

  it('populates tasks from Firestore snapshot', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ docs: [{ id: 'task1', data: () => ({ name: 'Stretch', deleted: false }) }] });
      return () => {};
    });
    const { tasks, initTasks } = await import('./tasks');
    initTasks('user1');
    expect(get(tasks)).toEqual([{ id: 'task1', name: 'Stretch', deleted: false }]);
  });

  it('activeTasks excludes deleted tasks', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        docs: [
          { id: 'task1', data: () => ({ name: 'Drink water', deleted: false }) },
          { id: 'task2', data: () => ({ name: 'Old task', deleted: true }) },
        ],
      });
      return () => {};
    });
    const { activeTasks, initTasks } = await import('./tasks');
    initTasks('user1');
    expect(get(activeTasks).length).toBe(1);
    expect(get(activeTasks)[0].name).toBe('Drink water');
  });

  it('addTask calls addDoc with deleted: false', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { addTask } = await import('./tasks');
    await addTask('user1', 'Stretch');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      { name: 'Stretch', deleted: false }
    );
  });

  it('deleteTask calls updateDoc with deleted: true', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { deleteTask } = await import('./tasks');
    await deleteTask('user1', 'task1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { deleted: true });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'tasks', 'task1');
  });
});
