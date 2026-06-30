import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Calendar from './Calendar.svelte';
import CalendarTest from './CalendarTest.svelte';
import type { TrainingTag, DayEntry } from '$lib/types';

const tags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
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
});
