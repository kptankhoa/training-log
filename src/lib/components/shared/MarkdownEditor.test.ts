import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MarkdownEditor from './MarkdownEditor.svelte';

vi.mock('marked', () => ({ marked: (s: string) => `<p>${s}</p>` }));

describe('MarkdownEditor', () => {
  it('renders textarea in edit mode by default', () => {
    const { getByRole } = render(MarkdownEditor, { props: { value: '', placeholder: 'Write...' } });
    expect(getByRole('textbox')).toBeInTheDocument();
  });

  it('shows placeholder in textarea', () => {
    const { getByPlaceholderText } = render(MarkdownEditor, {
      props: { value: '', placeholder: 'Write here' }
    });
    expect(getByPlaceholderText('Write here')).toBeInTheDocument();
  });

  it('switches to preview mode on toggle click', async () => {
    const { getByText, queryByRole } = render(MarkdownEditor, {
      props: { value: '**bold**', placeholder: '' }
    });
    await fireEvent.click(getByText('Preview'));
    expect(queryByRole('textbox')).not.toBeInTheDocument();
    expect(getByText('Edit')).toBeInTheDocument();
  });

  it('renders markdown HTML in preview mode', async () => {
    const { getByText, container } = render(MarkdownEditor, {
      props: { value: '**hello**', placeholder: '' }
    });
    await fireEvent.click(getByText('Preview'));
    expect(container.querySelector('p')).toBeInTheDocument();
  });

  it('switches back to edit mode', async () => {
    const { getByText, getByRole } = render(MarkdownEditor, {
      props: { value: '', placeholder: '' }
    });
    await fireEvent.click(getByText('Preview'));
    await fireEvent.click(getByText('Edit'));
    expect(getByRole('textbox')).toBeInTheDocument();
  });
});
