import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ExerciseEditor from './ExerciseEditor.svelte';
import type { Exercise, DayEntry } from '$lib/types';

vi.mock('$lib/stores/exercises', () => ({
  addExercise: vi.fn().mockResolvedValue('new-ex-id'),
}));

const exercises: Exercise[] = [
  { id: 'bench', name: 'Bench Press', deleted: false },
  { id: 'squat', name: 'Squat', deleted: false },
  { id: 'old', name: 'Retired Move', deleted: true },
];

describe('ExerciseEditor', () => {
  it('shows a pickable chip for each active exercise not already logged', () => {
    const { getByText, queryByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    expect(getByText('+ Bench Press')).toBeInTheDocument();
    expect(getByText('+ Squat')).toBeInTheDocument();
    expect(queryByText('+ Retired Move')).not.toBeInTheDocument();
  });

  it('adding an exercise removes it from the pickable list and shows a card', async () => {
    const { getByText, queryByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    expect(queryByText('+ Bench Press')).not.toBeInTheDocument();
    expect(getByText('Bench Press')).toBeInTheDocument();
    expect(getByText('Log Set')).toBeInTheDocument();
  });

  it('pre-fills weight/reps from the last logged set for that exercise', async () => {
    const allDays: Record<string, DayEntry> = {
      '2026-06-05': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [{ weight: 82.5, reps: 5 }] }] },
    };
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, allDays, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    expect(getByText('82.5kg')).toBeInTheDocument();
    expect(getByText('5')).toBeInTheDocument();
  });

  it('defaults weight/reps when the exercise has never been logged', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    expect(getByText('20kg')).toBeInTheDocument();
    expect(getByText('8')).toBeInTheDocument();
  });

  it('Log Set appends a set chip with the current draft values', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('20×8 ✕')).toBeInTheDocument();
  });

  it('logging multiple sets keeps the same draft values for fast repeats', async () => {
    const { getByText, getAllByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Log Set'));
    await fireEvent.click(getByText('Log Set'));
    expect(getAllByText('20×8 ✕')).toHaveLength(2);
  });

  it('the weight stepper adjusts by 2.5 and reps stepper by 1', async () => {
    const { getByText, getByLabelText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByLabelText('Increase weight'));
    await fireEvent.click(getByLabelText('Increase reps'));
    expect(getByText('22.5kg')).toBeInTheDocument();
    expect(getByText('9')).toBeInTheDocument();
  });

  it('reps stepper cannot go below 1', async () => {
    const { getByText, getByLabelText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    for (let i = 0; i < 10; i++) await fireEvent.click(getByLabelText('Decrease reps'));
    expect(getByText('1')).toBeInTheDocument();
  });

  it('clicking a logged set chip removes it', async () => {
    const { getByText, queryByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Log Set'));
    await fireEvent.click(getByText('20×8 ✕'));
    expect(queryByText('20×8 ✕')).not.toBeInTheDocument();
  });

  it('removing an exercise requires a confirm click', async () => {
    const { getByText, getByLabelText, queryByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByLabelText('Remove exercise'));
    expect(getByText('Bench Press')).toBeInTheDocument(); // still there after first click

    await fireEvent.click(getByLabelText('Confirm remove exercise'));
    expect(queryByText('Bench Press')).not.toBeInTheDocument();
    expect(getByText('+ Bench Press')).toBeInTheDocument(); // back in the pickable list
  });

  it('shows "Copy last session" only when there are no entries yet and history exists', () => {
    const allDays: Record<string, DayEntry> = {
      '2026-06-05': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [] }] },
    };
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, allDays, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    expect(getByText('Copy last session')).toBeInTheDocument();
  });

  it('does not show "Copy last session" once an exercise has been added', async () => {
    const allDays: Record<string, DayEntry> = {
      '2026-06-05': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [] }] },
    };
    const { getByText, queryByText } = render(ExerciseEditor, {
      props: { exercises, allDays, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Squat'));
    expect(queryByText('Copy last session')).not.toBeInTheDocument();
  });

  it('Copy last session seeds entries with the same exercises and no sets', async () => {
    const allDays: Record<string, DayEntry> = {
      '2026-06-05': {
        tags: [], label: '', note: '',
        exercises: [{ exerciseId: 'bench', sets: [{ weight: 80, reps: 8 }] }, { exerciseId: 'squat', sets: [] }]
      },
    };
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, allDays, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('Copy last session'));
    expect(getByText('Bench Press')).toBeInTheDocument();
    expect(getByText('Squat')).toBeInTheDocument();
  });

  it('creating a new exercise adds it to the catalog and logs it today', async () => {
    const { addExercise } = await import('$lib/stores/exercises');
    const { getByText, getByPlaceholderText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Add exercise'));
    const input = getByPlaceholderText('Type name…');
    await fireEvent.input(input, { target: { value: 'Deadlift' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(addExercise).toHaveBeenCalledWith('user1', 'Deadlift');
    expect(await getByText('Log Set')).toBeInTheDocument(); // it was added as a card
  });
});

describe('ExerciseEditor — filtering by the day\'s selected splits', () => {
  const tiedExercises: Exercise[] = [
    { id: 'bench', name: 'Bench Press', deleted: false, splitIds: ['push'] },
    { id: 'squat', name: 'Squat', deleted: false, splitIds: ['legs'] },
    { id: 'plank', name: 'Plank', deleted: false }, // untied — always available
  ];

  it('shows every active exercise when no split is selected for the day', () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: tiedExercises, dateKey: '2026-06-10', userId: 'user1', entries: [], daySplitIds: [] }
    });
    expect(getByText('+ Bench Press')).toBeInTheDocument();
    expect(getByText('+ Squat')).toBeInTheDocument();
    expect(getByText('+ Plank')).toBeInTheDocument();
  });

  it('narrows to exercises tied to the selected split, plus untied ones', () => {
    const { getByText, queryByText } = render(ExerciseEditor, {
      props: { exercises: tiedExercises, dateKey: '2026-06-10', userId: 'user1', entries: [], daySplitIds: ['push'] }
    });
    expect(getByText('+ Bench Press')).toBeInTheDocument();
    expect(getByText('+ Plank')).toBeInTheDocument(); // untied, always shown
    expect(queryByText('+ Squat')).not.toBeInTheDocument(); // tied to a different split
  });

  it('shows an exercise tied to multiple splits if any of them match', () => {
    const multiTied: Exercise[] = [{ id: 'deadlift', name: 'Deadlift', deleted: false, splitIds: ['pull', 'legs'] }];
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: multiTied, dateKey: '2026-06-10', userId: 'user1', entries: [], daySplitIds: ['legs'] }
    });
    expect(getByText('+ Deadlift')).toBeInTheDocument();
  });
});

