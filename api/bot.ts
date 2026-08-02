import { webhookCallback } from 'grammy';
import { bot } from '../index';
import { initTursoTables } from '../turso';
import { loadFromTurso } from '../database';

let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    await initTursoTables();
    await loadFromTurso();
    isInitialized = true;
  }
}

const handleWebhook = webhookCallback(bot, 'express');

export default async function handler(req: any, res: any) {
  // If request is GET (e.g. opened in browser), return friendly status page
  if (req.method === 'GET') {
    return res.status(200).send('🤖 Telegram Odatlar Boti 24/7 muvaffaqiyatli ishlamoqda!');
  }

  try {
    await ensureInitialized();
    return await handleWebhook(req, res);
  } catch (err: any) {
    console.error('Vercel Webhook error:', err);
    return res.status(200).send('OK');
  }
}
