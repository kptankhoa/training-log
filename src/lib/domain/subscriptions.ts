import type { TrainingTag, SubscriptionPeriod, GruvboxColor } from '$lib/types';

export function getLatestPeriod(periods: SubscriptionPeriod[]): SubscriptionPeriod | null {
  if (periods.length === 0) return null;
  return periods.reduce((latest, p) => (p.startDate > latest.startDate ? p : latest));
}

export interface ExpiringSubscription {
  tag: TrainingTag;
  period: SubscriptionPeriod;
  daysRemaining: number; // negative = already past the end date
}

export function getExpiringSoon(tags: TrainingTag[], now: Date = new Date()): ExpiringSubscription[] {
  const todayKey = toDateKey(now);
  const result: ExpiringSubscription[] = [];
  for (const tag of tags) {
    if (tag.deleted) continue;
    const latest = getLatestPeriod(tag.subscriptionPeriods ?? []);
    if (!latest?.endDate || latest.dismissed) continue;
    const daysRemaining = daysBetween(todayKey, latest.endDate);
    if (daysRemaining < 5) result.push({ tag, period: latest, daysRemaining });
  }
  return result;
}

export function getEndingColorsByDate(tags: TrainingTag[]): Record<string, GruvboxColor[]> {
  const map: Record<string, GruvboxColor[]> = {};
  for (const tag of tags) {
    if (tag.deleted) continue;
    const latest = getLatestPeriod(tag.subscriptionPeriods ?? []);
    if (latest?.endDate) (map[latest.endDate] ??= []).push(tag.color);
  }
  return map;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(fromKey + 'T00:00:00');
  const to = new Date(toKey + 'T00:00:00');
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
