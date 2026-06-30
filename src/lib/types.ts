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
