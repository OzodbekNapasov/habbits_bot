import { bot } from '../index';
import { initTursoTables } from '../turso';
import { loadFromTurso, getHabits, getUsers } from '../database';
import fs from 'fs';
import path from 'path';

let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    const dbPath = process.env.VERCEL === '1' ? path.join('/tmp', 'db.json') : path.join(process.cwd(), 'db.json');
    if (!fs.existsSync(dbPath)) {
      try {
        await loadFromTurso();
      } catch (err) {
        console.error('Turso load error:', err);
      }
    }
    isInitialized = true;
  }
}

export default async function handler(req: any, res: any) {
  const reqUrl = req.url || '/';
  const parsedUrl = new URL(reqUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;

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
