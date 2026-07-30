import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import MarkdownEditor from './MarkdownEditor.svelte';
import MarkdownEditorTest from './MarkdownEditorTest.svelte';
import { formatMarkdown } from '$lib/domain';

vi.mock('marked', () => ({ marked: (s: string) => `<p>${s}</p>` }));

vi.mock('$lib/domain', () => ({
  formatMarkdown: vi.fn(async (value: string) =>
    value.replace('| a | bb |', '| a  | bb |')
  ),
  preloadMarkdownFormatter: vi.fn()
}));

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

  it('formats the value on blur', async () => {
    const { getByRole, getByTestId } = render(MarkdownEditorTest, {
      props: { value: '' }
    });
    const textarea = getByRole('textbox');
    await fireEvent.input(textarea, { target: { value: '| a | bb |' } });
    await fireEvent.blur(textarea);
    expect(getByTestId('value')).toHaveTextContent('| a  | bb |', { normalizeWhitespace: false });
  });

  it('does not let a stale format resolution clobber a newer typed value', async () => {
    let resolveFormat: (value: string) => void = () => {};
    const controlled = new Promise<string>((resolve) => {
      resolveFormat = resolve;
    });
    vi.mocked(formatMarkdown).mockReturnValueOnce(controlled);

    const { getByRole, getByTestId } = render(MarkdownEditorTest, {
      props: { value: 'original text' }
    });
    const textarea = getByRole('textbox');

    // Blur starts formatting 'original text', but the promise hasn't resolved yet.
    await fireEvent.blur(textarea);

    // Before it resolves, the user refocuses and types something new.
    await fireEvent.input(textarea, { target: { value: 'newer typed value' } });

    // Now the stale format resolves.
    resolveFormat('STALE FORMATTED RESULT');
    await controlled;

    // The bound value should reflect the newer typed value, not the stale result.
    await waitFor(() =>
      expect(getByTestId('value')).toHaveTextContent('newer typed value')
    );
  });

  it('does not throw when a pending format resolves after the component is destroyed', async () => {
    let resolveFormat: (value: string) => void = () => {};
    const controlled = new Promise<string>((resolve) => {
      resolveFormat = resolve;
    });
    vi.mocked(formatMarkdown).mockReturnValueOnce(controlled);

    const { getByRole, unmount } = render(MarkdownEditorTest, {
      props: { value: 'original text' }
    });
    const textarea = getByRole('textbox');

    await fireEvent.blur(textarea);

    unmount();

    expect(() => resolveFormat('STALE FORMATTED RESULT')).not.toThrow();
    await expect(controlled).resolves.toBe('STALE FORMATTED RESULT');
  });
});
