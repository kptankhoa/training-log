import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayDetailView from './DayDetailView.svelte';
import DayDetailViewTest from './DayDetailViewTest.svelte';
import type { TrainingTag, DailyTask } from '$lib/types';

vi.mock('marked', () => ({ marked: (s: string) => s }));

const activeTags: TrainingTag[] = [{ id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false }];
const activeTasks: DailyTask[] = [{ id: 'task1', name: 'Stretch', deleted: false }];

function baseProps(overrides = {}) {
  return {
    activeTags, selectedIds: new Set<string>(), splits: [], selectedSplitIds: new Set<string>(),
    exercises: [], exerciseEntries: [], label: '', activeTasks: [], completedTaskIds: new Set<string>(),
    note: '', photoPaths: [], ...overrides
  };
}

describe('DayDetailView', () => {
  it('shows the label as text', () => {
    const { getByText } = render(DayDetailView, { props: baseProps({ label: 'Leg day' }) });
    expect(getByText('Leg day')).toBeInTheDocument();
  });

  it('does not show a Label section when empty', () => {
    const { queryByText } = render(DayDetailView, { props: baseProps({ label: '' }) });
    expect(queryByText('Label')).not.toBeInTheDocument();
  });

  it('shows daily tasks with completed state, read-only', () => {
    const { getByText } = render(DayDetailView, {
      props: baseProps({ activeTasks, completedTaskIds: new Set(['task1']) })
    });
    const stretchRow = getByText('Stretch').closest('span');
    expect(stretchRow?.textContent).toContain('✓');
  });

  it('does not show a Daily tasks section when there are no active tasks', () => {
    const { queryByText } = render(DayDetailView, { props: baseProps({ activeTasks: [] }) });
    expect(queryByText('Daily tasks')).not.toBeInTheDocument();
  });

  it('renders the note as markdown', () => {
    const { getByText } = render(DayDetailView, { props: baseProps({ note: '# PR' }) });
    expect(getByText('# PR')).toBeInTheDocument();
  });

  it('shows a placeholder when there are no notes', () => {
    const { getByText } = render(DayDetailView, { props: baseProps({ note: '' }) });
    expect(getByText('No notes yet.')).toBeInTheDocument();
  });

  it('shows an Edit button and dispatches edit on click', async () => {
    const { getByText, getByTestId } = render(DayDetailViewTest, { props: baseProps() });
    await fireEvent.click(getByText('Edit'));
    expect(getByTestId('edit-count').textContent).toBe('1');
  });
});
