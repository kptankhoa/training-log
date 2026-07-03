import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import PhotoTimeline from './PhotoTimeline.svelte';
import { getPhotoSize, deletePhoto } from '$lib/stores/photos';
import { saveDay } from '$lib/stores/days';
import type { DayEntry } from '$lib/types';

vi.mock('$lib/stores/photos', () => ({
  getPhotoUrl: vi.fn((path: string) => Promise.resolve(`https://example.com/${path}`)),
  getPhotoSize: vi.fn(() => Promise.resolve(2_097_152)),
  deletePhoto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('$lib/stores/days', () => ({
  saveDay: vi.fn().mockResolvedValue(undefined),
}));

const days: Record<string, DayEntry> = {
  '2026-06-10': { tags: [], label: '', note: '', photos: ['a.jpg'] },
  '2026-06-20': { tags: [], label: '', note: '', photos: ['b.jpg', 'c.jpg'] },
  '2026-06-15': { tags: [], label: '', note: '' }, // no photos — should be excluded
};

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it('shows each photo\'s size formatted with the highest sensible unit', async () => {
    const sizesByPath: Record<string, number> = {
      'a.jpg': 2_097_152, // 2 MiB
      'b.jpg': 1_003_520, // 980 KiB
      'c.jpg': 512, // 512 B
    };
    vi.mocked(getPhotoSize).mockImplementation((path: string) => Promise.resolve(sizesByPath[path]));
    const { findByText } = render(PhotoTimeline, { props: { days } });
    expect(await findByText('2MB')).toBeInTheDocument();
    expect(await findByText('980KB')).toBeInTheDocument();
    expect(await findByText('512B')).toBeInTheDocument();
  });

  it('closes the lightbox when clicking the close button', async () => {
    const { findAllByAltText, getByRole, getByLabelText, queryByRole } = render(PhotoTimeline, { props: { days } });
    const thumbnails = await findAllByAltText('Training day snapshot');
    await fireEvent.click(thumbnails[0].closest('button')!);
    await waitFor(() => expect(getByRole('dialog')).toBeInTheDocument());
    await fireEvent.click(getByLabelText('Close'));
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a remove button on each thumbnail', async () => {
    const { findAllByLabelText } = render(PhotoTimeline, { props: { days, userId: 'user1' } });
    expect(await findAllByLabelText('Remove photo')).toHaveLength(3);
  });

  it('a single click on a remove button arms confirmation without deleting', async () => {
    const { findAllByLabelText, getByLabelText } = render(PhotoTimeline, { props: { days, userId: 'user1' } });
    const removeButtons = await findAllByLabelText('Remove photo');
    await fireEvent.click(removeButtons[0]);

    expect(getByLabelText('Confirm remove photo')).toBeInTheDocument();
    expect(saveDay).not.toHaveBeenCalled();
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it('confirming delete persists the day without that photo and deletes the storage blob', async () => {
    const { findAllByLabelText, getByLabelText } = render(PhotoTimeline, { props: { days, userId: 'user1' } });
    const removeButtons = await findAllByLabelText('Remove photo');
    // Thumbnails render newest-first: 2026-06-20's b.jpg, then c.jpg, then 2026-06-10's a.jpg
    await fireEvent.click(removeButtons[0]);
    await fireEvent.click(getByLabelText('Confirm remove photo'));

    await waitFor(() => expect(saveDay).toHaveBeenCalledWith('user1', '2026-06-20', {
      ...days['2026-06-20'],
      photos: ['c.jpg'],
    }));
    expect(deletePhoto).toHaveBeenCalledWith('b.jpg');
  });

  it('reflects a photo removal once the days store re-supplies updated props', async () => {
    // PhotoTimeline's `days` prop is read-only — deleting persists via saveDay,
    // and the real app's $allDays store re-renders this component with fresh
    // props once Firestore's listener picks up the change. Simulate that here
    // rather than expecting the component to locally mutate a prop it doesn't own.
    const { findAllByLabelText, getByLabelText, findAllByAltText, rerender } = render(PhotoTimeline, { props: { days, userId: 'user1' } });
    const removeButtons = await findAllByLabelText('Remove photo');
    await fireEvent.click(removeButtons[0]);
    await fireEvent.click(getByLabelText('Confirm remove photo'));
    await waitFor(() => expect(saveDay).toHaveBeenCalled());

    await rerender({ days: { ...days, '2026-06-20': { ...days['2026-06-20'], photos: ['c.jpg'] } }, userId: 'user1' });

    expect(await findAllByAltText('Training day snapshot')).toHaveLength(2);
  });
});
