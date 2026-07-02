import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import FormField from './FormField.svelte';

describe('FormField', () => {
  it('renders a label wired to the input via id', () => {
    const { getByLabelText } = render(FormField, { props: { id: 'f-weight', label: 'Weight (kg)', value: '' } });
    expect(getByLabelText('Weight (kg)')).toBeInTheDocument();
  });

  it('defaults to a text input', () => {
    const { getByLabelText } = render(FormField, { props: { id: 'f-name', label: 'Name', value: '' } });
    expect(getByLabelText('Name')).toHaveAttribute('type', 'text');
  });

  it('renders a date input when type="date"', () => {
    const { getByLabelText } = render(FormField, { props: { id: 'f-date', label: 'Date', type: 'date', value: '2026-06-10' } });
    const input = getByLabelText('Date') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'date');
    expect(input.value).toBe('2026-06-10');
  });

  it('applies inputmode when provided', () => {
    const { getByLabelText } = render(FormField, { props: { id: 'f-chest', label: 'Chest (cm)', inputmode: 'decimal', value: '' } });
    expect(getByLabelText('Chest (cm)')).toHaveAttribute('inputmode', 'decimal');
  });

  it('omits inputmode when not provided', () => {
    const { getByLabelText } = render(FormField, { props: { id: 'f-label', label: 'Label', value: '' } });
    expect(getByLabelText('Label')).not.toHaveAttribute('inputmode');
  });

  it('updates the input as the user types', async () => {
    const { getByLabelText } = render(FormField, { props: { id: 'f-x', label: 'X', value: 'initial' } });
    const input = getByLabelText('X') as HTMLInputElement;
    expect(input.value).toBe('initial');

    await fireEvent.input(input, { target: { value: 'typed' } });
    expect(input.value).toBe('typed');
  });

  it('renders a placeholder when provided', () => {
    const { getByPlaceholderText } = render(FormField, { props: { id: 'f-y', label: 'Y', value: '', placeholder: 'e.g. 80' } });
    expect(getByPlaceholderText('e.g. 80')).toBeInTheDocument();
  });
});
