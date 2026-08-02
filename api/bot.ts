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
  try {
    await ensureInitialized();
    return await handleWebhook(req, res);
  } catch (err: any) {
    console.error('Vercel Webhook error:', err);
    res.status(500).send('Internal Server Error');
  }
}
