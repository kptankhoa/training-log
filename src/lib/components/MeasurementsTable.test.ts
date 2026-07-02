import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MeasurementsTable from './MeasurementsTable.svelte';
import type { BodyMeasurementEntry } from '$lib/types';

let entriesValue: BodyMeasurementEntry[] = [];
let loadingValue = false;

const { mockInit, mockSave, mockDelete } = vi.hoisted(() => {
  return {
    mockInit: vi.fn(),
    mockSave: vi.fn().mockResolvedValue(undefined),
    mockDelete: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('$lib/stores/bodyMeasurements', () => ({
  bodyMeasurements: {
    subscribe: (cb: (v: BodyMeasurementEntry[]) => void) => { cb(entriesValue); return () => {}; }
  },
  bodyMeasurementsLoading: {
    subscribe: (cb: (v: boolean) => void) => { cb(loadingValue); return () => {}; }
  },
  initBodyMeasurements: mockInit,
  saveBodyMeasurement: mockSave,
  deleteBodyMeasurement: mockDelete,
}));

describe('MeasurementsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entriesValue = [];
    loadingValue = false;
  });

  it('calls initBodyMeasurements with the given userId on mount', () => {
    render(MeasurementsTable, { props: { userId: 'user1' } });
    expect(mockInit).toHaveBeenCalledWith('user1');
  });

  it('shows an empty state when there are no entries', () => {
    const { getByText } = render(MeasurementsTable, { props: { userId: 'user1' } });
    expect(getByText('No measurements yet')).toBeInTheDocument();
  });

  it('renders a dash for fields that were not entered, and the raw value for ones that were', () => {
    entriesValue = [{ id: '2026-06-10', chest: 100 }];
    const { getAllByText } = render(MeasurementsTable, { props: { userId: 'user1' } });
    expect(getAllByText('—').length).toBeGreaterThan(0);
    expect(getAllByText('100').length).toBeGreaterThan(0);
  });

  it('deleting a row calls deleteBodyMeasurement with its id, immediately (no confirm)', async () => {
    entriesValue = [{ id: '2026-06-10', chest: 100 }];
    const { getByLabelText } = render(MeasurementsTable, { props: { userId: 'user1' } });
    await fireEvent.click(getByLabelText('Delete entry for 2026-06-10'));
    expect(mockDelete).toHaveBeenCalledWith('user1', '2026-06-10');
  });

  it('adding an entry only includes the fields that were filled in', async () => {
    const { getByText, getByLabelText } = render(MeasurementsTable, { props: { userId: 'user1' } });
    await fireEvent.click(getByText('+ Add entry'));
    await fireEvent.input(getByLabelText('Chest (cm)'), { target: { value: '101' } });
    await fireEvent.input(getByLabelText('Waist (cm)'), { target: { value: '82' } });
    await fireEvent.click(getByText('Save entry'));
    expect(mockSave).toHaveBeenCalledWith('user1', expect.any(String), { chest: 101, waist: 82 });
  });

  it('excludes a field that was typed into and then cleared before saving', async () => {
    const { getByText, getByLabelText } = render(MeasurementsTable, { props: { userId: 'user1' } });
    await fireEvent.click(getByText('+ Add entry'));
    const chestInput = getByLabelText('Chest (cm)');
    await fireEvent.input(chestInput, { target: { value: '101' } });
    await fireEvent.input(chestInput, { target: { value: '' } });
    await fireEvent.click(getByText('Save entry'));
    expect(mockSave).toHaveBeenCalledWith('user1', expect.any(String), {});
  });
});
