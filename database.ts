import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseData, User, Habit } from './types';
import { fetchDbFromGitHub, saveDbToGitHub } from './github';

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
 * Loads all users and habits from GitHub repository into local db.json
 */
export async function loadFromGitHub(): Promise<void> {
  const fetched = await fetchDbFromGitHub();
  if (fetched) {
    try {
      const data = JSON.parse(fetched.content) as DatabaseData;
      writeDb(data);
      console.log(`📥 GitHub'dan database muvaffaqiyatli yuklandi! (${data.users?.length || 0} ta foydalanuvchi)`);
    } catch (err) {
      console.error('Error parsing db.json from GitHub:', err);
    }
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
  await saveDbToGitHub(JSON.stringify(db, null, 2));
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
  await saveDbToGitHub(JSON.stringify(db, null, 2));
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
    await saveDbToGitHub(JSON.stringify(db, null, 2));
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
  await saveDbToGitHub(JSON.stringify(db, null, 2));
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
  await saveDbToGitHub(JSON.stringify(db, null, 2));
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
  await saveDbToGitHub(JSON.stringify(db, null, 2));
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
  await saveDbToGitHub(JSON.stringify(db, null, 2));
}

