import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Calendar from './Calendar.svelte';
import CalendarTest from './CalendarTest.svelte';
import type { TrainingTag, DayEntry } from '$lib/types';

vi.mock('$lib/stores/theme', () => ({
  theme: { subscribe: (cb: (v: 'dark' | 'light') => void) => { cb('dark'); return () => {}; } }
}));

const tags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
  { id: 'tag2', name: 'Boxing', color: 'red', deleted: false },
];
const days: Record<string, DayEntry> = {
  '2026-06-10': { tags: ['tag1'], label: 'Leg day', note: '# PR' },
  '2026-06-15': { tags: [], label: '', note: 'Bodyweight: 74kg' },
};

describe('Calendar', () => {
  it('renders the month and year heading', () => {
    const { getByText } = render(Calendar, { props: { year: 2026, month: 6, days: {}, tags: [] } });
    expect(getByText(/june 2026/i)).toBeInTheDocument();
  });

  it('renders 30 day cells for June', () => {
    const { getAllByRole } = render(Calendar, { props: { year: 2026, month: 6, days: {}, tags: [] } });
    const dayButtons = getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent?.trim() ?? ''));
    expect(dayButtons.length).toBe(30);
  });

  it('emits selectDay with YYYY-MM-DD on day click', async () => {
    const { getAllByRole, getByTestId } = render(CalendarTest, {
      props: { year: 2026, month: 6, days: {}, tags: [] }
    });
    const btn = getAllByRole('button').find((b) => b.textContent?.trim() === '10');
    await fireEvent.click(btn!);
    expect(getByTestId('select-day-last').textContent).toBe('2026-06-10');
  });

  it('shows label text for a day that has one', () => {
    const { getByText } = render(Calendar, { props: { year: 2026, month: 6, days, tags } });
    expect(getByText('Leg day')).toBeInTheDocument();
  });

  it('shows note indicator for days with a non-empty note', () => {
    const { container } = render(Calendar, { props: { year: 2026, month: 6, days, tags } });
    const indicators = container.querySelectorAll('[data-has-note]');
    expect(indicators.length).toBe(2);
  });

  it('shows photo indicator only for days with at least one photo', () => {
    const withPhotos: Record<string, DayEntry> = {
      '2026-06-10': { tags: [], label: '', note: '', photos: ['users/u1/days/2026-06-10/a.jpg'] },
      '2026-06-11': { tags: [], label: '', note: '', photos: [] },
    };
    const { container } = render(Calendar, { props: { year: 2026, month: 6, days: withPhotos, tags: [] } });
    expect(container.querySelectorAll('[data-has-photos]').length).toBe(1);
  });

  it('emits prevMonth on left arrow click', async () => {
    const { getByLabelText, getByTestId } = render(CalendarTest, {
      props: { year: 2026, month: 6, days: {}, tags: [] }
    });
    await fireEvent.click(getByLabelText('Previous month'));
    expect(getByTestId('prev-month-count').textContent).toBe('1');
  });

  it('emits nextMonth on right arrow click', async () => {
    const { getByLabelText, getByTestId } = render(CalendarTest, {
      props: { year: 2026, month: 6, days: {}, tags: [] }
    });
    await fireEvent.click(getByLabelText('Next month'));
    expect(getByTestId('next-month-count').textContent).toBe('1');
  });

  it('shows trained count of 1 for a single day with tags', () => {
    const { getByText } = render(Calendar, { props: { year: 2026, month: 6, days, tags } });
    const label = getByText('day trained this month');
    expect(label.previousElementSibling?.textContent).toBe('1');
  });

  it('shows plural label when multiple days have tags', () => {
    const multiDays: Record<string, DayEntry> = {
      '2026-06-10': { tags: ['tag1'], label: '', note: '' },
      '2026-06-11': { tags: ['tag2'], label: '', note: '' },
    };
    const { getByText } = render(Calendar, { props: { year: 2026, month: 6, days: multiDays, tags } });
    const label = getByText('days trained this month');
    expect(label.previousElementSibling?.textContent).toBe('2');
  });

  it('shows tag legend with active tag names', () => {
    const { getByText } = render(Calendar, { props: { year: 2026, month: 6, days: {}, tags } });
    expect(getByText('Weight Lifting')).toBeInTheDocument();
    expect(getByText('Boxing')).toBeInTheDocument();
  });

  it('clicking a tag chip marks days with that tag and dims the rest', async () => {
    const multiDays: Record<string, DayEntry> = {
      '2026-06-10': { tags: ['tag1'], label: '', note: '' },
      '2026-06-11': { tags: ['tag2'], label: '', note: '' },
    };
    const { getByText, container } = render(Calendar, {
      props: { year: 2026, month: 6, days: multiDays, tags }
    });

    await fireEvent.click(getByText('Weight Lifting'));

    const day10 = getByText('10', { exact: true }).closest('button');
    const day11 = getByText('11', { exact: true }).closest('button');
    expect(day10?.hasAttribute('data-tag-match')).toBe(true);
    expect(day11?.hasAttribute('data-tag-match')).toBe(false);
    expect(day11?.className).toContain('opacity-30');
    expect(day10?.className).not.toContain('opacity-30');
    expect(container.querySelectorAll('[data-tag-match]').length).toBe(1);
  });

  it('clicking the same tag chip again clears the filter', async () => {
    const multiDays: Record<string, DayEntry> = {
      '2026-06-10': { tags: ['tag1'], label: '', note: '' },
      '2026-06-11': { tags: ['tag2'], label: '', note: '' },
    };
    const { getByText, container } = render(Calendar, {
      props: { year: 2026, month: 6, days: multiDays, tags }
    });

    const chip = getByText('Weight Lifting');
    await fireEvent.click(chip);
    await fireEvent.click(chip);

    expect(container.querySelectorAll('[data-tag-match]').length).toBe(0);
    expect(container.querySelectorAll('.opacity-30').length).toBe(0);
  });

  it('reflects the selected tag via aria-pressed on the legend chip', async () => {
    const { getByText } = render(Calendar, { props: { year: 2026, month: 6, days: {}, tags } });
    const chip = getByText('Weight Lifting');
    expect(chip.closest('button')).toHaveAttribute('aria-pressed', 'false');
    await fireEvent.click(chip);
    expect(chip.closest('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides deleted tags from legend', () => {
    const withDeleted: TrainingTag[] = [
      ...tags,
      { id: 'tag3', name: 'Old Sport', color: 'yellow', deleted: true },
    ];
    const { queryByText } = render(Calendar, { props: { year: 2026, month: 6, days: {}, tags: withDeleted } });
    expect(queryByText('Old Sport')).not.toBeInTheDocument();
  });

  it('shows split legend with labels and no count', () => {
    const splits = [
      { id: 'split1', label: 'Push Day', sortOrder: 1, content: '', color: 'blue' as const },
      { id: 'split2', label: 'Pull Day', sortOrder: 2, content: '', color: 'red' as const },
    ];
    const { getByText, queryByText } = render(Calendar, {
      props: { year: 2026, month: 6, days: {}, tags: [], splits }
    });
    expect(getByText('Push Day')).toBeInTheDocument();
    expect(getByText('Pull Day')).toBeInTheDocument();
    expect(queryByText(/\dx/)).not.toBeInTheDocument(); // no "Nx" count like the tag legend
  });

  it('renders a dot for each split selected on a day', () => {
    const splits = [{ id: 'split1', label: 'Push Day', sortOrder: 1, content: '', color: 'blue' as const }];
    const withSplit: Record<string, DayEntry> = {
      '2026-06-10': { tags: [], label: '', note: '', splitIds: ['split1'] },
      '2026-06-11': { tags: [], label: '', note: '' },
    };
    const { getByText } = render(Calendar, {
      props: { year: 2026, month: 6, days: withSplit, tags: [], splits }
    });
    const dayWithSplit = getByText('10', { exact: true }).closest('button');
    const dayWithoutSplit = getByText('11', { exact: true }).closest('button');
    expect(dayWithSplit?.querySelectorAll('span.rounded-full').length).toBeGreaterThan(0);
    expect(dayWithoutSplit?.querySelectorAll('span.rounded-full').length).toBe(0);
  });

  it('marks today with data-today and correct date number', () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const { container } = render(Calendar, { props: { year, month, days: {}, tags: [] } });
    const todayCell = container.querySelector('[data-today]');
    expect(todayCell).not.toBeNull();
    expect(todayCell?.querySelector('span')?.textContent?.trim()).toBe(String(day));
  });

  it('does not mark any cell as today when viewing a different month', () => {
    const { container } = render(Calendar, { props: { year: 2020, month: 1, days: {}, tags: [] } });
    expect(container.querySelector('[data-today]')).toBeNull();
  });

  it('emits nextMonth on a leftward swipe past the threshold', async () => {
    const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
    const grid = getByTestId('calendar-grid');
    await fireEvent.touchStart(grid, { touches: [{ clientX: 200, clientY: 100 }] });
    await fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 100, clientY: 100 }] });
    expect(getByTestId('next-month-count').textContent).toBe('1');
  });

  it('emits prevMonth on a rightward swipe past the threshold', async () => {
    const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
    const grid = getByTestId('calendar-grid');
    await fireEvent.touchStart(grid, { touches: [{ clientX: 100, clientY: 100 }] });
    await fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 200, clientY: 100 }] });
    expect(getByTestId('prev-month-count').textContent).toBe('1');
  });

  it('does not switch months on a short swipe below the threshold', async () => {
    const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
    const grid = getByTestId('calendar-grid');
    await fireEvent.touchStart(grid, { touches: [{ clientX: 100, clientY: 100 }] });
    await fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 120, clientY: 100 }] });
    expect(getByTestId('next-month-count').textContent).toBe('0');
    expect(getByTestId('prev-month-count').textContent).toBe('0');
  });

  it('does not switch months on a mostly-vertical swipe', async () => {
    const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
    const grid = getByTestId('calendar-grid');
    await fireEvent.touchStart(grid, { touches: [{ clientX: 100, clientY: 100 }] });
    await fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 160, clientY: 250 }] });
    expect(getByTestId('next-month-count').textContent).toBe('0');
    expect(getByTestId('prev-month-count').textContent).toBe('0');
  });
});
