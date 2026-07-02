import type { Action } from 'svelte/action';

const INITIAL_DELAY = 400;
const REPEAT_INTERVAL = 80;

// Fires `callback` on click, and repeatedly while the pointer is held down
// (after an initial delay) — for +/- steppers where users want to hold
// instead of tapping repeatedly.
export const holdRepeat: Action<HTMLElement, () => void> = (node, callback) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let heldByPointer = false;

  function clear() {
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    heldByPointer = true;
    callback();
    timeoutId = setTimeout(() => {
      intervalId = setInterval(callback, REPEAT_INTERVAL);
    }, INITIAL_DELAY);
  }

  function handlePointerUp() {
    clear();
  }

  function handleClick() {
    // A click always trails a pointerdown-driven press — skip it since that
    // press already fired the callback (possibly repeatedly). Keyboard
    // activation (Enter/Space) has no pointerdown, so it falls through here.
    if (heldByPointer) { heldByPointer = false; return; }
    callback();
  }

  node.addEventListener('pointerdown', handlePointerDown);
  node.addEventListener('pointerup', handlePointerUp);
  node.addEventListener('pointerleave', handlePointerUp);
  node.addEventListener('pointercancel', handlePointerUp);
  node.addEventListener('click', handleClick);

  return {
    update(newCallback: () => void) {
      callback = newCallback;
    },
    destroy() {
      clear();
      node.removeEventListener('pointerdown', handlePointerDown);
      node.removeEventListener('pointerup', handlePointerUp);
      node.removeEventListener('pointerleave', handlePointerUp);
      node.removeEventListener('pointercancel', handlePointerUp);
      node.removeEventListener('click', handleClick);
    }
  };
};
