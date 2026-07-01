import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import DayModal from './DayModal.svelte';
import DayModalTest from './DayModalTest.svelte';
import type { TrainingTag, DayEntry } from '$lib/types';

vi.mock('$lib/stores/days', () => ({ saveDay: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/tags', () => ({ addTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/photos', () => ({
  uploadPhoto: vi.fn().mockResolvedValue('users/user1/days/2026-06-10/photo.jpg'),
  getPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
  deletePhoto: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('marked', () => ({ marked: (s: string) => s }));

const activeTags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
];
const entry: DayEntry = { tags: ['tag1'], label: 'Leg day', note: '# PR' };

describe('DayModal', () => {
  it('renders a formatted date heading', () => {
    const { getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText(/june 10.*2026/i)).toBeInTheDocument();
  });

  it('renders DayDetail content inside the sheet', () => {
    const { getByText, getByDisplayValue } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText('Weight Lifting')).toBeInTheDocument();
    expect(getByDisplayValue('Leg day')).toBeInTheDocument();
  });

  it('emits close when X button clicked', async () => {
    const { getByLabelText, getByTestId } = render(DayModalTest, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByLabelText('Close'));
    expect(getByTestId('close-count').textContent).toBe('1');
  });

  it('emits close on Escape key', async () => {
    const { getByTestId } = render(DayModalTest, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(getByTestId('close-count').textContent).toBe('1');
  });

  it('emits close on backdrop click', async () => {
    const { getByRole, getByTestId } = render(DayModalTest, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByRole('dialog'));
    expect(getByTestId('close-count').textContent).toBe('1');
  });

  it('emits close ~450ms after DayDetail reports a successful save', async () => {
    const { getByText, getByTestId } = render(DayModalTest, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByText('Save'));
    expect(getByTestId('close-count').textContent).toBe('0');
    await waitFor(() => {
      expect(Number(getByTestId('close-count').textContent)).toBeGreaterThanOrEqual(1);
    });
  });
});
