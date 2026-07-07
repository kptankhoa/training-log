import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SubscriptionReminders from './SubscriptionReminders.svelte';
import type { TrainingTag } from '$lib/types';

const mockUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/stores/tags', () => ({
  updateTagSubscriptionPeriods: (...args: unknown[]) => mockUpdate(...args),
}));
vi.mock('$lib/stores/theme', () => ({
  theme: { subscribe: (cb: (v: 'dark' | 'light') => void) => { cb('dark'); return () => {}; } }
}));

function tag(overrides: Partial<TrainingTag> = {}): TrainingTag {
  return { id: 'tag1', name: 'Boxing', color: 'red', deleted: false, ...overrides };
}

describe('SubscriptionReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-07T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a banner for a tag expiring within 5 days', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-10' }] })];
    const { getByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(getByText('Boxing ends in 3 days')).toBeInTheDocument();
  });

  it('does not render a banner for a tag with 5 or more days remaining', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-12' }] })];
    const { queryByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(queryByText(/Boxing/)).not.toBeInTheDocument();
  });

  it('does not render a banner for an ongoing period with no end date', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01' }] })];
    const { queryByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(queryByText(/Boxing/)).not.toBeInTheDocument();
  });

  it('shows "ends today" for a period ending today', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-07' }] })];
    const { getByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(getByText('Boxing ends today')).toBeInTheDocument();
  });

  it('shows "ended N days ago" for an already-expired period', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-06-01', endDate: '2026-07-05' }] })];
    const { getByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(getByText('Boxing ended 2 days ago')).toBeInTheDocument();
  });

  it('shows the period note in parentheses when present', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-10', note: "Gold's Gym, $50/mo" }] })];
    const { getByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(getByText("(Gold's Gym, $50/mo)")).toBeInTheDocument();
  });

  it('renders one banner per expiring tag when multiple are expiring', () => {
    const tags = [
      tag({ id: 'tag1', name: 'Boxing', subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-10' }] }),
      tag({ id: 'tag2', name: 'Weights', color: 'blue', subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-09' }] }),
    ];
    const { getByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(getByText('Boxing ends in 3 days')).toBeInTheDocument();
    expect(getByText('Weights ends in 2 days')).toBeInTheDocument();
  });

  it('clicking Dismiss calls the store with dismissed: true on that period', async () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-10' }] })];
    const { getByLabelText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    await fireEvent.click(getByLabelText('Dismiss Boxing reminder'));
    expect(mockUpdate).toHaveBeenCalledWith('user1', 'tag1', [
      { startDate: '2026-07-01', endDate: '2026-07-10', dismissed: true },
    ]);
  });
});
