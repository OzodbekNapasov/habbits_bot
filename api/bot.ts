import { bot } from '../index';
import { initTursoTables } from '../turso';
import { loadFromTurso } from '../database';

let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    try {
      await initTursoTables();
      await loadFromTurso();
    } catch (err) {
      console.error('Turso init error:', err);
    }
    isInitialized = true;
  }
}

export default async function handler(req: any, res: any) {
  // If request is GET (e.g. opened in browser), return friendly status page
  if (req.method === 'GET') {
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
