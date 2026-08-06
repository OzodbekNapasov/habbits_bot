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
  lastCompletedAt?: string | null;
  nextDueDate: string; // YYYY-MM-DD
  lastNotifiedDueDate?: string;
  /** Number of consecutive scheduled days completed without a miss */
  streak?: number;
  /** List of YYYY-MM-DD dates the habit was marked as done */
  completionHistory?: string[];
  /** Pending re-notification times for today e.g. ['20:10','20:20','20:30'] */
  pendingReminderTimes?: string[];
  /** Flag indicating if habit is a medication/dori reminder */
  isMedication?: boolean;
}

export interface User {
  id: number;
  firstName: string;
  notificationsEnabled?: boolean; // default true
  creationState?: any;
  habits: Habit[];
}

export interface DatabaseData {
  users: User[];
}
