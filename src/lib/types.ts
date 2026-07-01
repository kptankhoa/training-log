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

export interface Exercise {
  id: string;
  name: string;
  deleted: boolean;
  splitIds?: string[]; // splits this exercise belongs to; empty/undefined = available for any split
}

export interface ExerciseSet {
  weight: number;
  reps: number;
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

export interface PlanNote {
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
