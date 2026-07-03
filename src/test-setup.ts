import '@testing-library/jest-dom';

// jsdom doesn't implement the Web Animations API, which Svelte's built-in
// transitions (e.g. `slide`) use — stub it out so components using them
// don't crash in tests.
if (!Element.prototype.animate) {
  Element.prototype.animate = function () {
    return {
      finished: Promise.resolve(),
      cancel() {},
      play() {},
      pause() {},
      addEventListener() {},
      removeEventListener() {},
    } as unknown as Animation;
  };
}

// jsdom doesn't implement HTMLMediaElement playback (calling .play() logs a
// "Not implemented" error to the console) — stub it so the rest timer's
// finish sound doesn't spam test output.
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
}

// jsdom localStorage polyfill for vitest
if (!globalThis.localStorage) {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      Object.keys(store).forEach(key => delete store[key]);
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}
