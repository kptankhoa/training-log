import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TagChip from './TagChip.svelte';
import TagChipTest from './TagChipTest.svelte';
import type { TrainingTag } from '$lib/types';

vi.mock('$lib/stores/theme', () => ({
  theme: { subscribe: (cb: (v: 'dark' | 'light') => void) => { cb('dark'); return () => {}; } }
}));

const tag: TrainingTag = { id: 'tag1', name: 'Boxing', color: 'red', deleted: false };

describe('TagChip', () => {
  it('renders tag name', () => {
    const { getByText } = render(TagChip, { props: { tag, selected: false } });
    expect(getByText('Boxing')).toBeInTheDocument();
  });

  it('emits toggle event with tagId on click', async () => {
    const { getByText, getByTestId } = render(TagChipTest, { props: { tag, selected: false } });
    const button = getByText('Boxing') as HTMLButtonElement;

    // Click the button to trigger the toggle event
    await fireEvent.click(button);

    // Check that the event was dispatched with correct detail
    const eventCount = getByTestId('event-count');
    const eventDetail = getByTestId('event-detail');

    expect(eventCount.textContent).toBe('1');
    expect(eventDetail.textContent).toBe('tag1');
  });

  it('applies background color when selected', () => {
    const { getByText } = render(TagChip, { props: { tag, selected: true } });
    const el = getByText('Boxing');
    expect(el.style.backgroundColor).toBe('rgb(251, 73, 52)');
  });

  it('has transparent background when not selected', () => {
    const { getByText } = render(TagChip, { props: { tag, selected: false } });
    const el = getByText('Boxing');
    expect(el.style.backgroundColor).toBe('transparent');
  });

  it('applies text color based on selected state', () => {
    // Test selected state
    const { getByText, unmount } = render(TagChip, { props: { tag, selected: true } });
    const selectedEl = getByText('Boxing');
    expect(selectedEl.style.color).toBe('rgb(40, 40, 40)');
    unmount();

    // Test unselected state
    const { getByText: getByText2 } = render(TagChip, { props: { tag, selected: false } });
    const unselectedEl = getByText2('Boxing');
    expect(unselectedEl.style.color).toBe('rgb(251, 73, 52)');
  });
});
