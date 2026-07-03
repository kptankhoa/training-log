import { writable } from 'svelte/store';

export interface ToastMessage {
  id: number;
  message: string;
}

const DISMISS_AFTER_MS = 5000;

let nextId = 0;
const _toasts = writable<ToastMessage[]>([]);
export const toasts = { subscribe: _toasts.subscribe };

// A generic message covers the common case (Firestore write failed, most
// likely because the device is offline) without needing every call site to
// come up with its own wording for what is nearly always the same cause.
export function showError(message = 'Failed to save — check your connection.'): void {
  const id = nextId++;
  _toasts.update((list) => [...list, { id, message }]);
  setTimeout(() => dismissToast(id), DISMISS_AFTER_MS);
}

export function dismissToast(id: number): void {
  _toasts.update((list) => list.filter((t) => t.id !== id));
}
