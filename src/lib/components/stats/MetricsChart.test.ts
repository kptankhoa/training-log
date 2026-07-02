import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { BodyMeasurement } from '$lib/types';

const mocks = vi.hoisted(() => {
  const mockInitMeasurements = vi.fn();
  const mockSaveMeasurement = vi.fn().mockResolvedValue(undefined);
  const mockDeleteMeasurement = vi.fn().mockResolvedValue(undefined);

  return {
    state: {
      measurementsValue: [] as BodyMeasurement[],
      measurementsLoadingValue: false,
    },
    mockInitMeasurements,
    mockSaveMeasurement,
    mockDeleteMeasurement,
  };
});

vi.mock('$lib/stores/measurements', () => ({
  measurements: {
    subscribe: (cb: (v: BodyMeasurement[]) => void) => { cb(mocks.state.measurementsValue); return () => {}; }
  },
  measurementsLoading: {
    subscribe: (cb: (v: boolean) => void) => { cb(mocks.state.measurementsLoadingValue); return () => {}; }
  },
  initMeasurements: mocks.mockInitMeasurements,
  saveMeasurement: mocks.mockSaveMeasurement,
  deleteMeasurement: mocks.mockDeleteMeasurement,
}));

vi.mock('chart.js', () => {
  class MockChart {
    static register() {}
    destroy() {}
  }
  return {
    Chart: MockChart,
    LineController: {}, LineElement: {}, PointElement: {}, LinearScale: {},
    CategoryScale: {}, Tooltip: {}, Legend: {}, Filler: {},
  };
});

import MetricsChart from './MetricsChart.svelte';

describe('MetricsChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.measurementsValue = [];
    mocks.state.measurementsLoadingValue = false;
  });

  it('calls initMeasurements with the given userId on mount', () => {
    render(MetricsChart, { props: { userId: 'user1' } });
    expect(mocks.mockInitMeasurements).toHaveBeenCalledWith('user1');
  });

  it('shows a spinner while loading', () => {
    mocks.state.measurementsLoadingValue = true;
    const { container } = render(MetricsChart, { props: { userId: 'user1' } });
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows an empty state when there are no entries', () => {
    const { getByText } = render(MetricsChart, { props: { userId: 'user1' } });
    expect(getByText('No measurements yet')).toBeInTheDocument();
  });

  it('renders the entries list newest first', () => {
    mocks.state.measurementsValue = [
      { id: '2026-01-01', weight: 80, muscleMass: 36, fatMass: 16, bfp: 20, score: 80 },
      { id: '2026-02-01', weight: 79, muscleMass: 36, fatMass: 15, bfp: 19, score: 82 },
    ];
    const { getAllByText } = render(MetricsChart, { props: { userId: 'user1' } });
    const rows = getAllByText(/kg MM/);
    expect(rows[0].textContent).toContain('79kg');
  });

  it('deleting an entry calls deleteMeasurement with its id', async () => {
    mocks.state.measurementsValue = [{ id: '2026-01-01', weight: 80, muscleMass: 36, fatMass: 16, bfp: 20, score: 80 }];
    const { getByLabelText } = render(MetricsChart, { props: { userId: 'user1' } });
    await fireEvent.click(getByLabelText('Delete entry for 2026-01-01'));
    expect(mocks.mockDeleteMeasurement).toHaveBeenCalledWith('user1', '2026-01-01');
  });

  it('adding an entry calls saveMeasurement with the form values', async () => {
    const { getByText, getByLabelText } = render(MetricsChart, { props: { userId: 'user1' } });
    await fireEvent.click(getByText('+ Add entry'));
    await fireEvent.input(getByLabelText('Weight (kg)'), { target: { value: '80.5' } });
    await fireEvent.click(getByText('Save entry'));
    expect(mocks.mockSaveMeasurement).toHaveBeenCalledWith(
      'user1',
      expect.any(String),
      expect.objectContaining({ weight: 80.5 })
    );
  });
});
