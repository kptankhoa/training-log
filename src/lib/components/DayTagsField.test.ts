import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayTagsField from './DayTagsField.svelte';
import type { TrainingTag } from '$lib/types';

vi.mock('$lib/stores/tags', () => ({ addTag: vi.fn().mockResolvedValue(undefined) }));

const activeTags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
  { id: 'tag2', name: 'Boxing', color: 'red', deleted: false },
];

describe('DayTagsField — readonly mode', () => {
  it('shows only the selected tags, not every active tag', () => {
    const { getByText, queryByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set<string>(['tag1']), readonly: true }
    });
    expect(getByText('Weight Lifting')).toBeInTheDocument();
    expect(queryByText('Boxing')).not.toBeInTheDocument();
  });

  it('shows a placeholder message when nothing is selected', () => {
    const { getByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set<string>(), readonly: true }
    });
    expect(getByText('Nothing logged yet.')).toBeInTheDocument();
  });

  it('does not show the "+ Add" control', () => {
    const { queryByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set<string>(), readonly: true }
    });
    expect(queryByText('+ Add')).not.toBeInTheDocument();
  });
});

describe('DayTagsField — edit mode', () => {
  it('renders all active tag chips (not just selected ones)', () => {
    const { getByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set<string>(['tag1']), readonly: false, userId: 'user1' }
    });
    expect(getByText('Weight Lifting')).toBeInTheDocument();
    expect(getByText('Boxing')).toBeInTheDocument();
  });

  it('clicking an unselected chip selects it', async () => {
    const { getByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set<string>(), readonly: false, userId: 'user1' }
    });
    const chip = getByText('Boxing');
    expect(chip.style.backgroundColor).toBe('transparent');
    await fireEvent.click(chip);
    expect(chip.style.backgroundColor).not.toBe('transparent');
  });

  it('typing a new tag name and pressing Enter commits it', async () => {
    const { addTag } = await import('$lib/stores/tags');
    const { getByText, getByPlaceholderText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set<string>(), readonly: false, userId: 'user1' }
    });
    await fireEvent.click(getByText('+ Add'));
    const input = getByPlaceholderText('Type name…');
    await fireEvent.input(input, { target: { value: 'Cycling' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(addTag).toHaveBeenCalledWith('user1', 'Cycling');
  });

  it('hides the section (mobile only) when noteEditing is true', () => {
    const { getByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set<string>(), readonly: false, userId: 'user1', noteEditing: true }
    });
    const section = getByText('Training types').closest('div');
    expect(section?.className).toContain('hidden');
  });

  it('does not hide the section when noteEditing is false', () => {
    const { getByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set<string>(), readonly: false, userId: 'user1', noteEditing: false }
    });
    const section = getByText('Training types').closest('div');
    expect(section?.className).not.toContain('hidden');
  });
});
