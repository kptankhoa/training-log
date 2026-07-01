import { storage } from '$lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export async function uploadPhoto(userId: string, dateKey: string, file: File): Promise<string> {
  const path = `users/${userId}/days/${dateKey}/${Date.now()}-${file.name}`;
  await uploadBytes(ref(storage, path), file);
  return path;
}

export async function getPhotoUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}

export async function deletePhoto(path: string): Promise<void> {
  await deleteObject(ref(storage, path));
}
