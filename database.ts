import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseData, User, Habit } from './types';
import { getTursoClient } from './turso';

const DB_PATH = path.join(process.cwd(), 'db.json');

/**
 * Reads database contents from db.json file using native fs module.
 */
function readDb(): DatabaseData {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initialData: DatabaseData = { users: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const rawData = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(rawData) as DatabaseData;
  } catch (error) {
    console.error('db.json o\'qishda xatolik yuz berdi:', error);
    return { users: [] };
  }
}

/**
 * Writes database data back to db.json file using native fs module.
 */
function writeDb(data: DatabaseData): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('db.json ga yozishda xatolik yuz berdi:', error);
  }
}

/**
 * Loads all users and habits from Turso cloud database into local db.json
 */
export async function loadFromTurso(): Promise<void> {
  const client = getTursoClient();
  if (!client) return;

  try {
    const usersResult = await client.execute('SELECT * FROM users');
    const habitsResult = await client.execute('SELECT * FROM habits');

    const usersMap = new Map<number, User>();

    for (const row of usersResult.rows) {
      const id = Number(row.id);
      const firstName = String(row.first_name);
      const notificationsEnabled = row.notifications_enabled === 1 || row.notifications_enabled === true;

      usersMap.set(id, {
        id,
        firstName,
        notificationsEnabled,
        habits: [],
      });
    }

    for (const row of habitsResult.rows) {
      const userId = Number(row.user_id);
      const user = usersMap.get(userId);

      if (user) {
        let restDays: string[] = [];
        if (row.rest_days) {
          try {
            restDays = JSON.parse(String(row.rest_days));
          } catch {
            restDays = [];
          }
        }

        const habit: Habit = {
          id: String(row.id),
          name: String(row.name),
          intervalType: String(row.interval_type) as any,
          customIntervalDays: row.custom_interval_days ? Number(row.custom_interval_days) : undefined,
          intervalDescription: row.interval_description ? String(row.interval_description) : undefined,
          startDate: row.start_date ? String(row.start_date) : undefined,
          restDays,
          targetTime: String(row.target_time),
          lastCompletedAt: row.last_completed_at ? String(row.last_completed_at) : null,
          nextDueDate: String(row.next_due_date),
          lastNotifiedDueDate: row.last_notified_due_date ? String(row.last_notified_due_date) : undefined,
        };

        user.habits.push(habit);
      }
    }

    const loadedUsers = Array.from(usersMap.values());
    writeDb({ users: loadedUsers });
    console.log(`📥 Turso bulut bazasidan ${loadedUsers.length} ta foydalanuvchi ma'lumotlari muvaffaqiyatli yuklandi!`);
  } catch (error) {
    console.error('❌ Turso bazasidan yuklashda xatolik:', error);
  }
}

/**
 * Retrieves all users from db.json.
 */
export function getUsers(): User[] {
  const db = readDb();
  return db.users;
}

/**
 * Finds a user and a specific habit by habitId.
 */
export function findHabitById(habitId: string): { user: User; habit: Habit } | null {
  const db = readDb();
  for (const user of db.users) {
    const habit = user.habits.find((h) => h.id === habitId);
    if (habit) {
      return { user, habit };
    }
  }
  return null;
}

/**
 * Retrieves a user by their Telegram ID.
 */
export function getUser(userId: number): User | undefined {
  const db = readDb();
  return db.users.find((u) => u.id === userId);
}

/**
 * Saves or updates user information in Turso SQL DB and local db.json.
 */
export function saveUser(userData: { id: number; firstName: string }): User {
  const db = readDb();
  const existingUserIndex = db.users.findIndex((u) => u.id === userData.id);

  let user: User;
  if (existingUserIndex !== -1) {
    db.users[existingUserIndex].firstName = userData.firstName;
    user = db.users[existingUserIndex];
  } else {
    const newUser: User = {
      id: userData.id,
      firstName: userData.firstName,
      notificationsEnabled: true,
      habits: [],
    };
    db.users.push(newUser);
    user = newUser;
  }
  writeDb(db);

  // Turso SQL execution
  const client = getTursoClient();
  if (client) {
    client.execute({
      sql: `INSERT INTO users (id, first_name, notifications_enabled) VALUES (?, ?, 1)
            ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name`,
      args: [userData.id, userData.firstName],
    }).catch((err: any) => console.error('Turso error:', err));
  }

  return user;
}

/**
 * Adds a new habit to Turso SQL DB and local db.json.
 */