describe('ExerciseEditor — exercise types', () => {
  const bodyweightExercise: Exercise[] = [
    { id: 'pushup', name: 'Push-up', deleted: false, type: 'bodyweight' },
  ];
  const timeExercise: Exercise[] = [
    { id: 'plank', name: 'Plank', deleted: false, type: 'time' },
  ];
  const singleArmExercise: Exercise[] = [
    { id: 'row', name: 'Dumbbell Row', deleted: false, type: 'weight', singleArm: true },
  ];

  it('a bodyweight exercise shows only a reps stepper, no weight stepper', async () => {
    const { getByText, getByLabelText, queryByLabelText } = render(ExerciseEditor, {
      props: { exercises: bodyweightExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Push-up'));
    expect(getByLabelText('Increase reps')).toBeInTheDocument();
    expect(queryByLabelText('Increase weight')).not.toBeInTheDocument();
  });

  it('logging a bodyweight set records reps only, formatted as ×N', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: bodyweightExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Push-up'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('×8 ✕')).toBeInTheDocument();
  });

  it('a time exercise shows only a duration stepper, no weight or reps stepper', async () => {
    const { getByText, getByLabelText, queryByLabelText } = render(ExerciseEditor, {
      props: { exercises: timeExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Plank'));
    expect(getByLabelText('Increase duration')).toBeInTheDocument();
    expect(queryByLabelText('Increase weight')).not.toBeInTheDocument();
    expect(queryByLabelText('Increase reps')).not.toBeInTheDocument();
  });

  it('logging a time set records seconds, formatted as Ns', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: timeExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Plank'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('30s ✕')).toBeInTheDocument();
  });

  it('the duration stepper steps by 5 seconds', async () => {
    const { getByText, getByLabelText } = render(ExerciseEditor, {
      props: { exercises: timeExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Plank'));
    await fireEvent.click(getByLabelText('Increase duration'));
    expect(getByText('35s')).toBeInTheDocument();
  });

  it('pre-fills the duration draft from the last logged time set', async () => {
    const allDays: Record<string, DayEntry> = {
      '2026-06-05': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'plank', sets: [{ type: 'time', seconds: 60 }] }] },
    };
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: timeExercise, allDays, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Plank'));
    expect(getByText('60s')).toBeInTheDocument();
  });

  it('shows single-arm as a suffix on the logged exercise name', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: singleArmExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Dumbbell Row'));
    expect(getByText('Dumbbell Row · single-arm')).toBeInTheDocument();
  });

  it('does not add a single-arm suffix for a plain weight exercise', async () => {
    const plainWeightExercises: Exercise[] = [
      { id: 'bench', name: 'Bench Press', deleted: false },
    ];
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: plainWeightExercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    expect(getByText('Bench Press')).toBeInTheDocument();
  });

  it('shows an equipment picker with 4 options for a weight-type exercise', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    expect(getByText('Barbell')).toBeInTheDocument();
    expect(getByText('Dumbbell')).toBeInTheDocument();
    expect(getByText('Cable')).toBeInTheDocument();
    expect(getByText('Machine')).toBeInTheDocument();
  });

  it('does not show the equipment picker for bodyweight or time exercises', async () => {
    const { getByText, queryByText } = render(ExerciseEditor, {
      props: { exercises: bodyweightExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Push-up'));
    expect(queryByText('Barbell')).not.toBeInTheDocument();
  });

  it('logging a weight set with equipment selected shows the abbreviation on the chip', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Dumbbell'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('20×8 DB ✕')).toBeInTheDocument();
  });

  it('clicking a selected equipment pill again deselects it', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Dumbbell'));
    await fireEvent.click(getByText('Dumbbell'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('20×8 ✕')).toBeInTheDocument();
  });

  it('pre-fills equipment from the last logged set for that exercise', async () => {
    const allDays: Record<string, DayEntry> = {
      '2026-06-05': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [{ type: 'weight', weight: 80, reps: 8, equipment: 'barbell' }] }] },
    };
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, allDays, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('80×8 BB ✕')).toBeInTheDocument();
  });
});
