import dotenv from 'dotenv';
import { getUsers } from './database';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'libsql://habbits-ozodbek.aws-ap-northeast-1.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

export const isTursoEnabled = Boolean(url && authToken);

let tursoClient: any = null;

if (isTursoEnabled) {
  try {
    // Safely load @libsql/client if installed
    const { createClient } = require('@libsql/client');
    tursoClient = createClient({
      url,
      authToken,
    });
    console.log('📡 Turso libSQL bulut bazasiga ulanish sozlandi!');
  } catch (err) {
    console.log("ℹ️ @libsql/client moduli hali o'rnatilmagan, mahalliy db.json ishlatilmoqda.");
    tursoClient = null;
  }
}

export function getTursoClient(): any {
  return tursoClient;
}

/**
 * Initializes Turso tables if configured and syncs local data to Turso
 */
export async function initTursoTables(): Promise<boolean> {
  if (!tursoClient) return false;

  try {
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        first_name TEXT NOT NULL,
        notifications_enabled INTEGER DEFAULT 1,
        creation_state TEXT
      );
    `);

    try {
      await tursoClient.execute(`ALTER TABLE users ADD COLUMN creation_state TEXT`);
    } catch {
      // Column may already exist
    }

    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        interval_type TEXT NOT NULL,
        custom_interval_days INTEGER,
        interval_description TEXT,
        start_date TEXT,
        rest_days TEXT,
        target_time TEXT NOT NULL,
        last_completed_at TEXT,
        next_due_date TEXT NOT NULL,
        last_notified_due_date TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `);

    console.log('✅ Turso libSQL jadvallari muvaffaqiyatli tayyorlandi!');
    await syncLocalDbToTurso();
    return true;
  } catch (error) {
    console.error('❌ Turso jadvallarini yaratishda xatolik:', error);
    return false;
  }
}

/**
 * Migrates local db.json data into Turso database
 */
export async function syncLocalDbToTurso(): Promise<void> {
  if (!tursoClient) return;

  try {
    const localUsers = getUsers();

    for (const user of localUsers) {
      await tursoClient.execute({
        sql: `INSERT INTO users (id, first_name, notifications_enabled, creation_state) VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, notifications_enabled = excluded.notifications_enabled, creation_state = excluded.creation_state`,
        args: [
          user.id,
          user.firstName,
          user.notificationsEnabled !== false ? 1 : 0,
          user.creationState ? JSON.stringify(user.creationState) : null,
        ],
      });

      for (const habit of user.habits) {
        await tursoClient.execute({
          sql: `INSERT INTO habits (id, user_id, name, interval_type, custom_interval_days, interval_description, start_date, rest_days, target_time, last_completed_at, next_due_date, last_notified_due_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  interval_type = excluded.interval_type,
                  custom_interval_days = excluded.custom_interval_days,
                  interval_description = excluded.interval_description,
                  start_date = excluded.start_date,
                  rest_days = excluded.rest_days,
                  target_time = excluded.target_time,
                  last_completed_at = excluded.last_completed_at,
                  next_due_date = excluded.next_due_date,
                  last_notified_due_date = excluded.last_notified_due_date`,
          args: [
            habit.id,
            user.id,
            habit.name,
            habit.intervalType,
            habit.customIntervalDays || null,
            habit.intervalDescription || null,
            habit.startDate || null,
            JSON.stringify(habit.restDays || []),
            habit.targetTime,
            habit.lastCompletedAt || null,
            habit.nextDueDate,
            habit.lastNotifiedDueDate || null,
          ],
        });
      }
    }

    console.log('🔄 Barcha mahalliy ma\'lumotlar Turso bulut bazasiga muvaffaqiyatli saqlandi!');
  } catch (error) {
    console.error('❌ Turso sinxronizatsiya xatoligi:', error);
  }
}
