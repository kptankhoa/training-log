import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayModal from './DayModal.svelte';
import DayModalTest from './DayModalTest.svelte';
import type { TrainingTag, DayEntry } from '$lib/types';

vi.mock('$lib/stores/days', () => ({ saveDay: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/tags', () => ({ addTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock('marked', () => ({ marked: (s: string) => s }));

const activeTags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
  { id: 'tag2', name: 'Boxing', color: 'red', deleted: false },
];
const entry: DayEntry = { tags: ['tag1'], label: 'Leg day', note: '# PR' };

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
});
