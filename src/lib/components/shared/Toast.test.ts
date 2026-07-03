import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Toast from './Toast.svelte';
import { toasts, showError, dismissToast } from '$lib/stores/toast';

describe('Toast', () => {
  beforeEach(() => {
    get(toasts).forEach((t) => dismissToast(t.id));
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(Toast);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('renders a message added via showError', () => {
    showError('Could not save exercise.');
    const { getByText } = render(Toast);
    expect(getByText('Could not save exercise.')).toBeInTheDocument();
  });

  it('renders multiple stacked toasts', () => {
    showError('First');
    showError('Second');
    const { getByText } = render(Toast);
    expect(getByText('First')).toBeInTheDocument();
    expect(getByText('Second')).toBeInTheDocument();
  });

  it('dismiss button removes only that toast', async () => {
    showError('First');
    showError('Second');
    const { getAllByLabelText, getByText, queryByText } = render(Toast);
    await fireEvent.click(getAllByLabelText('Dismiss')[0]);

    expect(queryByText('First')).toBeNull();
    expect(getByText('Second')).toBeInTheDocument();
  });
});
