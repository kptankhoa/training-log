import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayPhotos from './DayPhotos.svelte';

vi.mock('$lib/stores/photos', () => ({
  uploadPhoto: vi.fn().mockResolvedValue('users/user1/days/2026-06-10/photo.jpg'),
  getPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
}));

describe('DayPhotos — readonly mode', () => {
  it('shows nothing when there are no photos', () => {
    const { queryByText } = render(DayPhotos, { props: { photoPaths: [], readonly: true } });
    expect(queryByText('Progress photos')).not.toBeInTheDocument();
  });

  it('shows existing photos as thumbnails', async () => {
    const { findByAltText } = render(DayPhotos, {
      props: { photoPaths: ['users/user1/days/2026-06-10/existing.jpg'], readonly: true }
    });
    expect(await findByAltText('Training day snapshot')).toBeInTheDocument();
  });

  it('opens and closes a lightbox on thumbnail click', async () => {
    const { findByAltText, getByRole, getByLabelText, queryByLabelText } = render(DayPhotos, {
      props: { photoPaths: ['users/user1/days/2026-06-10/existing.jpg'], readonly: true }
    });
    const thumbnail = await findByAltText('Training day snapshot');
    await fireEvent.click(thumbnail.closest('button')!);
    expect(getByRole('dialog')).toBeInTheDocument();

    await fireEvent.click(getByLabelText('Close photo'));
    expect(queryByLabelText('Close photo')).not.toBeInTheDocument();
  });

  it('does not show the upload tile', () => {
    const { queryByLabelText } = render(DayPhotos, { props: { photoPaths: [], readonly: true } });
    expect(queryByLabelText('Add photo')).not.toBeInTheDocument();
  });
});

describe('DayPhotos — edit mode', () => {
  it('always shows the section, even with no photos yet', () => {
    const { getByText, getByLabelText } = render(DayPhotos, {
      props: { photoPaths: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    expect(getByText('Progress photos')).toBeInTheDocument();
    expect(getByLabelText('Add photo')).toBeInTheDocument();
  });

  it('uploads a selected file and shows a thumbnail', async () => {
    const { uploadPhoto, getPhotoUrl } = await import('$lib/stores/photos');
    const { getByTestId, findByAltText } = render(DayPhotos, {
      props: { photoPaths: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });

    const fileInput = getByTestId('photo-file-input');
    const file = new File(['fake'], 'progress.jpg', { type: 'image/jpeg' });
    await fireEvent.change(fileInput, { target: { files: [file] } });

    expect(uploadPhoto).toHaveBeenCalledWith('user1', '2026-06-10', file);
    expect(getPhotoUrl).toHaveBeenCalled();
    expect(await findByAltText('Training day snapshot')).toBeInTheDocument();
  });

  it('a single click on the remove button arms confirmation without removing', async () => {
    const { findByAltText, getByLabelText, queryByAltText } = render(DayPhotos, {
      props: { photoPaths: ['users/user1/days/2026-06-10/existing.jpg'], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await findByAltText('Training day snapshot');
    await fireEvent.click(getByLabelText('Remove photo'));

    expect(queryByAltText('Training day snapshot')).toBeInTheDocument();
    expect(getByLabelText('Confirm remove photo')).toBeInTheDocument();
  });

  it('removes the thumbnail after a confirmed click', async () => {
    const { findByAltText, getByLabelText, queryByAltText } = render(DayPhotos, {
      props: { photoPaths: ['users/user1/days/2026-06-10/existing.jpg'], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await findByAltText('Training day snapshot');
    await fireEvent.click(getByLabelText('Remove photo'));
    await fireEvent.click(getByLabelText('Confirm remove photo'));

    expect(queryByAltText('Training day snapshot')).not.toBeInTheDocument();
  });

  it('hides the section (mobile only) when noteEditing is true', () => {
    const { getByText } = render(DayPhotos, {
      props: { photoPaths: [], readonly: false, dateKey: '2026-06-10', userId: 'user1', noteEditing: true }
    });
    const section = getByText('Progress photos').closest('div');
    expect(section?.className).toContain('hidden');
  });

  it('does not hide the section when noteEditing is false', () => {
    const { getByText } = render(DayPhotos, {
      props: { photoPaths: [], readonly: false, dateKey: '2026-06-10', userId: 'user1', noteEditing: false }
    });
    const section = getByText('Progress photos').closest('div');
    expect(section?.className).not.toContain('hidden');
  });
});
