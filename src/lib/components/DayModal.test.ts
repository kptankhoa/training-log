import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayModal from './DayModal.svelte';
import DayModalTest from './DayModalTest.svelte';
import type { TrainingTag, DailyTask, DayEntry } from '$lib/types';

vi.mock('$lib/stores/days', () => ({ saveDay: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/tags', () => ({ addTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock('marked', () => ({ marked: (s: string) => s }));

const activeTags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
  { id: 'tag2', name: 'Boxing', color: 'red', deleted: false },
];
const activeTasks: DailyTask[] = [
  { id: 'task1', name: 'Stretch', deleted: false },
  { id: 'task2', name: 'Drink water', deleted: false },
];
const entry: DayEntry = { tags: ['tag1'], label: 'Leg day', note: '# PR', tasks: ['task1'] };

describe('DayModal', () => {
  it('renders a formatted date heading', () => {
    const { getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText(/june 10.*2026/i)).toBeInTheDocument();
  });

  it('renders all active tag chips', () => {
    const { getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText('Weight Lifting')).toBeInTheDocument();
    expect(getByText('Boxing')).toBeInTheDocument();
  });

  it('pre-fills the label field', () => {
    const { getByDisplayValue } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByDisplayValue('Leg day')).toBeInTheDocument();
  });

  it('calls saveDay with correct args on Save click', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByText('Save'));
    expect(saveDay).toHaveBeenCalledWith('user1', '2026-06-10', expect.objectContaining({ label: 'Leg day' }));
  });

  it('emits close after save', async () => {
    const { getByText, getByTestId } = render(DayModalTest, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByText('Save'));
    // saveDay resolves — verify close event was emitted
    const count = getByTestId('close-count');
    expect(Number(count.textContent)).toBeGreaterThanOrEqual(1);
  });

  it('emits close when X button clicked', async () => {
    const { getByLabelText, getByTestId } = render(DayModalTest, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByLabelText('Close'));
    const count = getByTestId('close-count');
    expect(Number(count.textContent)).toBe(1);
  });

  it('does not render a Daily tasks section when there are no active tasks', () => {
    const { queryByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(queryByText('Daily tasks')).not.toBeInTheDocument();
  });

  it('renders a checkbox per active task, pre-checked from entry.tasks', () => {
    const { getByLabelText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, activeTasks, userId: 'user1' }
    });
    expect(getByLabelText('Stretch')).toBeChecked();
    expect(getByLabelText('Drink water')).not.toBeChecked();
  });

  it('toggles a task checkbox on click', async () => {
    const { getByLabelText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, activeTasks, userId: 'user1' }
    });
    const checkbox = getByLabelText('Drink water');
    await fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('includes completed task ids in saveDay call', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByLabelText, getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, activeTasks, userId: 'user1' }
    });
    await fireEvent.click(getByLabelText('Drink water'));
    await fireEvent.click(getByText('Save'));
    expect(saveDay).toHaveBeenCalledWith(
      'user1',
      '2026-06-10',
      expect.objectContaining({ tasks: expect.arrayContaining(['task1', 'task2']) })
    );
  });
});
