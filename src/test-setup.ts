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
