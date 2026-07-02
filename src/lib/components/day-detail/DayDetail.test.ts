import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import DayDetail from './DayDetail.svelte';
import DayDetailTest from './DayDetailTest.svelte';
import type { TrainingTag, DailyTask, DayEntry } from '$lib/types';

vi.mock('$lib/stores/days', () => ({ saveDay: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/tags', () => ({ addTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/photos', () => ({
  uploadPhoto: vi.fn().mockResolvedValue('users/user1/days/2026-06-10/photo.jpg'),
  getPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
  deletePhoto: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('$lib/stores/exercises', () => ({
  addExercise: vi.fn().mockResolvedValue('new-ex-id'),
}));
vi.mock('marked', () => ({ marked: (s: string) => s }));

const activeTags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
  { id: 'tag2', name: 'Boxing', color: 'red', deleted: false },
];
const activeTasks: DailyTask[] = [
  { id: 'task1', name: 'Stretch', deleted: false },
  { id: 'task2', name: 'Drink water', deleted: false },
];
const exercises = [
  { id: 'bench', name: 'Bench Press', deleted: false },
];
const splits = [
  { id: 'push', label: 'Push Day', sortOrder: 1, content: '', color: 'blue' as const },
  { id: 'pull', label: 'Pull Day', sortOrder: 2, content: '', color: 'red' as const },
];
const entry: DayEntry = { tags: ['tag1'], label: 'Leg day', note: '# PR', tasks: ['task1'] };
const emptyEntry: DayEntry = { tags: [], label: '', note: '' };

describe('DayDetail — mode', () => {
  it('defaults to view mode with an Edit button when the day already has content', () => {
    const { getByText, queryByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText('Edit')).toBeInTheDocument();
    expect(queryByText('Save')).not.toBeInTheDocument();
    expect(getByText('Leg day')).toBeInTheDocument();
  });

  it('defaults to edit mode, no Edit button needed, when the day is empty', () => {
    const { getByText, getByPlaceholderText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry: emptyEntry, activeTags, userId: 'user1' }
    });
    expect(getByPlaceholderText('Short label shown on calendar')).toBeInTheDocument();
    expect(getByText('Save')).toBeInTheDocument();
  });

  it('clicking Edit switches to the editable form', async () => {
    const { getByText, getByDisplayValue } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    expect(getByDisplayValue('Leg day')).toBeInTheDocument();
    expect(getByText('Save')).toBeInTheDocument();
  });

  it('clicking Edit opens the note editor in edit mode even though it has content', async () => {
    // entry.note is non-empty, so MarkdownEditor would normally default to preview
    const { getByText, getByPlaceholderText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    expect(getByPlaceholderText('Bodyweight, PRs, observations…')).toBeInTheDocument();
    expect(getByText('Preview')).toBeInTheDocument(); // toggle button confirms we're in edit mode
  });
});

describe('DayDetail — save/cancel orchestration', () => {
  async function renderInEditMode(props: ComponentProps<DayDetail>) {
    const utils = render(DayDetail, { props });
    await fireEvent.click(utils.getByText('Edit'));
    return utils;
  }

  it('calls saveDay with correct args on Save click', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, userId: 'user1' });
    await fireEvent.click(getByText('Save'));
    expect(saveDay).toHaveBeenCalledWith('user1', '2026-06-10', expect.objectContaining({ label: 'Leg day' }));
  });

  it('emits saved after save resolves', async () => {
    const utils = render(DayDetailTest, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(utils.getByText('Edit'));
    await fireEvent.click(utils.getByText('Save'));
    await waitFor(() => {
      expect(Number(utils.getByTestId('saved-count').textContent)).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows a Saving then Saved state, then returns to view mode', async () => {
    const { saveDay } = await import('$lib/stores/days');
    let resolveSave = () => {};
    (saveDay as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveSave = resolve; })
    );

    const { getByText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, userId: 'user1' });

    await fireEvent.click(getByText('Save'));
    expect(getByText('Saving…')).toBeInTheDocument();

    resolveSave();
    await waitFor(() => expect(getByText('✓ Saved')).toBeInTheDocument());
    await waitFor(() => expect(getByText('Edit')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('Cancel discards changes and returns to view mode', async () => {
    const { getByText, getByDisplayValue, queryByText } = await renderInEditMode({
      dateKey: '2026-06-10', entry, activeTags, userId: 'user1'
    });
    const labelInput = getByDisplayValue('Leg day');
    await fireEvent.input(labelInput, { target: { value: 'Changed label' } });
    await fireEvent.click(getByText('Cancel'));

    expect(getByText('Edit')).toBeInTheDocument();
    expect(getByText('Leg day')).toBeInTheDocument();
    expect(queryByText('Changed label')).not.toBeInTheDocument();
  });

  it('includes completed task ids in saveDay call', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByLabelText, getByText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, activeTasks, userId: 'user1' });
    await fireEvent.click(getByLabelText('Drink water'));
    await fireEvent.click(getByText('Save'));
    expect(saveDay).toHaveBeenCalledWith(
      'user1',
      '2026-06-10',
      expect.objectContaining({ tasks: expect.arrayContaining(['task1', 'task2']) })
    );
  });

  it('removing a photo (after confirm) does not call deletePhoto until Save', async () => {
    const { deletePhoto } = await import('$lib/stores/photos');
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { getByLabelText, findByAltText, queryByAltText } = await renderInEditMode({
      dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1'
    });

    await findByAltText('Training day snapshot');
    await fireEvent.click(getByLabelText('Remove photo'));
    await fireEvent.click(getByLabelText('Confirm remove photo'));

    expect(queryByAltText('Training day snapshot')).not.toBeInTheDocument();
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it('deletes confirmed-removed photos and saves remaining paths on Save', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { deletePhoto } = await import('$lib/stores/photos');
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { getByLabelText, getByText, findByAltText } = await renderInEditMode({
      dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1'
    });

    await findByAltText('Training day snapshot');
    await fireEvent.click(getByLabelText('Remove photo'));
    await fireEvent.click(getByLabelText('Confirm remove photo'));
    await fireEvent.click(getByText('Save'));

    expect(saveDay).toHaveBeenCalledWith(
      'user1',
      '2026-06-10',
      expect.objectContaining({ photos: [] })
    );
    await waitFor(() => {
      expect(deletePhoto).toHaveBeenCalledWith('users/user1/days/2026-06-10/existing.jpg');
    });
  });
});

describe('DayDetail — exercises and splits integration', () => {
  it('includes logged exercises in the saveDay call', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, exercises, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    await fireEvent.click(getByText('Splits & Exercises'));
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Log Set'));
    await fireEvent.click(getByText('Save'));

    expect(saveDay).toHaveBeenCalledWith(
      'user1',
      '2026-06-10',
      expect.objectContaining({
        exercises: [{ exerciseId: 'bench', sets: [{ weight: 20, reps: 8 }] }]
      })
    );
  });

  it('Cancel discards exercise changes made during the edit session', async () => {
    const { getByText, queryByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, exercises, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    await fireEvent.click(getByText('Splits & Exercises'));
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Cancel'));

    expect(queryByText('Bench Press')).not.toBeInTheDocument();
  });

  it('includes selected splitIds in the saveDay call', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, splits, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    await fireEvent.click(getByText('Splits & Exercises'));
    await fireEvent.click(getByText('Push Day'));
    await fireEvent.click(getByText('Save'));

    expect(saveDay).toHaveBeenCalledWith(
      'user1',
      '2026-06-10',
      expect.objectContaining({ splitIds: ['push'] })
    );
  });
});
