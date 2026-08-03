import http from 'http';
import fs from 'fs';
import path from 'path';
import { getHabits, getUsers, findHabitById, updateHabit } from './database';
import { getUzbekistanDate, getTodayDateString, calculateNextDueDateAfterCompletion } from './utils';

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
          });

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
