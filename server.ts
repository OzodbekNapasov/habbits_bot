import http from 'http';
import fs from 'fs';
import path from 'path';
import { getHabits, getUsers, findHabitById, updateHabit, addHabit, deleteHabit, toggleUserNotifications, getUser, addCompletionRecord } from './database';
import { getUzbekistanDate, getTodayDateString, calculateNextDueDateAfterCompletion, calculateNextDueDateFromStartDate, isHabitScheduledOnDate } from './utils';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const PUBLIC_DIR = path.join(process.cwd(), 'public');

/**
 * Initializes the HTTP Web Server for serving Telegram Mini App & REST APIs.
 */
export function startWebServer(): void {
  const server = http.createServer((req, res) => {
    const reqUrl = req.url || '/';
    const parsedUrl = new URL(reqUrl, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    // API Endpoint: /api/habits
    if (pathname === '/api/habits' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const userIdParam = parsedUrl.searchParams.get('userId');
      let habits: any[] = [];

      if (userIdParam) {
        const userId = parseInt(userIdParam, 10);
        habits = getHabits(userId);
      } else {
        const users = getUsers();
        habits = users.length > 0 ? users[0].habits : [];
      }

      res.writeHead(200);
      res.end(JSON.stringify({ habits }));
      return;
    }

    // API Endpoint: /api/habits/done
    if (pathname === '/api/habits/done' && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => {
        bodyStr += chunk;
      });
      req.on('end', async () => {
        try {
          const { userId, habitId } = JSON.parse(bodyStr);
          if (!userId || !habitId) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Missing userId or habitId' }));
            return;
          }

          const uId = parseInt(userId, 10);
          const habitInfo = findHabitById(habitId);
          if (!habitInfo) {
            res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Habit not found' }));
            return;
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
            pendingReminderTimes: [],
          });

          // Record completion and update streak
          await addCompletionRecord(uId, habitId, todayStr);

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true, nextDueDate }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // API Endpoint: /api/habits/skip
    if (pathname === '/api/habits/skip' && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => {
        bodyStr += chunk;
      });
      req.on('end', async () => {
        try {
          const { userId, habitId } = JSON.parse(bodyStr);
          if (!userId || !habitId) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Missing userId or habitId' }));
            return;
          }

          const uId = parseInt(userId, 10);
          const habitInfo = findHabitById(habitId);
          if (!habitInfo) {
            res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Habit not found' }));
            return;
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

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true, nextDueDate }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // API Endpoint: /api/habits/add
    if (pathname === '/api/habits/add' && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => {
        bodyStr += chunk;
      });
      req.on('end', async () => {
        try {
          const { userId, name, intervalType, customIntervalDays, intervalDescription, restDays, targetTime, startDate } = JSON.parse(bodyStr);
          if (!userId || !name || !intervalType || !targetTime || !startDate) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Missing required fields' }));
            return;
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

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true, habit }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // API Endpoint: /api/habits/delete
    if (pathname === '/api/habits/delete' && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => {
        bodyStr += chunk;
      });
      req.on('end', async () => {
        try {
          const { userId, habitId } = JSON.parse(bodyStr);
          if (!userId || !habitId) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Missing userId or habitId' }));
            return;
          }

          const uId = parseInt(userId, 10);
          await deleteHabit(uId, habitId);

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // API Endpoint: /api/user/settings
    if (pathname === '/api/user/settings' && req.method === 'GET') {
      const userIdParam = parsedUrl.searchParams.get('userId');
      if (!userIdParam) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Missing userId' }));
        return;
      }

      const uId = parseInt(userIdParam, 10);
      const user = getUser(uId);

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ notificationsEnabled: user?.notificationsEnabled !== false }));
      return;
    }

    // API Endpoint: /api/user/settings/toggle
    if (pathname === '/api/user/settings/toggle' && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => {
        bodyStr += chunk;
      });
      req.on('end', async () => {
        try {
          const { userId } = JSON.parse(bodyStr);
          if (!userId) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Missing userId' }));
            return;
          }

          const uId = parseInt(userId, 10);
          await toggleUserNotifications(uId);
          const user = getUser(uId);

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true, notificationsEnabled: user?.notificationsEnabled !== false }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // API Endpoint: /api/habits/stats
    if (pathname === '/api/habits/stats' && req.method === 'GET') {
      const userIdParam = parsedUrl.searchParams.get('userId');
      if (!userIdParam) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Missing userId' }));
        return;
      }
      const uId = parseInt(userIdParam, 10);
      const habits = getHabits(uId);
      const now = getUzbekistanDate();
      const days: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      }
      const dailyStats = days.map((dateStr) => {
        const scheduled = habits.filter((h) => isHabitScheduledOnDate(h, dateStr));
        const completed = scheduled.filter((h) => h.completionHistory && h.completionHistory.includes(dateStr));
        return {
          date: dateStr,
          scheduled: scheduled.length,
          completed: completed.length,
          percent: scheduled.length > 0 ? Math.round((completed.length / scheduled.length) * 100) : null,
        };
      });
      const habitStats = habits.map((h) => ({
        id: h.id,
        name: h.name,
        streak: h.streak || 0,
        totalCompleted: (h.completionHistory || []).length,
        lastCompleted: h.lastCompletedAt || null,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ dailyStats, habitStats }));
      return;
    }

    // API Endpoint: /api/habits/export (CSV)
    if (pathname === '/api/habits/export' && req.method === 'GET') {
      const userIdParam = parsedUrl.searchParams.get('userId');
      if (!userIdParam) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Missing userId' }));
        return;
      }
      const uId = parseInt(userIdParam, 10);
      const habits = getHabits(uId);
      const csvRows: string[] = ['Odat nomi,Interval,Vaqt,Streak,Jami bajarilgan,Bajarilgan sanalar'];
      for (const h of habits) {
        const history = (h.completionHistory || []).join('; ');
        csvRows.push(`"${h.name}","${h.intervalDescription || h.intervalType}",${h.targetTime},${h.streak || 0},${(h.completionHistory || []).length},"${history}"`);
      }
      const csv = '\uFEFF' + csvRows.join('\n');
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="odatlar.csv"',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(csv);
      return;
    }

    // Static File Server (Serving public/index.html)
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType =
      ext === '.css'
        ? 'text/css'
        : ext === '.js'
        ? 'text/javascript'
        : ext === '.json'
        ? 'application/json'
        : 'text/html';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    } catch (error) {
      res.writeHead(500);
      res.end('Server Xatoligi');
    }
  });

  server.listen(PORT, () => {
    console.log(`🌐 Web App server ishga tushdi: http://localhost:${PORT}`);
  });
}
