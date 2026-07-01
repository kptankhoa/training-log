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
