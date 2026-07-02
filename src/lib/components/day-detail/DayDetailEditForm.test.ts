import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayDetailEditFormTest from './DayDetailEditFormTest.svelte';
import type { TrainingTag, DailyTask } from '$lib/types';

vi.mock('$lib/stores/tags', () => ({ addTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/photos', () => ({
  uploadPhoto: vi.fn().mockResolvedValue('users/user1/days/2026-06-10/photo.jpg'),
  getPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
}));
vi.mock('$lib/stores/theme', () => ({
  theme: { subscribe: (cb: (v: 'dark' | 'light') => void) => { cb('dark'); return () => {}; } }
}));

const activeTags: TrainingTag[] = [{ id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false }];
const activeTasks: DailyTask[] = [
  { id: 'task1', name: 'Stretch', deleted: false },
  { id: 'task2', name: 'Drink water', deleted: false },
];

function baseProps(overrides = {}) {
  return {
    dateKey: '2026-06-10', userId: 'user1', activeTags, selectedIds: new Set<string>(),
    splits: [], selectedSplitIds: new Set<string>(), exercises: [], allDays: {},
    exerciseEntries: [], label: '', activeTasks: [], completedTaskIds: new Set<string>(),
    note: '', noteMode: 'preview' as const, photoPaths: [], saving: false, saved: false, ...overrides
  };
}

describe('DayDetailEditForm — daily tasks', () => {
  it('does not render a Daily tasks section when there are no active tasks', () => {
    const { queryByText } = render(DayDetailEditFormTest, { props: baseProps() });
    expect(queryByText('Daily tasks')).not.toBeInTheDocument();
  });

  it('renders a checkbox per active task, pre-checked from completedTaskIds', () => {
    const { getByLabelText } = render(DayDetailEditFormTest, {
      props: baseProps({ activeTasks, completedTaskIds: new Set(['task1']) })
    });
    expect(getByLabelText('Stretch')).toBeChecked();
    expect(getByLabelText('Drink water')).not.toBeChecked();
  });

  it('toggles a task checkbox on click', async () => {
    const { getByLabelText } = render(DayDetailEditFormTest, { props: baseProps({ activeTasks }) });
    const checkbox = getByLabelText('Drink water');
    await fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});

describe('DayDetailEditForm — note-editing hides other sections (mobile only)', () => {
  it('hides other sections while the note is in edit mode', () => {
    const { getByText } = render(DayDetailEditFormTest, {
      props: baseProps({ activeTags, activeTasks, noteMode: 'edit' })
    });
    const trainingTypesSection = getByText('Training types').closest('div');
    const labelSection = getByText('Label').closest('div');
    const dailyTasksSection = getByText('Daily tasks').closest('div');
    const photosSection = getByText('Progress photos').closest('div');
    expect(trainingTypesSection?.className).toContain('hidden');
    expect(labelSection?.className).toContain('hidden');
    expect(dailyTasksSection?.className).toContain('hidden');
    expect(photosSection?.className).toContain('hidden');
  });

  it('does not hide other sections when hideOtherSectionsWhileEditingNote is false', () => {
    const { getByText } = render(DayDetailEditFormTest, {
      props: baseProps({ activeTags, noteMode: 'edit', hideOtherSectionsWhileEditingNote: false })
    });
    const trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).not.toContain('hidden');
  });

  it('does not hide other sections when the note is in preview mode', () => {
    const { getByText } = render(DayDetailEditFormTest, {
      props: baseProps({ activeTags, noteMode: 'preview' })
    });
    const trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).not.toContain('hidden');
  });
});

describe('DayDetailEditForm — save/cancel', () => {
  it('dispatches save on Save click', async () => {
    const { getByText, getByTestId } = render(DayDetailEditFormTest, { props: baseProps() });
    await fireEvent.click(getByText('Save'));
    expect(getByTestId('save-count').textContent).toBe('1');
  });

  it('dispatches cancel on Cancel click', async () => {
    const { getByText, getByTestId } = render(DayDetailEditFormTest, { props: baseProps() });
    await fireEvent.click(getByText('Cancel'));
    expect(getByTestId('cancel-count').textContent).toBe('1');
  });

  it('shows a Saving state when saving is true', () => {
    const { getByText } = render(DayDetailEditFormTest, { props: baseProps({ saving: true }) });
    expect(getByText('Saving…')).toBeInTheDocument();
  });

  it('shows a Saved state when saved is true', () => {
    const { getByText } = render(DayDetailEditFormTest, { props: baseProps({ saved: true }) });
    expect(getByText('✓ Saved')).toBeInTheDocument();
  });
});
