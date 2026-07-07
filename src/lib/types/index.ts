export type GruvboxColor = 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'aqua' | 'orange';

export interface TrainingTag {
  id: string;
  name: string;
  color: GruvboxColor;
  deleted: boolean;
}

export interface DayEntry {
  tags: string[];
  label: string;
  note: string;
  tasks?: string[]; // completed daily task ids for the day
  photos?: string[]; // Storage paths for progress photos taken this day
  exercises?: ExerciseEntry[];
  splitIds?: string[]; // splits selected for this day
}

export type ExerciseType = 'weight' | 'bodyweight' | 'time';
export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine';

export interface Exercise {
  id: string;
  name: string;
  deleted: boolean;
  splitIds?: string[]; // splits this exercise belongs to; empty/undefined = available for any split
  type?: ExerciseType; // undefined = 'weight' (every exercise created before this field existed)
  singleArm?: boolean; // only meaningful when type is 'weight'; purely descriptive
}

export type ExerciseSet =
  | { type?: 'weight'; weight: number; reps: number; equipment?: Equipment }
  | { type: 'bodyweight'; reps: number }
  | { type: 'time'; seconds: number };

// Every set logged before this feature shipped is a bare `{ weight, reps }`
// with no `type` field at all. Rather than migrating stored documents or
// force-casting legacy literals, `type` is optional specifically on the
// weight variant — `{ weight: 60, reps: 8 }` is a genuinely valid
// ExerciseSet with no cast needed, so every existing test file's set
// literals across the codebase keep type-checking completely unmodified.
// Every newly logged set still always writes a real `type` explicitly; the
// optional case only ever matters for reading pre-existing history.
export function resolveSetType(set: ExerciseSet): ExerciseType {
  return set.type ?? 'weight';
}

// Compact display format for a logged set, shared by the set-logging chips
// (ExerciseEditor.svelte) and the read-only day summary (DaySplitsExercises.svelte)
// so the two formats can't drift apart. Narrows on `set.type` directly
// (rather than switching on resolveSetType's return value) so each branch
// gets real property access with no casts.
const EQUIPMENT_ABBR: Record<Equipment, string> = {
  barbell: 'BB',
  dumbbell: 'DB',
  cable: 'CB',
  machine: 'MC',
};

export function formatSet(set: ExerciseSet): string {
  if (set.type === 'bodyweight') return `×${set.reps}`;
  if (set.type === 'time') return `${set.seconds}s`;
  const base = `${set.weight}×${set.reps}`; // 'weight', or legacy data with no type field at all
  return set.equipment ? `${base} ${EQUIPMENT_ABBR[set.equipment]}` : base;
}

export interface ExerciseEntry {
  exerciseId: string;
  sets: ExerciseSet[];
}

export interface DailyTask {
  id: string;
  name: string;
  deleted: boolean;
}

export interface Split {
  id: string;
  label: string;
  sortOrder: number;
  content: string;
  color: GruvboxColor;
}

export interface BodyMeasurement {
  id: string; // date key YYYY-MM-DD
  weight: number;
  muscleMass: number;
  fatMass: number;
  bfp: number;
  score: number;
}

export interface BodyMeasurementEntry {
  id: string; // date key YYYY-MM-DD
  weight?: number;
  chest?: number;
  waist?: number;
  handles?: number;
  hip?: number;
  armL?: number;
  forearmL?: number;
  armR?: number;
  forearmR?: number;
  thighL?: number;
  thighR?: number;
  calfL?: number;
  calfR?: number;
}
