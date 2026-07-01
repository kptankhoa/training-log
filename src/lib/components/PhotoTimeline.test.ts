import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import PhotoTimeline from './PhotoTimeline.svelte';
import type { DayEntry } from '$lib/types';

vi.mock('$lib/stores/photos', () => ({
  getPhotoUrl: vi.fn((path: string) => Promise.resolve(`https://example.com/${path}`)),
}));

const days: Record<string, DayEntry> = {
  '2026-06-10': { tags: [], label: '', note: '', photos: ['a.jpg'] },
  '2026-06-20': { tags: [], label: '', note: '', photos: ['b.jpg', 'c.jpg'] },
  '2026-06-15': { tags: [], label: '', note: '' }, // no photos — should be excluded
};

describe('PhotoTimeline', () => {
  it('shows an empty message when there are no photos', () => {
    const { getByText } = render(PhotoTimeline, { props: { days: {} } });
    expect(getByText(/no progress photos yet/i)).toBeInTheDocument();
  });

  it('excludes days with no photos', () => {
    const { queryByText } = render(PhotoTimeline, { props: { days } });
    expect(queryByText(/no progress photos yet/i)).not.toBeInTheDocument();
  });

  it('orders entries newest first', async () => {
    const { findAllByAltText } = render(PhotoTimeline, { props: { days } });
    await findAllByAltText('Training day snapshot');
    // 3 total photos across 2026-06-20 (2 photos) then 2026-06-10 (1 photo)
    const images = await findAllByAltText('Training day snapshot');
    expect(images).toHaveLength(3);
    expect((images[0] as HTMLImageElement).src).toContain('b.jpg');
    expect((images[2] as HTMLImageElement).src).toContain('a.jpg');
  });

  it('opens a lightbox with the full image on thumbnail click', async () => {
    const { findAllByAltText, getByRole } = render(PhotoTimeline, { props: { days } });
    const thumbnails = await findAllByAltText('Training day snapshot');
    await fireEvent.click(thumbnails[0].closest('button')!);
    await waitFor(() => expect(getByRole('dialog')).toBeInTheDocument());
  });

  it('closes the lightbox when clicking the close button', async () => {
    const { findAllByAltText, getByRole, getByLabelText, queryByRole } = render(PhotoTimeline, { props: { days } });
    const thumbnails = await findAllByAltText('Training day snapshot');
    await fireEvent.click(thumbnails[0].closest('button')!);
    await waitFor(() => expect(getByRole('dialog')).toBeInTheDocument());
    await fireEvent.click(getByLabelText('Close'));
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });
});
