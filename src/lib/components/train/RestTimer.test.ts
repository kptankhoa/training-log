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
});
