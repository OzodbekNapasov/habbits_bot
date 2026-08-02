import { Habit, IntervalType } from './types';

/**
 * Escapes special HTML characters for Telegram HTML parse_mode
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Returns a human-friendly Uzbek interval label (e.g. "Har kuni", "Har 20 kunda", "Har haftada").
 */
export function getPrettyIntervalName(habit: Habit): string {
  if (habit.intervalDescription && habit.intervalDescription.trim()) {
    return habit.intervalDescription.trim();
  }
  switch (habit.intervalType) {
    case 'kunlik':
      return 'Har kuni';
    case 'haftalik':
      return 'Har haftada (7 kunda)';
    case '2_haftalik':
      return 'Har 2 haftada (14 kunda)';
    case 'oylik':
      return 'Har oyda (1 marta)';
    case 'custom':
      return habit.customIntervalDays ? `Har ${habit.customIntervalDays} kunda` : 'Maxsus oraliqda';
    default:
      return 'Har kuni';
  }
}

export const WEEKDAYS_MAP: Record<number, string> = {
  1: 'Dushanba',
  2: 'Seshanba',
  3: 'Chorshanba',
  4: 'Payshanba',
  5: 'Juma',
  6: 'Shanba',
  0: 'Yakshanba',
};

/**
 * Validates HH:mm time format (e.g., "09:00", "21:30").
 */
export function isValidTimeFormat(timeStr: string): boolean {
  const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(timeStr.trim());
}

/**
 * Validates YYYY-MM-DD date format (e.g., "2026-08-10").
 */
export function isValidDateFormat(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr.trim())) return false;
  const date = new Date(`${dateStr.trim()}T00:00:00`);
  return !isNaN(date.getTime());
}

/**
 * Formats a Date object as YYYY-MM-DD HH:mm string in +05:00 / local time.
 */
export function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export const UZBEK_MONTHS_MAP: Record<number, string> = {
  1: 'yanvar',
  2: 'fevral',
  3: 'mart',
  4: 'aprel',
  5: 'may',
  6: 'iyun',
  7: 'iyul',
  8: 'avgust',
  9: 'sentabr',
  10: 'oktabr',
  11: 'noyabr',
  12: 'dekabr',
};

/**
 * Formats a Date string YYYY-MM-DD to Uzbek format (e.g., "22-avgust 2026-yil (Shanba)").
 */
export function formatDateUzbek(dateStr: string, includeWeekday: boolean = true): string {
  if (!dateStr || !dateStr.trim()) return dateStr;
  const cleanStr = dateStr.trim().split(' ')[0]; // Handle YYYY-MM-DD HH:mm if passed
  const parts = cleanStr.split('-');
  if (parts.length < 3) return dateStr;

  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  const dayNum = parseInt(parts[2], 10);

  const monthName = UZBEK_MONTHS_MAP[monthNum] || parts[1];
  const formattedText = `${dayNum}-${monthName} ${year}-yil`;

  if (!includeWeekday) {
    return formattedText;
  }

  const date = new Date(`${cleanStr}T00:00:00`);
  if (isNaN(date.getTime())) return formattedText;

  const weekday = WEEKDAYS_MAP[date.getDay()] || '';
  return `${formattedText} (${weekday})`;
}

/**
 * Calculates remaining days from today until target nextDueDate (YYYY-MM-DD).
 * Returns Uzbek human-readable text e.g., "Bugun 🔥", "Ertaga (1 kun qoldi)", "20 kun qoldi".
 */
export function getDaysRemainingText(nextDueDateStr: string): string {
  if (!nextDueDateStr || !nextDueDateStr.trim()) return '';

  const cleanStr = nextDueDateStr.trim().split(' ')[0];
  const targetDate = new Date(`${cleanStr}T00:00:00`);
  if (isNaN(targetDate.getTime())) return '';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const diffMs = targetDate.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 'Bugun 🔥';
  } else if (diffDays === 1) {
    return 'Ertaga (1 kun qoldi)';
  } else {
    return `${diffDays} kun qoldi`;
  }
}

/**
 * Determines whether a habit is scheduled to occur on a specific target date (YYYY-MM-DD).
 */
