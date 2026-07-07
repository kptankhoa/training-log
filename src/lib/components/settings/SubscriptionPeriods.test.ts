import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SubscriptionPeriods from './SubscriptionPeriods.svelte';
import type { TrainingTag } from '$lib/types';

const mockUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/stores/tags', () => ({
  updateTagSubscriptionPeriods: (...args: unknown[]) => mockUpdate(...args),
}));

function baseTag(overrides: Partial<TrainingTag> = {}): TrainingTag {
  return { id: 'tag1', name: 'Boxing', color: 'red', deleted: false, ...overrides };
}

describe('SubscriptionPeriods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing periods with their start and end dates', () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31' }] });
    const { getByDisplayValue } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    expect(getByDisplayValue('2026-01-01')).toBeInTheDocument();
    expect(getByDisplayValue('2026-03-31')).toBeInTheDocument();
  });

  it('adding a period with only a start date calls the store with endDate and note entirely absent (not undefined)', async () => {
    const tag = baseTag({ subscriptionPeriods: [] });
    const { getByLabelText, getByText } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.input(getByLabelText('Start'), { target: { value: '2026-07-01' } });
    await fireEvent.click(getByText('Add period'));
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const savedPeriods = mockUpdate.mock.calls[0][2];
    expect(savedPeriods).toEqual([{ startDate: '2026-07-01' }]);
    expect('endDate' in savedPeriods[0]).toBe(false);
    expect('note' in savedPeriods[0]).toBe(false);
  });

  it('adding a period with an end date and note includes both', async () => {
    const tag = baseTag({ subscriptionPeriods: [] });
    const { getByLabelText, getByText } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.input(getByLabelText('Start'), { target: { value: '2026-07-01' } });
    await fireEvent.input(getByLabelText('End (optional)'), { target: { value: '2026-08-01' } });
    await fireEvent.input(getByLabelText('Note (optional)'), { target: { value: "Gold's Gym" } });
    await fireEvent.click(getByText('Add period'));
    expect(mockUpdate).toHaveBeenCalledWith('user1', 'tag1', [
      { startDate: '2026-07-01', endDate: '2026-08-01', note: "Gold's Gym" },
    ]);
  });

  it('does not add a period when the start date is blank', async () => {
    const tag = baseTag({ subscriptionPeriods: [] });
    const { getByText } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.click(getByText('Add period'));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not save when an existing period's start date is cleared", async () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31' }] });
    const { getByDisplayValue } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.change(getByDisplayValue('2026-01-01'), { target: { value: '' } });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("editing an existing period's end date calls the store with the new value and clears dismissed", async () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31', dismissed: true }] });
    const { getByDisplayValue } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.change(getByDisplayValue('2026-03-31'), { target: { value: '2026-04-30' } });
    expect(mockUpdate).toHaveBeenCalledWith('user1', 'tag1', [
      { startDate: '2026-01-01', endDate: '2026-04-30', dismissed: false },
    ]);
  });

  it("clearing an existing period's end date removes the key entirely rather than setting it to undefined", async () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31' }] });
    const { getByDisplayValue } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.change(getByDisplayValue('2026-03-31'), { target: { value: '' } });
    const savedPeriods = mockUpdate.mock.calls[0][2];
    expect('endDate' in savedPeriods[0]).toBe(false);
  });

  it('clicking delete twice removes the period', async () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31' }] });
    const { getByLabelText } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.click(getByLabelText('Delete period'));
    await fireEvent.click(getByLabelText('Confirm delete period'));
    expect(mockUpdate).toHaveBeenCalledWith('user1', 'tag1', []);
  });

  it('a single click on delete does not remove the period yet', async () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31' }] });
    const { getByLabelText } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.click(getByLabelText('Delete period'));
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
