import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();
const mockGetMetadata = vi.fn();
const mockDeleteObject = vi.fn();
const mockRef = vi.fn((_storage, path: string) => ({ path }));

vi.mock('$lib/firebase', () => ({ storage: {} }));
vi.mock('firebase/storage', () => ({
  ref: mockRef,
  uploadBytes: mockUploadBytes,
  getDownloadURL: mockGetDownloadURL,
  getMetadata: mockGetMetadata,
  deleteObject: mockDeleteObject,
}));

describe('photos store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploadPhoto writes to a path scoped to user and date, returns the path', async () => {
    mockUploadBytes.mockResolvedValue(undefined);
    const { uploadPhoto } = await import('./photos');
    const file = new File(['fake'], 'progress.jpg', { type: 'image/jpeg' });
    const path = await uploadPhoto('user1', '2026-06-10', file);

    expect(path).toMatch(/^users\/user1\/days\/2026-06-10\/\d+-progress\.jpg$/);
    expect(mockRef).toHaveBeenCalledWith(expect.anything(), path);
    expect(mockUploadBytes).toHaveBeenCalledWith({ path }, file);
  });

  it('getPhotoUrl resolves a download URL for a path', async () => {
    mockGetDownloadURL.mockResolvedValue('https://example.com/photo.jpg');
    const { getPhotoUrl } = await import('./photos');
    const url = await getPhotoUrl('users/user1/days/2026-06-10/photo.jpg');

    expect(mockRef).toHaveBeenCalledWith(expect.anything(), 'users/user1/days/2026-06-10/photo.jpg');
    expect(url).toBe('https://example.com/photo.jpg');
  });

  it('getPhotoSize resolves the byte size from Storage metadata', async () => {
    mockGetMetadata.mockResolvedValue({ size: 2048 });
    const { getPhotoSize } = await import('./photos');
    const size = await getPhotoSize('users/user1/days/2026-06-10/photo.jpg');

    expect(mockRef).toHaveBeenCalledWith(expect.anything(), 'users/user1/days/2026-06-10/photo.jpg');
    expect(size).toBe(2048);
  });

  it('deletePhoto removes the object at the given path', async () => {
    mockDeleteObject.mockResolvedValue(undefined);
    const { deletePhoto } = await import('./photos');
    await deletePhoto('users/user1/days/2026-06-10/photo.jpg');

    expect(mockRef).toHaveBeenCalledWith(expect.anything(), 'users/user1/days/2026-06-10/photo.jpg');
    expect(mockDeleteObject).toHaveBeenCalledWith({ path: 'users/user1/days/2026-06-10/photo.jpg' });
  });
});
