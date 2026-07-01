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
}

export interface PlanNote {
  id: string;
  label: string;
  sortOrder: number;
  content: string;
  color: GruvboxColor;
}
