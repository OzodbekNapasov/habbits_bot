import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseData, User, Habit } from './types';
import { getTursoClient } from './turso';

function getDbPath(): string {
  if (process.env.VERCEL === '1') {
    return path.join('/tmp', 'db.json');
  }
  return path.join(process.cwd(), 'db.json');
}

let cachedDb: DatabaseData | null = null;

/**
 * Reads database contents from db.json file using native fs module.
 */
function readDb(): DatabaseData {
  if (cachedDb) {
    return cachedDb;
  }
  const dbPath = getDbPath();
  try {
    if (!fs.existsSync(dbPath)) {
      let initialData: DatabaseData = { users: [] };
      const rootDbPath = path.join(process.cwd(), 'db.json');
      if (fs.existsSync(rootDbPath)) {
        try {
          const raw = fs.readFileSync(rootDbPath, 'utf-8');
          initialData = JSON.parse(raw);
        } catch {
          initialData = { users: [] };
        }
      }
      fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf-8');
      cachedDb = initialData;
      return initialData;
    }
    const rawData = fs.readFileSync(dbPath, 'utf-8');
    cachedDb = JSON.parse(rawData) as DatabaseData;
    return cachedDb;
  } catch (error) {
    console.error('db.json o\'qishda xatolik yuz berdi:', error);
    return { users: [] };
  }
}

/**
 * Writes database data back to db.json file using native fs module.
 */
function writeDb(data: DatabaseData): void {
  cachedDb = data;
  const dbPath = getDbPath();
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
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
    const [usersResult, habitsResult] = await Promise.all([
      client.execute('SELECT * FROM users'),
      client.execute('SELECT * FROM habits')
    ]);

    const usersMap = new Map<number, User>();

    const currentDb = readDb();
    const existingStatesMap = new Map<number, any>();
    currentDb.users.forEach((u) => {
      if (u.creationState) existingStatesMap.set(u.id, u.creationState);
    });

    for (const row of usersResult.rows) {
      const id = Number(row.id);
      const firstName = String(row.first_name);
      const notificationsEnabled = row.notifications_enabled === 1 || row.notifications_enabled === true;
      
      let creationState: any = creationStateMap.get(id) || existingStatesMap.get(id) || null;
      if (row.creation_state) {
        try {
          creationState = JSON.parse(String(row.creation_state));
        } catch {
          // ignore
        }
      }

      usersMap.set(id, {
        id,
        firstName,
        notificationsEnabled,
        creationState,
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
export async function saveUser(userData: { id: number; firstName: string }): Promise<User> {
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
    try {
      await client.execute({
        sql: `INSERT INTO users (id, first_name, notifications_enabled) VALUES (?, ?, 1)
              ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name`,
        args: [userData.id, userData.firstName],
      });
    } catch (err: any) {
      console.error('Turso saveUser error:', err);
    }
  }

  return user;
}

/**
 * Adds a new habit to Turso SQL DB and local db.json.
 */
export async function addHabit(
  userId: number,
  habitData: Omit<Habit, 'id'>
): Promise<Habit | null> {
  const db = readDb();
  let user = db.users.find((u) => u.id === userId);

  if (!user) {
    user = {
      id: userId,
      firstName: 'Foydalanuvchi',
      notificationsEnabled: true,
      habits: [],
    };
    db.users.push(user);
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
    try {
      await client.execute({
        sql: `INSERT INTO users (id, first_name, notifications_enabled) VALUES (?, ?, 1)
              ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name`,
        args: [userId, 'Foydalanuvchi'],
      });

      await client.execute({
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
      });
    } catch (err: any) {
      console.error('Turso addHabit error:', err);
    }
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
export async function deleteHabit(userId: number, habitId: string): Promise<boolean> {
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
      try {
        await client.execute({
          sql: `DELETE FROM habits WHERE id = ? AND user_id = ?`,
          args: [habitId, userId],
        });
      } catch (err: any) {
        console.error('Turso deleteHabit error:', err);
      }
    }

    return true;
  }

  return false;
}

/**
 * Toggles notification settings for a user in Turso SQL DB and local db.json.
 */
export async function toggleUserNotifications(userId: number): Promise<boolean> {
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
    try {
      await client.execute({
        sql: `UPDATE users SET notifications_enabled = ? WHERE id = ?`,
        args: [user.notificationsEnabled ? 1 : 0, userId],
      });
    } catch (err: any) {
      console.error('Turso toggleUserNotifications error:', err);
    }
  }

  return user.notificationsEnabled;
}

/**
 * Clears all habits for a user in Turso SQL DB and local db.json.
 */
export async function clearUserHabits(userId: number): Promise<boolean> {
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
    try {
      await client.execute({
        sql: `DELETE FROM habits WHERE user_id = ?`,
        args: [userId],
      });
    } catch (err: any) {
      console.error('Turso clearUserHabits error:', err);
    }
  }

  return true;
}

/**
 * Updates a habit in Turso SQL DB and local db.json.
 */
export async function updateHabit(
  userId: number,
  habitId: string,
  updates: Partial<Omit<Habit, 'id'>>
): Promise<Habit | null> {
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
      try {
        await client.execute({
          sql: `UPDATE habits SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
          args,
        });
      } catch (err: any) {
        console.error('Turso updateHabit error:', err);
      }
    }
  }

  return habit;
}

const creationStateMap = new Map<number, any>();

/**
 * Gets user creation state from database
 */
export async function getUserCreationState(userId: number): Promise<any> {
  const inMemoryState = creationStateMap.get(userId);
  if (inMemoryState !== undefined) {
    return inMemoryState;
  }

  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  const state = user ? user.creationState || null : null;
  if (state !== null) {
    creationStateMap.set(userId, state);
  }
  return state;
}

/**
 * Sets user creation state in database (creates user if not exists)
 */
export async function setUserCreationState(userId: number, state: any): Promise<void> {
  if (state === null || state === undefined) {
    creationStateMap.delete(userId);
  } else {
    creationStateMap.set(userId, state);
  }

  const db = readDb();
  let user = db.users.find((u) => u.id === userId);
  if (!user) {
    user = {
      id: userId,
      firstName: 'Foydalanuvchi',
      notificationsEnabled: true,
      habits: [],
      creationState: state,
    };
    db.users.push(user);
  } else {
    user.creationState = state;
  }
  writeDb(db);

  // Sync state immediately to Turso cloud database for serverless persistence
  const client = getTursoClient();
  if (client) {
    try {
      await client.execute({
        sql: `UPDATE users SET creation_state = ? WHERE id = ?`,
        args: [state ? JSON.stringify(state) : null, userId],
      });
    } catch (err: any) {
      console.error('Turso setUserCreationState error:', err);
    }
  }
}