export function isHabitScheduledOnDate(habit: Habit, targetDateStr: string): boolean {
  const targetClean = targetDateStr.trim().split(' ')[0];
  const targetDate = new Date(`${targetClean}T00:00:00`);
  if (isNaN(targetDate.getTime())) return false;

  const startClean = (habit.startDate || habit.nextDueDate).trim().split(' ')[0];
  const startDate = new Date(`${startClean}T00:00:00`);
  if (isNaN(startDate.getTime())) return false;

  // Cannot occur before start date
  if (targetDate.getTime() < startDate.getTime()) {
    return false;
  }

  // Check if target date is a rest day
  const targetWeekdayName = WEEKDAYS_MAP[targetDate.getDay()];
  if (habit.restDays && habit.restDays.includes(targetWeekdayName)) {
    return false;
  }

  // Exact nextDueDate match always returns true
  if (habit.nextDueDate.trim() === targetClean) {
    return true;
  }

  const diffMs = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  switch (habit.intervalType) {
    case 'kunlik':
      return true;

    case 'haftalik':
      return diffDays % 7 === 0;

    case '2_haftalik':
      return diffDays % 14 === 0;

    case 'oylik':
      return targetDate.getDate() === startDate.getDate();

    case 'custom':
      const step = habit.customIntervalDays && habit.customIntervalDays > 0 ? habit.customIntervalDays : 1;
      return diffDays % step === 0;

    default:
      return habit.nextDueDate.trim() === targetClean;
  }
}

/**
 * Gets the 7 days (Monday to Sunday) for any week offset (0 = current week, 1 = next week, -1 = previous week).
 */
export function getWeekDaysByOffset(offset: number = 0): {
  startDateUz: string;
  endDateUz: string;
  days: { dateStr: string; weekdayName: string; formattedDateUz: string }[];
} {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Distance to Monday of current week (if Sunday (0), distance is -6 days)
  const distToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek) + offset * 7;

  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + distToMonday);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateStr = formatDateOnly(day);
    const weekdayName = WEEKDAYS_MAP[day.getDay()];
    const formattedDateUz = formatDateUzbek(dateStr, false);

    days.push({
      dateStr,
      weekdayName,
      formattedDateUz,
    });
  }

  const startDateUz = days[0].formattedDateUz;
  const endDateUz = days[6].formattedDateUz;

  return {
    startDateUz,
    endDateUz,
    days,
  };
}

/**
 * Gets the 7 days of the current week (Monday to Sunday) with dates and Uzbek names.
 */
export function getCurrentWeekDays(): { dateStr: string; weekdayName: string; formattedDateUz: string }[] {
  return getWeekDaysByOffset(0).days;
}

/**
 * Formats a Date string YYYY-MM-DD to include Uzbek weekday name (e.g. "22-avgust 2026-yil (Shanba)").
 */
export function formatDateWithWeekday(dateStr: string): string {
  return formatDateUzbek(dateStr, true);
}

/**
 * Gets current time formatted as HH:mm.
 */
export function getCurrentTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Gets time N minutes into the future relative to a given HH:mm time string.
 */
export function addMinutesToTime(targetTimeStr: string, minutesToAdd: number): string {
  const [hoursStr, minutesStr] = targetTimeStr.trim().split(':');
  const hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setTime(date.getTime() + minutesToAdd * 60 * 1000);

  const newHours = String(date.getHours()).padStart(2, '0');
  const newMinutes = String(date.getMinutes()).padStart(2, '0');

  return `${newHours}:${newMinutes}`;
}

/**
 * Gets time 1 hour into the future formatted as HH:mm.
 */
