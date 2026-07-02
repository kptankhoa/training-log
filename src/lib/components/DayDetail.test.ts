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

describe('DayDetail — view mode (default when the day already has content)', () => {
  it('shows an Edit button instead of the form', () => {
    const { getByText, queryByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText('Edit')).toBeInTheDocument();
    expect(queryByText('Save')).not.toBeInTheDocument();
  });

  it('shows only the selected tags, not every active tag', () => {
    const { getByText, queryByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText('Weight Lifting')).toBeInTheDocument();
    expect(queryByText('Boxing')).not.toBeInTheDocument();
  });

  it('shows the label as text', () => {
    const { getByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText('Leg day')).toBeInTheDocument();
  });

  it('shows daily tasks with completed state, read-only', () => {
    const { getByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, activeTasks, userId: 'user1' }
    });
    expect(getByText('Stretch').textContent).toContain('Stretch');
    // task1 (Stretch) is completed, task2 (Drink water) is not
    const stretchRow = getByText('Stretch').closest('span');
    const waterRow = getByText('Drink water').closest('span');
    expect(stretchRow?.textContent).toContain('✓');
    expect(waterRow?.textContent).toContain('○');
  });

  it('renders the note as markdown', () => {
    const { getByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText('# PR')).toBeInTheDocument();
  });

  it('shows existing photos as thumbnails', async () => {
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { findByAltText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1' }
    });
    expect(await findByAltText('Training day snapshot')).toBeInTheDocument();
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

describe('DayDetail — edit mode (default when the day is empty)', () => {
  it('shows the form immediately, no Edit button needed', () => {
    const { getByText, getByPlaceholderText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry: emptyEntry, activeTags, userId: 'user1' }
    });
    expect(getByPlaceholderText('Short label shown on calendar')).toBeInTheDocument();
    expect(getByText('Save')).toBeInTheDocument();
  });
});

describe('DayDetail — editing behavior', () => {
  async function renderInEditMode(props: ComponentProps<DayDetail>) {
    const utils = render(DayDetail, { props });
    await fireEvent.click(utils.getByText('Edit'));
    return utils;
  }

  it('renders all active tag chips (not just selected ones)', async () => {
    const { getByText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, userId: 'user1' });
    expect(getByText('Weight Lifting')).toBeInTheDocument();
    expect(getByText('Boxing')).toBeInTheDocument();
  });

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

  it('does not render a Daily tasks section when there are no active tasks', async () => {
    const { queryByText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, userId: 'user1' });
    expect(queryByText('Daily tasks')).not.toBeInTheDocument();
  });

  it('renders a checkbox per active task, pre-checked from entry.tasks', async () => {
    const { getByLabelText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, activeTasks, userId: 'user1' });
    expect(getByLabelText('Stretch')).toBeChecked();
    expect(getByLabelText('Drink water')).not.toBeChecked();
  });

  it('toggles a task checkbox on click', async () => {
    const { getByLabelText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, activeTasks, userId: 'user1' });
    const checkbox = getByLabelText('Drink water');
    await fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
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

  it('uploads a selected file and shows a thumbnail', async () => {
    const { uploadPhoto, getPhotoUrl } = await import('$lib/stores/photos');
    const { getByTestId, findByAltText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, userId: 'user1' });

    const fileInput = getByTestId('photo-file-input');
    const file = new File(['fake'], 'progress.jpg', { type: 'image/jpeg' });
    await fireEvent.change(fileInput, { target: { files: [file] } });

    expect(uploadPhoto).toHaveBeenCalledWith('user1', '2026-06-10', file);
    expect(getPhotoUrl).toHaveBeenCalled();
    expect(await findByAltText('Training day snapshot')).toBeInTheDocument();
  });

  it('a single click on the remove button arms confirmation without removing', async () => {
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { findByAltText, getByLabelText, queryByAltText } = await renderInEditMode({
      dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1'
    });

    await findByAltText('Training day snapshot');
    await fireEvent.click(getByLabelText('Remove photo'));

    expect(queryByAltText('Training day snapshot')).toBeInTheDocument();
    expect(getByLabelText('Confirm remove photo')).toBeInTheDocument();
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

  it('opens a lightbox with the full photo on thumbnail click', async () => {
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { findByAltText, getByRole, getByLabelText } = await renderInEditMode({
      dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1'
    });
    const thumbnail = await findByAltText('Training day snapshot');
    await fireEvent.click(thumbnail.closest('button')!);
    expect(getByRole('dialog')).toBeInTheDocument();
    expect(getByLabelText('Close photo')).toBeInTheDocument();
  });

  it('closes the lightbox via its own close button', async () => {
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { findByAltText, getByLabelText, queryByLabelText } = await renderInEditMode({
      dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1'
    });
    const thumbnail = await findByAltText('Training day snapshot');
    await fireEvent.click(thumbnail.closest('button')!);
    expect(getByLabelText('Close photo')).toBeInTheDocument();

    await fireEvent.click(getByLabelText('Close photo'));
    expect(queryByLabelText('Close photo')).not.toBeInTheDocument();
  });

  it('hides other sections (mobile only) while the note is in edit mode', async () => {
    const emptyNoteEntry: DayEntry = { ...entry, note: '' };
    const { getByText } = await renderInEditMode({ dateKey: '2026-06-10', entry: emptyNoteEntry, activeTags, activeTasks, userId: 'user1' });
    const trainingTypesSection = getByText('Training types').closest('div');
    const labelSection = getByText('Label').closest('div');
    const photosSection = getByText('Progress photos').closest('div');
    expect(trainingTypesSection?.className).toContain('hidden');
    expect(labelSection?.className).toContain('hidden');
    expect(photosSection?.className).toContain('hidden');
  });

  it('does not hide other sections when hideOtherSectionsWhileEditingNote is false', async () => {
    const emptyNoteEntry: DayEntry = { ...entry, note: '' };
    const { getByText } = await renderInEditMode({
      dateKey: '2026-06-10', entry: emptyNoteEntry, activeTags, activeTasks, userId: 'user1',
      hideOtherSectionsWhileEditingNote: false
    });
    const trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).not.toContain('hidden');
  });

  it('shows other sections once the note is switched out of edit mode', async () => {
    // startEdit always opens the note in edit mode, so switch to Preview first
    const { getByText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, activeTasks, userId: 'user1' });
    await fireEvent.click(getByText('Preview'));
    const trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).not.toContain('hidden');
  });

  it('reveals other sections again after switching the note out of edit mode', async () => {
    const emptyNoteEntry: DayEntry = { ...entry, note: '' };
    const { getByText } = await renderInEditMode({ dateKey: '2026-06-10', entry: emptyNoteEntry, activeTags, activeTasks, userId: 'user1' });
    let trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).toContain('hidden');

    await fireEvent.click(getByText('Preview'));

    trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).not.toContain('hidden');
  });
});

