import { bot } from '../index';
import { loadFromGitHub, getHabits, getUsers, updateHabit, findHabitById, addHabit, deleteHabit, toggleUserNotifications, getUser, addCompletionRecord } from '../database';
import { getUzbekistanDate, getTodayDateString, calculateNextDueDateAfterCompletion, calculateNextDueDateFromStartDate, addMinutesToTime } from '../utils';
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
      pendingReminderTimes: [], // Clear pending re-notifications on completion
    });

    // Record completion and update streak
    await addCompletionRecord(uId, habitId, todayStr);

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

  // Serve API Endpoint: /api/habits/add
  if (pathname === '/api/habits/add' && req.method === 'POST') {
    await ensureInitialized();
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }
    const { userId, name, intervalType, customIntervalDays, intervalDescription, restDays, targetTime, startDate } = body;
    if (!userId || !name || !intervalType || !targetTime || !startDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const uId = parseInt(userId, 10);
    const nextDueDate = calculateNextDueDateFromStartDate(
      startDate,
      targetTime,
      intervalType,
      restDays || [],
      customIntervalDays
    );

    const habit = await addHabit(uId, {
      name,
      intervalType,
      customIntervalDays,
      intervalDescription,
      startDate,
      restDays: restDays || [],
      targetTime,
      lastCompletedAt: null,
      nextDueDate,
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (habit) {
      return res.status(200).json({ success: true, habit });
    } else {
      return res.status(500).json({ error: 'Failed to add habit' });
    }
  }

  // Serve API Endpoint: /api/habits/delete
  if (pathname === '/api/habits/delete' && req.method === 'POST') {
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
    await deleteHabit(uId, habitId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true });
  }

  // Serve API Endpoint: /api/habits/update
  if (pathname === '/api/habits/update' && req.method === 'POST') {
    await ensureInitialized();
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }
    const { userId, habitId, name, targetTime, intervalType, intervalDescription, restDays } = body;
    if (!userId || !habitId) {
      return res.status(400).json({ error: 'Missing userId or habitId' });
    }

    const uId = parseInt(userId, 10);
    const updates: any = {};
    if (name) updates.name = name;
    if (targetTime) updates.targetTime = targetTime;
    if (intervalType) updates.intervalType = intervalType;
    if (intervalDescription) updates.intervalDescription = intervalDescription;
    if (restDays) updates.restDays = restDays;

    const updated = await updateHabit(uId, habitId, updates);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (updated) {
      return res.status(200).json({ success: true, habit: updated });
    } else {
      return res.status(500).json({ error: 'Failed to update habit' });
    }
  }

  // Serve API Endpoint: /api/user/settings
  if (pathname === '/api/user/settings' && req.method === 'GET') {
    await ensureInitialized();
    const userIdParam = parsedUrl.searchParams.get('userId');
    if (!userIdParam) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const uId = parseInt(userIdParam, 10);
    const user = getUser(uId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ notificationsEnabled: user?.notificationsEnabled !== false });
  }

  // Serve API Endpoint: /api/user/settings/toggle
  if (pathname === '/api/user/settings/toggle' && req.method === 'POST') {
    await ensureInitialized();
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }
    const { userId } = body;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const uId = parseInt(userId, 10);
    await toggleUserNotifications(uId);
    const user = getUser(uId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, notificationsEnabled: user?.notificationsEnabled !== false });
  }

  // Serve API Endpoint: /api/habits/stats
  if (pathname === '/api/habits/stats' && req.method === 'GET') {
    await ensureInitialized();
    const userIdParam = parsedUrl.searchParams.get('userId');
    if (!userIdParam) return res.status(400).json({ error: 'Missing userId' });

    const uId = parseInt(userIdParam, 10);
    const habits = getHabits(uId);

    // Build last 30 days date list
    const now = getUzbekistanDate();
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }

    // Per-day: how many habits were completed vs scheduled
    const dailyStats = days.map((dateStr) => {
      const scheduled = habits.filter((h) => {
        const { isHabitScheduledOnDate } = require('../utils');
        return isHabitScheduledOnDate(h, dateStr);
      });
      const completed = scheduled.filter((h) =>
        h.completionHistory && h.completionHistory.includes(dateStr)
      );
      return {
        date: dateStr,
        scheduled: scheduled.length,
        completed: completed.length,
        percent: scheduled.length > 0 ? Math.round((completed.length / scheduled.length) * 100) : null,
      };
    });

    // Per-habit streak summary
    const habitStats = habits.map((h) => ({
      id: h.id,
      name: h.name,
      streak: h.streak || 0,
      totalCompleted: (h.completionHistory || []).length,
      lastCompleted: h.lastCompletedAt || null,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ dailyStats, habitStats });
  }

  // Serve API Endpoint: /api/habits/export (CSV download)
  if (pathname === '/api/habits/export' && req.method === 'GET') {
    await ensureInitialized();
    const userIdParam = parsedUrl.searchParams.get('userId');
    if (!userIdParam) return res.status(400).json({ error: 'Missing userId' });

    const uId = parseInt(userIdParam, 10);
    const habits = getHabits(uId);

    const csvRows: string[] = [
      'Odat nomi,Interval,Vaqt,Streak,Jami bajarilgan,Bajarilgan sanalar'
    ];

    for (const h of habits) {
      const history = (h.completionHistory || []).join('; ');
      csvRows.push(
        `"${h.name}","${h.intervalDescription || h.intervalType}",${h.targetTime},${h.streak || 0},${(h.completionHistory || []).length},"${history}"`
      );
    }

    const csv = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="odatlar.csv"');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('\uFEFF' + csv); // BOM for Excel UTF-8
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
