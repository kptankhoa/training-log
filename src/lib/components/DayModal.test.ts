import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import DayModal from './DayModal.svelte';
import DayModalTest from './DayModalTest.svelte';
import type { TrainingTag, DailyTask, DayEntry } from '$lib/types';

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
    // saveDay resolves, then a brief "Saved" state shows before close fires
    await waitFor(() => {
      expect(Number(getByTestId('close-count').textContent)).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows a Saving then Saved state before closing', async () => {
    const { saveDay } = await import('$lib/stores/days');
    let resolveSave = () => {};
    (saveDay as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveSave = resolve; })
    );

    const { getByText, getByTestId } = render(DayModalTest, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });

    await fireEvent.click(getByText('Save'));
    expect(getByText('Saving…')).toBeInTheDocument();

    resolveSave();
    await waitFor(() => expect(getByText('✓ Saved')).toBeInTheDocument());
    await waitFor(() => {
      expect(Number(getByTestId('close-count').textContent)).toBeGreaterThanOrEqual(1);
    });
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

  it('renders existing photos as thumbnails', async () => {
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { findByAltText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1' }
    });
    expect(await findByAltText('Training day snapshot')).toBeInTheDocument();
  });

  it('uploads a selected file and shows a thumbnail', async () => {
    const { uploadPhoto, getPhotoUrl } = await import('$lib/stores/photos');
    const { getByTestId, findByAltText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });

    const fileInput = getByTestId('photo-file-input');
    const file = new File(['fake'], 'progress.jpg', { type: 'image/jpeg' });
    await fireEvent.change(fileInput, { target: { files: [file] } });

    expect(uploadPhoto).toHaveBeenCalledWith('user1', '2026-06-10', file);
    expect(getPhotoUrl).toHaveBeenCalled();
    expect(await findByAltText('Training day snapshot')).toBeInTheDocument();
  });

  it('a single click on the remove button arms confirmation without removing', async () => {
    const { findByAltText, getByLabelText, queryByAltText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry: { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] }, activeTags, userId: 'user1' }
    });

    await findByAltText('Training day snapshot');
    await fireEvent.click(getByLabelText('Remove photo'));

    expect(queryByAltText('Training day snapshot')).toBeInTheDocument();
    expect(getByLabelText('Confirm remove photo')).toBeInTheDocument();
  });

  it('removing a photo (after confirm) does not call deletePhoto until Save', async () => {
    const { deletePhoto } = await import('$lib/stores/photos');
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { getByLabelText, findByAltText, queryByAltText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1' }
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
    const { getByLabelText, getByText, findByAltText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1' }
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
    const { findByAltText, getAllByRole, getByLabelText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1' }
    });
    const thumbnail = await findByAltText('Training day snapshot');
    await fireEvent.click(thumbnail.closest('button')!);
    // DayModal's own dialog plus the newly-opened lightbox dialog
    expect(getAllByRole('dialog')).toHaveLength(2);
    expect(getByLabelText('Close photo')).toBeInTheDocument();
  });

  it('closes the lightbox via its own close button without closing the modal', async () => {
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { findByAltText, getByLabelText, queryByLabelText, getByTestId } = render(DayModalTest, {
      props: { dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1' }
    });
    const thumbnail = await findByAltText('Training day snapshot');
    await fireEvent.click(thumbnail.closest('button')!);
    expect(getByLabelText('Close photo')).toBeInTheDocument();

    await fireEvent.click(getByLabelText('Close photo'));
    expect(queryByLabelText('Close photo')).not.toBeInTheDocument();
    expect(getByTestId('close-count').textContent).toBe('0');
  });

  it('hides other sections (mobile only) while the note is empty and in edit mode', () => {
    const emptyNoteEntry: DayEntry = { ...entry, note: '' };
    const { getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry: emptyNoteEntry, activeTags, activeTasks, userId: 'user1' }
    });
    const trainingTypesSection = getByText('Training types').closest('div');
    const labelSection = getByText('Label').closest('div');
    const photosSection = getByText('Progress photos').closest('div');
    expect(trainingTypesSection?.className).toContain('hidden');
    expect(labelSection?.className).toContain('hidden');
    expect(photosSection?.className).toContain('hidden');
  });

  it('shows other sections when the note is not in edit mode', () => {
    const { getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, activeTasks, userId: 'user1' }
    });
    const trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).not.toContain('hidden');
  });

  it('reveals other sections again after switching the note out of edit mode', async () => {
    const emptyNoteEntry: DayEntry = { ...entry, note: '' };
    const { getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry: emptyNoteEntry, activeTags, activeTasks, userId: 'user1' }
    });
    let trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).toContain('hidden');

    await fireEvent.click(getByText('Preview'));

    trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).not.toContain('hidden');
  });
});
