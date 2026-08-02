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

const handleWebhook = webhookCallback(bot, 'std/http');

export default async function handler(req: Request) {
  try {
    await ensureInitialized();
    return await handleWebhook(req);
  } catch (err: any) {
    console.error('Vercel Webhook error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
