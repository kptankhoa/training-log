import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DaySplitsExercises from './DaySplitsExercises.svelte';
import type { Exercise, Split } from '$lib/types';

vi.mock('$lib/stores/exercises', () => ({
  addExercise: vi.fn().mockResolvedValue('new-ex-id'),
}));
vi.mock('$lib/stores/theme', () => ({
  theme: { subscribe: (cb: (v: 'dark' | 'light') => void) => { cb('dark'); return () => {}; } }
}));

const exercises: Exercise[] = [{ id: 'bench', name: 'Bench Press', deleted: false }];
const splits: Split[] = [
  { id: 'push', label: 'Push Day', sortOrder: 1, content: '', color: 'blue' },
  { id: 'pull', label: 'Pull Day', sortOrder: 2, content: '', color: 'red' },
];

describe('DaySplitsExercises — readonly mode', () => {
  it('shows selected splits, not unselected ones', () => {
    const { getByText, queryByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set<string>(['push']), exerciseEntries: [], readonly: true }
    });
    expect(getByText('Push Day')).toBeInTheDocument();
    expect(queryByText('Pull Day')).not.toBeInTheDocument();
  });

  it('shows nothing when there are no splits or exercises logged', () => {
    const { queryByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set<string>(), exerciseEntries: [], readonly: true }
    });
    expect(queryByText('Splits')).not.toBeInTheDocument();
    expect(queryByText('Exercises')).not.toBeInTheDocument();
  });

  it('shows logged exercises with sets', () => {
    const { getByText } = render(DaySplitsExercises, {
      props: {
        splits, exercises, selectedSplitIds: new Set<string>(),
        exerciseEntries: [{ exerciseId: 'bench', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 6 }] }],
        readonly: true
      }
    });
    expect(getByText('Bench Press')).toBeInTheDocument();
    expect(getByText(/80×8, 80×6/)).toBeInTheDocument();
  });

  it('shows bodyweight and time sets in the readonly summary with their own formats', () => {
    const mixedExercises: Exercise[] = [
      { id: 'pushup', name: 'Push-up', deleted: false, type: 'bodyweight' },
      { id: 'plank', name: 'Plank', deleted: false, type: 'time' },
    ];
    const { getByText } = render(DaySplitsExercises, {
      props: {
        splits, exercises: mixedExercises, selectedSplitIds: new Set<string>(),
        exerciseEntries: [
          { exerciseId: 'pushup', sets: [{ type: 'bodyweight', reps: 20 }] },
          { exerciseId: 'plank', sets: [{ type: 'time', seconds: 45 }] },
        ],
        readonly: true
      }
    });
    expect(getByText(/×20/)).toBeInTheDocument();
    expect(getByText(/45s/)).toBeInTheDocument();
  });

  it('shows equipment abbreviation on a weight set in the readonly summary', () => {
    const weightExercise: Exercise[] = [
      { id: 'bench', name: 'Bench Press', deleted: false },
    ];
    const { getByText } = render(DaySplitsExercises, {
      props: {
        splits, exercises: weightExercise, selectedSplitIds: new Set<string>(),
        exerciseEntries: [
          { exerciseId: 'bench', sets: [{ type: 'weight', weight: 80, reps: 8, equipment: 'dumbbell' }] },
        ],
        readonly: true
      }
    });
    expect(getByText(/80×8 DB/)).toBeInTheDocument();
  });
});

describe('DaySplitsExercises — edit mode', () => {
  it('starts collapsed when there is no split or exercise logged yet', () => {
    const { queryByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set<string>(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    expect(queryByText('Push Day')).not.toBeInTheDocument();
  });

  it('starts expanded when a split is already selected', () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set(['push']), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    expect(getByText('Push Day')).toBeInTheDocument();
  });

  it('expands on header click to reveal the split picker and exercise editor', async () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, exercises, selectedSplitIds: new Set<string>(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await fireEvent.click(getByText('Splits & Exercises'));
    expect(getByText('Push Day')).toBeInTheDocument();
    expect(getByText('+ Bench Press')).toBeInTheDocument();
  });

  it('a split chip is transparent with the split\'s color as text/border when unselected', async () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set<string>(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await fireEvent.click(getByText('Splits & Exercises'));
    const pushChip = getByText('Push Day');
    expect(pushChip.style.backgroundColor).toBe('transparent');
    expect(pushChip.style.color).toBe('rgb(131, 165, 152)'); // Push Day's color: blue
  });

  it('toggling a split chip fills it with the split\'s own color', async () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set<string>(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await fireEvent.click(getByText('Splits & Exercises'));
    const pushChip = getByText('Push Day');
    await fireEvent.click(pushChip);
    expect(pushChip.style.backgroundColor).toBe('rgb(131, 165, 152)'); // Push Day's color: blue
    expect(pushChip.style.color).toBe('rgb(40, 40, 40)');
  });

  it('picking a split narrows the exercise picker', async () => {
    const tiedExercises: Exercise[] = [
      { id: 'bench', name: 'Bench Press', deleted: false, splitIds: ['push'] },
      { id: 'row', name: 'Row', deleted: false, splitIds: ['pull'] },
    ];
    const { getByText, queryByText } = render(DaySplitsExercises, {
      props: { splits, exercises: tiedExercises, selectedSplitIds: new Set<string>(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await fireEvent.click(getByText('Splits & Exercises'));
    expect(getByText('+ Bench Press')).toBeInTheDocument();
    expect(getByText('+ Row')).toBeInTheDocument();

    await fireEvent.click(getByText('Push Day'));

    expect(getByText('+ Bench Press')).toBeInTheDocument();
    expect(queryByText('+ Row')).not.toBeInTheDocument();
  });

  it('logging a set via the exercise editor is reflected immediately', async () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, exercises, selectedSplitIds: new Set<string>(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await fireEvent.click(getByText('Splits & Exercises'));
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('20×8 ✕')).toBeInTheDocument();
  });

  it('hides the section (mobile only) when noteEditing is true', () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set<string>(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1', noteEditing: true }
    });
    const section = getByText('Splits & Exercises').closest('div');
    expect(section?.className).toContain('hidden');
  });
});
