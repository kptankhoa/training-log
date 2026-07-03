import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { toasts, showError, dismissToast } from './toast';

describe('toast store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Drain any toasts left over from a previous test's timers.
    get(toasts).forEach((t) => dismissToast(t.id));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts empty', () => {
    expect(get(toasts)).toEqual([]);
  });

  it('showError adds a message with a default wording', () => {
    showError();
    expect(get(toasts)).toHaveLength(1);
    expect(get(toasts)[0].message).toMatch(/failed to save/i);
  });

  it('showError accepts a custom message', () => {
    showError('Could not delete photo.');
    expect(get(toasts)[0].message).toBe('Could not delete photo.');
  });

  it('multiple toasts stack in order', () => {
    showError('First');
    showError('Second');
    expect(get(toasts).map((t) => t.message)).toEqual(['First', 'Second']);
  });

  it('dismissToast removes only the given toast', () => {
    showError('First');
    showError('Second');
    const [first] = get(toasts);
    dismissToast(first.id);
    expect(get(toasts).map((t) => t.message)).toEqual(['Second']);
  });

  it('auto-dismisses after 5 seconds', () => {
    showError('Goes away');
    expect(get(toasts)).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(get(toasts)).toHaveLength(0);
  });
});
