import { bot } from '../index';
import { loadFromGitHub, getHabits, getUsers, updateHabit, findHabitById } from '../database';
import { getUzbekistanDate, getTodayDateString, calculateNextDueDateAfterCompletion } from '../utils';
import fs from 'fs';
import path from 'path';

let isInitialized = false;

async function ensureInitialized() {
  const isVercel = process.env.VERCEL === '1';

  if (isVercel || !isInitialized) {
    const dbPath = isVercel ? path.join('/tmp', 'db.json') : path.join(process.cwd(), 'db.json');
    if (!fs.existsSync(dbPath) || isVercel) {
      try {
        await loadFromGitHub();
      } catch (err) {
        console.error('GitHub load error:', err);
      }
    }
    isInitialized = true;
  }
}

export default async function handler(req: any, res: any) {
  const reqUrl = req.url || '/';
  const parsedUrl = new URL(reqUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // Serve API Endpoint: /api/cron
  if (pathname === '/api/cron' && req.method === 'GET') {
    await ensureInitialized();
    try {
      const { runReminderCheck } = require('../cron');
      await runReminderCheck(bot);
      return res.status(200).send('Cron reminder check completed successfully!');
    } catch (err: any) {
      console.error('Cron check error:', err);
      return res.status(500).send(`Cron check error: ${err.message}`);
    }
  }

  // Serve API Endpoint: /api/habits
  if (pathname === '/api/habits' && req.method === 'GET') {
    await ensureInitialized();
    const userIdParam = parsedUrl.searchParams.get('userId');
    let habits: any[] = [];

    if (userIdParam) {
      const userId = parseInt(userIdParam, 10);
      habits = getHabits(userId);
    } else {
      const users = getUsers();
      habits = users.length > 0 ? users[0].habits : [];
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ habits });
  }

  // Serve API Endpoint: /api/habits/done
  if (pathname === '/api/habits/done' && req.method === 'POST') {
    await ensureInitialized();
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }
    const { userId, habitId } = body;
    if (!userId || !habitId) {
      return res.status(400).json({ error: 'Missing userId or habitId' });
    }

    const uId = parseInt(userId, 10);
    const habitInfo = findHabitById(habitId);
    if (!habitInfo) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const { habit } = habitInfo;
    const now = getUzbekistanDate();
    const todayStr = getTodayDateString(now);
    const nextDueDate = calculateNextDueDateAfterCompletion(
      habit.intervalType,
      habit.targetTime,
      now,
      habit.restDays,
      habit.customIntervalDays
    );

    await updateHabit(uId, habitId, {
      lastCompletedAt: todayStr,
      nextDueDate,
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, nextDueDate });
  }

  // Serve API Endpoint: /api/habits/skip
  if (pathname === '/api/habits/skip' && req.method === 'POST') {
    await ensureInitialized();
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }
    const { userId, habitId } = body;
    if (!userId || !habitId) {
      return res.status(400).json({ error: 'Missing userId or habitId' });
    }

    const uId = parseInt(userId, 10);
    const habitInfo = findHabitById(habitId);
    if (!habitInfo) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const { habit } = habitInfo;
    const now = getUzbekistanDate();
    const nextDueDate = calculateNextDueDateAfterCompletion(
      habit.intervalType,
      habit.targetTime,
      now,
      habit.restDays,
      habit.customIntervalDays
    );

    await updateHabit(uId, habitId, { nextDueDate });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, nextDueDate });
  }

  // If request is GET (e.g. Mini App UI page view), serve public/index.html
  if (req.method === 'GET') {
    const indexPath = path.join(process.cwd(), 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(content);
    }
    return res.status(200).send('🤖 Telegram Odatlar Boti (Telegraf) 24/7 muvaffaqiyatli ishlamoqda!');
  }

  if (req.method === 'POST') {
    try {
      await ensureInitialized();
      await bot.handleUpdate(req.body, res);
    } catch (err: any) {
      console.error('Vercel bot execution error:', err);
      if (!res.headersSent) {
        res.status(200).send('OK');
      }
    }
  } else {
    res.status(200).send('OK');
  }
}
