import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { holdRepeat } from './holdRepeat';

function pointerDown(node: HTMLElement) {
  node.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', button: 0 }));
}
function pointerUp(node: HTMLElement) {
  node.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse', button: 0 }));
}

describe('holdRepeat action', () => {
  let node: HTMLButtonElement;
  let callCount: number;
  let callback: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    node = document.createElement('button');
    callCount = 0;
    callback = () => { callCount++; };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once immediately on pointerdown', () => {
    holdRepeat(node, callback);
    pointerDown(node);
    expect(callCount).toBe(1);
  });

  it('repeats while held past the initial delay', () => {
    holdRepeat(node, callback);
    pointerDown(node);
    vi.advanceTimersByTime(400); // initial delay elapses, interval starts
    expect(callCount).toBe(1);
    vi.advanceTimersByTime(80);
    expect(callCount).toBe(2);
    vi.advanceTimersByTime(80 * 3);
    expect(callCount).toBe(5);
  });

  it('stops repeating on pointerup', () => {
    holdRepeat(node, callback);
    pointerDown(node);
    vi.advanceTimersByTime(480); // one interval tick fired
    expect(callCount).toBe(2);
    pointerUp(node);
    vi.advanceTimersByTime(1000);
    expect(callCount).toBe(2);
  });

  it('does not double-fire on the click that trails a pointer press', () => {
    holdRepeat(node, callback);
    pointerDown(node);
    pointerUp(node);
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callCount).toBe(1);
  });

  it('still fires on a plain click (keyboard activation, no pointerdown)', () => {
    holdRepeat(node, callback);
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callCount).toBe(1);
  });

  it('destroy clears pending timers and listeners', () => {
    const action = holdRepeat(node, callback);
    pointerDown(node);
    action?.destroy?.();
    vi.advanceTimersByTime(1000);
    expect(callCount).toBe(1);
  });
});