export function addHabit(
  userId: number,
  habitData: Omit<Habit, 'id'>
): Habit | null {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);

  if (!user) {
    return null;
  }

  const newHabit: Habit = {
    id: crypto.randomUUID(),
    ...habitData,
  };

  user.habits.push(newHabit);
  writeDb(db);

  // Turso SQL execution
  const client = getTursoClient();
  if (client) {
    client.execute({
      sql: `INSERT INTO habits (id, user_id, name, interval_type, custom_interval_days, interval_description, start_date, rest_days, target_time, last_completed_at, next_due_date, last_notified_due_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newHabit.id,
        userId,
        newHabit.name,
        newHabit.intervalType,
        newHabit.customIntervalDays || null,
        newHabit.intervalDescription || null,
        newHabit.startDate || null,
        JSON.stringify(newHabit.restDays || []),
        newHabit.targetTime,
        newHabit.lastCompletedAt || null,
        newHabit.nextDueDate,
        newHabit.lastNotifiedDueDate || null,
      ],
    }).catch((err: any) => console.error('Turso addHabit error:', err));
  }

  return newHabit;
}

/**
 * Retrieves all habits for a specific user.
 */
export function getHabits(userId: number): Habit[] {
  const user = getUser(userId);
  return user ? user.habits : [];
}

/**
 * Deletes a specific habit from Turso SQL DB and local db.json.
 */
export function deleteHabit(userId: number, habitId: string): boolean {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);

  if (!user) {
    return false;
  }

  const initialLength = user.habits.length;
  user.habits = user.habits.filter((h) => h.id !== habitId);

  if (user.habits.length < initialLength) {
    writeDb(db);

    // Turso SQL execution
    const client = getTursoClient();
    if (client) {
      client.execute({
        sql: `DELETE FROM habits WHERE id = ? AND user_id = ?`,
        args: [habitId, userId],
      }).catch((err: any) => console.error('Turso deleteHabit error:', err));
    }

    return true;
  }

  return false;
}

/**
 * Toggles notification settings for a user in Turso SQL DB and local db.json.
 */
export function toggleUserNotifications(userId: number): boolean {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);

  if (!user) {
    return false;
  }

  user.notificationsEnabled = user.notificationsEnabled === undefined ? false : !user.notificationsEnabled;
  writeDb(db);

  // Turso SQL execution
  const client = getTursoClient();
  if (client) {
    client.execute({
      sql: `UPDATE users SET notifications_enabled = ? WHERE id = ?`,
      args: [user.notificationsEnabled ? 1 : 0, userId],
    }).catch((err: any) => console.error('Turso toggleUserNotifications error:', err));
  }

  return user.notificationsEnabled;
}

/**
 * Clears all habits for a user in Turso SQL DB and local db.json.
 */
export function clearUserHabits(userId: number): boolean {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);

  if (!user) {
    return false;
  }

  user.habits = [];
  writeDb(db);

  // Turso SQL execution
  const client = getTursoClient();
  if (client) {
    client.execute({
      sql: `DELETE FROM habits WHERE user_id = ?`,
      args: [userId],
    }).catch((err: any) => console.error('Turso clearUserHabits error:', err));
  }

  return true;
}

/**
 * Updates a habit in Turso SQL DB and local db.json.
 */
export function updateHabit(
  userId: number,
  habitId: string,
  updates: Partial<Omit<Habit, 'id'>>
): Habit | null {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);

  if (!user) {
    return null;
  }

  const habit = user.habits.find((h) => h.id === habitId);
  if (!habit) {
    return null;
  }

  Object.assign(habit, updates);
  writeDb(db);

  // Turso SQL execution
  const client = getTursoClient();
  if (client) {
    const setClauses: string[] = [];
    const args: any[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      args.push(updates.name);
    }
    if (updates.targetTime !== undefined) {
      setClauses.push('target_time = ?');
      args.push(updates.targetTime);
    }
    if (updates.lastCompletedAt !== undefined) {
      setClauses.push('last_completed_at = ?');
      args.push(updates.lastCompletedAt || null);
    }
    if (updates.nextDueDate !== undefined) {
      setClauses.push('next_due_date = ?');
      args.push(updates.nextDueDate);
    }
    if (updates.lastNotifiedDueDate !== undefined) {
      setClauses.push('last_notified_due_date = ?');
      args.push(updates.lastNotifiedDueDate || null);
    }

    if (setClauses.length > 0) {
      args.push(habitId, userId);
      client
        .execute({
          sql: `UPDATE habits SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
          args,
        })
        .catch((err: any) => console.error('Turso updateHabit error:', err));
    }
  }

  return habit;
}

/**
 * Gets user creation state from database
 */
export function getUserCreationState(userId: number): any {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  return user ? user.creationState || null : null;
}

/**
 * Sets user creation state in database
 */
export function setUserCreationState(userId: number, state: any): void {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.creationState = state;
    writeDb(db);
  }
}

