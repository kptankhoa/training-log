import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import RestTimer from './RestTimer.svelte';

describe('RestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the default 60s duration formatted as 01:00', () => {
    const { getByText } = render(RestTimer);
    expect(getByText('01:00')).toBeInTheDocument();
  });

  it('selecting a preset updates the displayed duration', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('90s'));
    expect(getByText('01:30')).toBeInTheDocument();
  });

  it('counts down once started', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    expect(getByText('Pause')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(3000);
    expect(getByText('00:57')).toBeInTheDocument();
  });

  it('pausing freezes the countdown and shows Resume', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(3000);
    await fireEvent.click(getByText('Pause'));
    expect(getByText('Resume')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(5000);
    expect(getByText('00:57')).toBeInTheDocument(); // unchanged while paused
  });

  it('shows "Go!" once the countdown reaches zero', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getByText('Go!')).toBeInTheDocument();
  });

  it('reset clears the countdown back to the input duration', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(3000);
    await fireEvent.click(getByText('Reset'));
    expect(getByText('Start')).toBeInTheDocument();
    expect(getByText('01:00')).toBeInTheDocument();
  });

  it('disables preset buttons while the timer is running', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    expect(getByText('90s')).toBeDisabled();
  });

  it('shows the ring/time in green before the halfway point', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(29_000);
    expect(getByText('00:31').className).toContain('text-gb-green');
  });

  it('turns the ring/time orange once remaining time reaches the halfway point', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(getByText('00:30').className).toContain('text-gb-orange');
  });

  it('tapping the ring starts the timer', async () => {
    const { getByLabelText, getByText } = render(RestTimer);
    await fireEvent.click(getByLabelText('Start rest timer'));
    expect(getByText('Pause')).toBeInTheDocument();
  });

  it('tapping the ring while running pauses the timer', async () => {
    const { getByLabelText, getByText } = render(RestTimer);
    await fireEvent.click(getByLabelText('Start rest timer'));
    await fireEvent.click(getByLabelText('Pause rest timer'));
    expect(getByText('Resume')).toBeInTheDocument();
  });
});

// The ring's sweep plays via the Web Animations API (element.animate()),
// deliberately decoupled from the once-a-second JS tick — these tests guard
// against reintroducing per-tick retargeting, which is what let main-thread
// jank make the ring visibly skip (the original bug report), and against
// reverting to a CSS-transition-based approach, which proved intermittent
// even after several attempts at reliably (re)triggering it from JS.
describe('RestTimer ring sweep', () => {
  const C = 2 * Math.PI * 54;

  function getProgressCircle(container: HTMLElement): SVGCircleElement {
    return container.querySelectorAll('circle')[1] as SVGCircleElement;
  }

  let animateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    animateSpy = vi.spyOn(Element.prototype, 'animate');
  });

  afterEach(() => {
    vi.useRealTimers();
    animateSpy.mockRestore();
  });

  function lastAnimateCall() {
    const calls = animateSpy.mock.calls;
    return calls[calls.length - 1];
  }

  it('plays a keyframe animation to "empty" over the full remaining time on start', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));

    const [keyframes, options] = lastAnimateCall();
    expect(keyframes).toEqual([{ strokeDashoffset: 0 }, { strokeDashoffset: C }]);
    expect(options).toMatchObject({ duration: 60_000, easing: 'linear', fill: 'forwards' });
  });

  it('does not retarget the ring on every tick — only the digital text changes per second', async () => {
    const { getByText, container } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    const circle = getProgressCircle(container);
    const initialOffset = circle.getAttribute('stroke-dashoffset');
    const callsBefore = animateSpy.mock.calls.length;

    await vi.advanceTimersByTimeAsync(5000);

    expect(getByText('00:55')).toBeInTheDocument(); // text updated
    expect(circle.getAttribute('stroke-dashoffset')).toBe(initialOffset); // ring target untouched
    expect(animateSpy.mock.calls.length).toBe(callsBefore); // no new animation kicked off
  });

  it('freezes the ring instantly at the correct position on pause, cancelling the running animation', async () => {
    const { getByText, container } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(20_000); // 40s left of a 60s run
    const runningAnimation = animateSpy.mock.results[animateSpy.mock.results.length - 1].value;
    const cancelSpy = vi.spyOn(runningAnimation, 'cancel');

    await fireEvent.click(getByText('Pause'));

    expect(cancelSpy).toHaveBeenCalled();
    const circle = getProgressCircle(container);
    expect(Number(circle.getAttribute('stroke-dashoffset'))).toBeCloseTo(C * (1 - 40 / 60), 5);
  });

  it('resumes with a duration matching only what remains, not the original total', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(20_000);
    await fireEvent.click(getByText('Pause'));
    await fireEvent.click(getByText('Resume'));

    const [, options] = lastAnimateCall();
    expect(options).toMatchObject({ duration: 40_000 });
  });

  it('resets the ring to full with an animated refill, not an instant snap', async () => {
    const { getByText, container } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(5000);
    await fireEvent.click(getByText('Reset'));

    const [keyframes, options] = lastAnimateCall();
    expect(keyframes[1]).toEqual({ strokeDashoffset: 0 });
    expect(options).toMatchObject({ duration: 500, easing: 'linear', fill: 'forwards' });
    expect(Number(getProgressCircle(container).getAttribute('stroke-dashoffset'))).toBe(0);
  });

  it('animates the ring back to a full red circle once time is up', async () => {
    const { getByText, container } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(getByText('Go!')).toBeInTheDocument();
    const [keyframes, options] = lastAnimateCall();
    expect(keyframes[1]).toEqual({ strokeDashoffset: 0 });
    expect(options).toMatchObject({ duration: 500, easing: 'linear', fill: 'forwards' });
    expect(Number(getProgressCircle(container).getAttribute('stroke-dashoffset'))).toBe(0);
  });
});

describe('RestTimer finish sound', () => {
  let playSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    playSpy.mockRestore();
  });

  it('plays the rest timer sound once the countdown finishes', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(getByText('Go!')).toBeInTheDocument();
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('does not play a sound before the countdown finishes', async () => {
    const { getByText } = render(RestTimer);
    await fireEvent.click(getByText('Start'));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(playSpy).not.toHaveBeenCalled();
  });
});
