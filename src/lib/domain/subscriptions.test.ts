import { describe, it, expect } from 'vitest';
import { getLatestPeriod, getExpiringSoon, getEndingColorsByDate } from './subscriptions';
import type { TrainingTag } from '$lib/types';

describe('getLatestPeriod', () => {
  it('returns null for an empty array', () => {
    expect(getLatestPeriod([])).toBeNull();
  });

  it('returns the only period when there is one', () => {
    const period = { startDate: '2026-01-01' };
    expect(getLatestPeriod([period])).toBe(period);
  });

  it('returns the period with the greatest startDate among several, regardless of array order', () => {
    const older = { startDate: '2026-01-01', endDate: '2026-03-31' };
    const newer = { startDate: '2026-04-01' };
    expect(getLatestPeriod([older, newer])).toBe(newer);
    expect(getLatestPeriod([newer, older])).toBe(newer);
  });
});

function tag(overrides: Partial<TrainingTag> = {}): TrainingTag {
  return { id: 'tag1', name: 'Boxing', color: 'red', deleted: false, ...overrides };
}

describe('getExpiringSoon', () => {
  const now = new Date('2026-07-07T12:00:00');

  it('excludes a tag with no subscriptionPeriods', () => {
    expect(getExpiringSoon([tag()], now)).toEqual([]);
  });

  it('excludes an ongoing period with no endDate', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-07-01' }] });
    expect(getExpiringSoon([t], now)).toEqual([]);
  });

  it('excludes a period ending 5 or more days from now', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-12' }] });
    expect(getExpiringSoon([t], now)).toEqual([]);
  });

  it('includes a period ending exactly 4 days from now', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-11' }] });
    const result = getExpiringSoon([t], now);
    expect(result).toEqual([{ tag: t, period: t.subscriptionPeriods![0], daysRemaining: 4 }]);
  });

  it('includes a period ending today with daysRemaining 0', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-07' }] });
    expect(getExpiringSoon([t], now)[0].daysRemaining).toBe(0);
  });

  it('includes an already-expired period with a negative daysRemaining', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-06-01', endDate: '2026-07-05' }] });
    expect(getExpiringSoon([t], now)[0].daysRemaining).toBe(-2);
  });

  it('excludes a dismissed period even if ending soon', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-08', dismissed: true }] });
    expect(getExpiringSoon([t], now)).toEqual([]);
  });

  it('excludes a deleted tag', () => {
    const t = tag({ deleted: true, subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-08' }] });
    expect(getExpiringSoon([t], now)).toEqual([]);
  });

  it('only considers the latest period, ignoring an older ending-soon period', () => {
    const t = tag({
      subscriptionPeriods: [
        { startDate: '2026-01-01', endDate: '2026-07-08' }, // older; would be "expiring soon" alone
        { startDate: '2026-07-01' }, // latest, ongoing
      ],
    });
    expect(getExpiringSoon([t], now)).toEqual([]);
  });
});

describe('getEndingColorsByDate', () => {
  it("maps the latest period's endDate to the tag color", () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-07-15' }] });
    expect(getEndingColorsByDate([t])).toEqual({ '2026-07-15': ['red'] });
  });

  it('collects colors from multiple tags ending on the same date', () => {
    const t1 = tag({ id: 'tag1', color: 'red', subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-07-15' }] });
    const t2 = tag({ id: 'tag2', color: 'blue', subscriptionPeriods: [{ startDate: '2026-02-01', endDate: '2026-07-15' }] });
    expect(getEndingColorsByDate([t1, t2])).toEqual({ '2026-07-15': ['red', 'blue'] });
  });

  it("ignores a non-latest period's endDate", () => {
    const t = tag({
      subscriptionPeriods: [
        { startDate: '2026-01-01', endDate: '2026-03-31' },
        { startDate: '2026-04-01', endDate: '2026-09-30' },
      ],
    });
    expect(getEndingColorsByDate([t])).toEqual({ '2026-09-30': ['red'] });
  });

  it('excludes an ongoing latest period and a deleted tag', () => {
    const ongoing = tag({ id: 'tag1', subscriptionPeriods: [{ startDate: '2026-07-01' }] });
    const deleted = tag({ id: 'tag2', deleted: true, subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-07-15' }] });
    expect(getEndingColorsByDate([ongoing, deleted])).toEqual({});
  });
});