export function getOneHourLaterTime(date: Date = new Date()): string {
  const future = new Date(date.getTime() + 60 * 60 * 1000);
  const hours = String(future.getHours()).padStart(2, '0');
  const minutes = String(future.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Formats a Date object as Date string only (YYYY-MM-DD).
 */
export function formatDateOnly(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date string formatted as YYYY-MM-DD.
 */
export function getTodayDateString(date: Date = new Date()): string {
  return formatDateOnly(date);
}

/**
 * Gets tomorrow's date string formatted as YYYY-MM-DD.
 */
export function getTomorrowDateString(date: Date = new Date()): string {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateOnly(tomorrow);
}

/**
 * Checks if a given nextDueDate string (YYYY-MM-DD) matches today's date.
 */
export function isHabitForToday(nextDueDate: string, todayStr: string = getTodayDateString()): boolean {
  return nextDueDate.trim() === todayStr.trim();
}

/**
 * Checks if a nextDueDate string (YYYY-MM-DD) falls within the next N days starting from today.
 */
export function isHabitInNextDays(nextDueDate: string, days: number = 7): boolean {
  const habitDate = new Date(`${nextDueDate.trim()}T00:00:00`);
  if (isNaN(habitDate.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const futureEnd = new Date(todayStart);
  futureEnd.setDate(futureEnd.getDate() + days);
  futureEnd.setHours(23, 59, 59, 999);

  return habitDate >= todayStart && habitDate <= futureEnd;
}

/**
 * Adjusts candidate date to skip selected restDays if any.
 */
export function adjustDateForRestDays(candidate: Date, restDays?: string[]): Date {
  if (!restDays || restDays.length === 0) return candidate;

  // Max 7 iterations to avoid infinite loop if all days were rest days
  let count = 0;
  while (count < 7 && restDays.includes(WEEKDAYS_MAP[candidate.getDay()])) {
    candidate.setDate(candidate.getDate() + 1);
    count++;
  }

  return candidate;
}

/**
 * Calculates initial nextDueDate starting on or after a specified startDate (YYYY-MM-DD) based on intervalType.
 */
export function calculateNextDueDateFromStartDate(
  startDateStr: string,
  targetTime: string,
  intervalType: IntervalType = 'kunlik',
  restDays?: string[],
  customIntervalDays?: number
): string {
  const [hoursStr, minutesStr] = targetTime.trim().split(':');
  const targetHour = parseInt(hoursStr, 10) || 0;
  const targetMinute = parseInt(minutesStr, 10) || 0;

  const [yearStr, monthStr, dayStr] = startDateStr.trim().split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  let candidate = new Date(year, month, day, targetHour, targetMinute, 0);

  if (intervalType === 'kunlik') {
    const now = new Date();
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 1);
    }
  } else if (intervalType === 'haftalik') {
    candidate.setDate(candidate.getDate() + 7);
  } else if (intervalType === '2_haftalik') {
    candidate.setDate(candidate.getDate() + 14);
  } else if (intervalType === 'oylik') {
    candidate.setMonth(candidate.getMonth() + 1);
  } else if (intervalType === 'custom') {
    const daysToAdd = customIntervalDays && customIntervalDays > 0 ? customIntervalDays : 1;
    candidate.setDate(candidate.getDate() + daysToAdd);
  }

  candidate = adjustDateForRestDays(candidate, restDays);
  return formatDateOnly(candidate);
}

/**
 * Calculates next due date (YYYY-MM-DD without time) based on intervalType, targetTime, restDays, and optional customIntervalDays.
 */
export function calculateNextDueDate(
  intervalType: IntervalType,
  targetTime: string,
  restDays?: string[],
  customIntervalDays?: number
): string {
  const [hoursStr, minutesStr] = targetTime.trim().split(':');
  const targetHour = parseInt(hoursStr, 10);
  const targetMinute = parseInt(minutesStr, 10);

  const now = new Date();
  let candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute, 0);

  // If target time today has already passed, schedule for the next interval cycle
  if (candidate.getTime() <= now.getTime()) {
    switch (intervalType) {
      case 'kunlik':
        candidate.setDate(candidate.getDate() + 1);
        break;
      case 'haftalik':
        candidate.setDate(candidate.getDate() + 7);
        break;
      case '2_haftalik':
        candidate.setDate(candidate.getDate() + 14);
        break;
      case 'oylik':
        candidate.setMonth(candidate.getMonth() + 1);
        break;
      case 'custom':
        candidate.setDate(candidate.getDate() + (customIntervalDays && customIntervalDays > 0 ? customIntervalDays : 1));
        break;
    }
  }

  candidate = adjustDateForRestDays(candidate, restDays);
  return formatDateOnly(candidate);
}

/**
 * Calculates the next due date (YYYY-MM-DD without time) after a habit is marked as completed.
 */
export function calculateNextDueDateAfterCompletion(
  intervalType: IntervalType,
  targetTime: string,
  baseDate: Date = new Date(),
  restDays?: string[],
  customIntervalDays?: number
): string {
  const [hoursStr, minutesStr] = targetTime.trim().split(':');
  const targetHour = parseInt(hoursStr, 10);
  const targetMinute = parseInt(minutesStr, 10);

  let nextDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    targetHour,
    targetMinute,
    0
  );

  switch (intervalType) {
    case 'kunlik':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'haftalik':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case '2_haftalik':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'oylik':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'custom':
      nextDate.setDate(nextDate.getDate() + (customIntervalDays && customIntervalDays > 0 ? customIntervalDays : 1));
      break;
  }

  nextDate = adjustDateForRestDays(nextDate, restDays);
  return formatDateOnly(nextDate);
}

/**
 * Maps Uzbek button labels to IntervalType.
 */
export function mapLabelToIntervalType(label: string): IntervalType | null {
  switch (label.trim()) {
    case 'Har kuni':
    case 'Kunlik':
      return 'kunlik';
    case 'Har hafta':
    case 'Haftalik':
      return 'haftalik';
    case 'Har 2 haftada':
    case '2 haftalik':
      return '2_haftalik';
    case 'Har oy':
    case 'Oylik':
      return 'oylik';
    default:
      return null;
  }
}
