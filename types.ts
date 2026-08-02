export type IntervalType = 'kunlik' | 'haftalik' | '2_haftalik' | 'oylik' | 'custom';

export interface Habit {
  id: string;
  name: string;
  intervalType: IntervalType;
  customIntervalDays?: number;
  intervalDescription?: string;
  startDate?: string; // YYYY-MM-DD
  restDays?: string[];
  targetTime: string; // e.g., '16:00'
  lastCompletedAt: string | null;
  nextDueDate: string; // YYYY-MM-DD
  lastNotifiedDueDate?: string;
}

export interface User {
  id: number;
  firstName: string;
  notificationsEnabled?: boolean; // default true
  habits: Habit[];
}

export interface DatabaseData {
  users: User[];
}