describe('DayDetail — exercises integration', () => {
  it('shows logged exercises with sets in view mode', () => {
    const withExercises: DayEntry = {
      ...entry,
      exercises: [{ exerciseId: 'bench', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 6 }] }]
    };
    const { getByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry: withExercises, activeTags, exercises, userId: 'user1' }
    });
    expect(getByText('Bench Press')).toBeInTheDocument();
    expect(getByText(/80×8, 80×6/)).toBeInTheDocument();
  });

  it('renders the exercise editor in edit mode', async () => {
    const { getByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, exercises, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    await fireEvent.click(getByText('Splits & Exercises'));
    expect(getByText('+ Bench Press')).toBeInTheDocument();
  });

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
});

describe('DayDetail — splits', () => {
  it('shows selected splits in view mode', () => {
    const withSplit: DayEntry = { ...entry, splitIds: ['push'] };
    const { getByText, queryByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry: withSplit, activeTags, splits, userId: 'user1' }
    });
    expect(getByText('Push Day')).toBeInTheDocument();
    expect(queryByText('Pull Day')).not.toBeInTheDocument();
  });

  it('toggling a split chip in edit mode selects it', async () => {
    const { getByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, splits, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    await fireEvent.click(getByText('Splits & Exercises'));
    const pushChip = getByText('Push Day');
    await fireEvent.click(pushChip);
    expect(pushChip.className).toContain('border-gb-green');
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

  it('picking a split narrows the exercise picker in ExerciseEditor', async () => {
    const tiedExercises = [
      { id: 'bench', name: 'Bench Press', deleted: false, splitIds: ['push'] },
      { id: 'row', name: 'Row', deleted: false, splitIds: ['pull'] },
    ];
    const { getByText, queryByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, exercises: tiedExercises, splits, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    await fireEvent.click(getByText('Splits & Exercises'));
    expect(getByText('+ Bench Press')).toBeInTheDocument();
    expect(getByText('+ Row')).toBeInTheDocument();

    await fireEvent.click(getByText('Push Day'));

    expect(getByText('+ Bench Press')).toBeInTheDocument();
    expect(queryByText('+ Row')).not.toBeInTheDocument();
  });
});
