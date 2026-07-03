import { app } from '$lib/firebase';

// firebase/storage is only needed on the day-detail/photo-timeline screens,
// so it's loaded on first actual use instead of being in every route's
// initial bundle. A dynamic import of an already-loaded module resolves
// from the module cache, so calling this on every function is cheap.
async function storageModule() {
  const mod = await import('firebase/storage');
  return { ...mod, storage: mod.getStorage(app) };
}

export async function uploadPhoto(userId: string, dateKey: string, file: File): Promise<string> {
  const { ref, uploadBytes, storage } = await storageModule();
  const path = `users/${userId}/days/${dateKey}/${Date.now()}-${file.name}`;
  await uploadBytes(ref(storage, path), file);
  return path;
}

export async function getPhotoUrl(path: string): Promise<string> {
  const { ref, getDownloadURL, storage } = await storageModule();
  return getDownloadURL(ref(storage, path));
}

export async function getPhotoSize(path: string): Promise<number> {
  const { ref, getMetadata, storage } = await storageModule();
  const metadata = await getMetadata(ref(storage, path));
  return metadata.size;
}

export async function deletePhoto(path: string): Promise<void> {
  const { ref, deleteObject, storage } = await storageModule();
  await deleteObject(ref(storage, path));
}
