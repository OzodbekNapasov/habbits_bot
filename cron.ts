import cron from 'node-cron';
import { Telegraf, Markup } from 'telegraf';
import { getUsers, updateHabit } from './database';
import {
  getTodayDateString,
  getCurrentTimeString,
  isHabitForToday,
  isHabitInNextDays,
  getUzbekistanDate,
  addMinutesToTime,
} from './utils';
import { getRandomQuote } from './quotes';

const UZBEKISTAN_TIMEZONE = 'Asia/Tashkent';
const RENOTIFY_DELAYS = [10, 20, 30];

export async function triggerDailyDigest(bot: Telegraf<any>, targetUserId?: number): Promise<void> {
  const users = getUsers();
  const todayStr = getTodayDateString(getUzbekistanDate());

  for (const user of users) {
    if (targetUserId && user.id !== targetUserId) continue;
    if (user.notificationsEnabled === false) continue;

    const todayHabits = user.habits.filter((h) => isHabitForToday(h.nextDueDate, todayStr));
    const quote = getRandomQuote();
    let message = `☀️ <b>Xayrli tong! Bugungi rejalashtirilgan odatlaringiz:</b>\n\n`;

    if (todayHabits.length > 0) {
      todayHabits.forEach((habit) => {
        message += `  🎯 <b>${habit.name}</b> ⏰ Soat <code>${habit.targetTime}</code>\n`;
      });
    } else {
      message += `Bugun uchun rejalashtirilgan odatlar yo'q. Kuningiz xayrli o'tsin!\n`;
    }
    message += `\n✨ <i>"${quote}"</i>`;

    try {
      await bot.telegram.sendMessage(user.id, message, { parse_mode: 'HTML' });
      console.log(`[DAILY DIGEST] Kunlik dayjest yuborildi: User ${user.id}`);
    } catch (err) {
      console.error(`[DAILY DIGEST] Xatolik (${user.id}):`, err);
    }
  }
}

export async function triggerWeeklyDigest(bot: Telegraf<any>): Promise<void> {
  console.log('[CRON] Haftalik dayjest yuborilmoqda...');
  try {
    const users = getUsers();
    for (const user of users) {
      if (user.notificationsEnabled === false) continue;
      const weeklyHabits = user.habits.filter((h) => isHabitInNextDays(h.nextDueDate, 7));

      if (weeklyHabits.length > 0) {
        const quote = getRandomQuote();
        let message = `🗓 <b>Yangi hafta muborak! Haftalik rejalaringiz:</b>\n\n`;
        weeklyHabits.forEach((habit) => {
          message += `  📌 <b>${habit.name}</b> 📅 ${habit.nextDueDate} (Soat: <code>${habit.targetTime}</code>)\n`;
        });
        message += `\n✨ <i>"${quote}"</i>`;

        try {
          await bot.telegram.sendMessage(user.id, message, { parse_mode: 'HTML' });
          console.log(`[CRON] Haftalik dayjest yuborildi: User ${user.id}`);
        } catch (err) {
          console.error(`[CRON] Haftalik dayjest yuborishda xatolik (${user.id}):`, err);
        }
      }
    }
  } catch (error) {
    console.error('[CRON Weekly Digest] Xatolik:', error);
  }
}

export async function triggerWeeklyStreakSummary(bot: Telegraf<any>): Promise<void> {
  console.log('[CRON] Haftalik streak xulosasi yuborilmoqda...');
  try {
    const users = getUsers();
    const now = getUzbekistanDate();

    const dayOfWeek = now.getDay();
    const distToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + distToMonday + i);
      weekDates.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }

    for (const user of users) {
      if (user.notificationsEnabled === false) continue;
      if (user.habits.length === 0) continue;

      let message = `📊 <b>Bu haftaning streak xulosasi:</b>\n\n`;
      let hasAny = false;

      for (const habit of user.habits) {
        const history = new Set(habit.completionHistory || []);
        const { isHabitScheduledOnDate } = require('./utils');
        const scheduledThisWeek = weekDates.filter((d) => isHabitScheduledOnDate(habit, d));
        const completedThisWeek = scheduledThisWeek.filter((d) => history.has(d));
        const streakVal = habit.streak || 0;

        if (scheduledThisWeek.length > 0) {
          hasAny = true;
          const pct = Math.round((completedThisWeek.length / scheduledThisWeek.length) * 100);
          const streakEmoji = streakVal >= 7 ? '🔥' : streakVal >= 3 ? '⚡' : '💪';
          message += `${streakEmoji} <b>${habit.name}</b>\n`;
          message += `   Bu hafta: ${completedThisWeek.length}/${scheduledThisWeek.length} (${pct}%)\n`;
          message += `   Streak: <b>${streakVal} kun</b>\n\n`;
        }
      }

      if (!hasAny) continue;

      const quote = getRandomQuote();
      message += `\n✨ <i>"${quote}"</i>`;

      try {
        await bot.telegram.sendMessage(user.id, message, { parse_mode: 'HTML' });
        console.log(`[CRON] Streak xulosasi yuborildi: User ${user.id}`);
      } catch (err) {
        console.error(`[CRON] Streak xulosasi yuborishda xatolik (${user.id}):`, err);
      }
    }
  } catch (error) {
    console.error('[CRON Weekly Streak] Xatolik:', error);
  }
}

export async function runReminderCheck(bot: Telegraf<any>): Promise<void> {
  try {
    const users = getUsers();
    const now = getUzbekistanDate();
    const todayStr = getTodayDateString(now);
    const nowTimeStr = getCurrentTimeString(now);

    for (const user of users) {
      if (user.notificationsEnabled === false) continue;

      for (const habit of user.habits) {
        const habitNotificationKey = `${todayStr}_${habit.targetTime}`;

        if (
          habit.nextDueDate === todayStr &&
          habit.targetTime === nowTimeStr &&
          habit.lastNotifiedDueDate !== habitNotificationKey
        ) {
          const quote = getRandomQuote();
          const pendingReminderTimes = RENOTIFY_DELAYS.map((d) =>
            addMinutesToTime(habit.targetTime, d)
          );

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Bajarildi', `done_${habit.id}`)],
            [
              Markup.button.callback('⏰ 15 daqiqa', `delay_15_${habit.id}`),
              Markup.button.callback('⏰ 30 daqiqa', `delay_30_${habit.id}`),
              Markup.button.callback('⏰ 1 soat', `delay_60_${habit.id}`),
            ],
            [Markup.button.callback('❌ Qoldirish', `skip_${habit.id}`)],
          ]);

          try {
            const isMed = habit.isMedication || habit.name.toLowerCase().includes('dori') || habit.name.toLowerCase().includes('tabletka');
            const { escapeHtml } = require('./utils');
            const messageText = isMed
              ? `💊 <b>Dori ichish vaqti keldi!</b>\n\n` +
                `<blockquote>🎯 <b>Dori nomi:</b> <b>${escapeHtml(habit.name)}</b>\n` +
                `⏰ <b>Vaqt:</b> Soat <code>${habit.targetTime}</code>\n` +
                `💧 <i>Shu dorini ichib, bir stakan suv bilan xo'plab oling!</i></blockquote>`
              : `🔔 <b>Eslatma vaqti keldi!</b>\n\n` +
                `<blockquote>🎯 <b>Odat nomi:</b> <b>${escapeHtml(habit.name)}</b>\n` +
                `⏰ <b>Vaqt:</b> Soat <code>${habit.targetTime}</code></blockquote>\n\n` +
                `<blockquote>✨ <i>"${quote}"</i></blockquote>`;

            await bot.telegram.sendMessage(
              user.id,
              messageText,
              { parse_mode: 'HTML', ...keyboard }
            );

            await updateHabit(user.id, habit.id, {
              lastNotifiedDueDate: habitNotificationKey,
              pendingReminderTimes,
            });

            console.log(`[CRON] Eslatma yuborildi: User ID ${user.id}, Habit "${habit.name}"`);
          } catch (err) {
            console.error(`[CRON] ${user.id} foydalanuvchiga eslatma yuborishda xatolik:`, err);
          }
        }

        const pending = habit.pendingReminderTimes || [];
        if (
          pending.length > 0 &&
          habit.lastCompletedAt !== todayStr &&
          pending.includes(nowTimeStr)
        ) {
          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Bajarildi', `done_${habit.id}`)],
            [Markup.button.callback('❌ Qoldirish', `skip_${habit.id}`)],
          ]);

          try {
            const { escapeHtml } = require('./utils');
            await bot.telegram.sendMessage(
              user.id,
              `⚠️ <b>Hali bajarilmagan eslatma:</b>\n\n` +
                `<blockquote>🎯 <b>Odat:</b> <b>${escapeHtml(habit.name)}</b>\n` +
                `⏰ <b>Vaqti:</b> Soat <code>${nowTimeStr}</code> — bajarish vaqti o'tib borayapti!</blockquote>`,
              { parse_mode: 'HTML', ...keyboard }
            );

            const newPending = pending.filter((t) => t !== nowTimeStr);
            await updateHabit(user.id, habit.id, { pendingReminderTimes: newPending });

            console.log(`[CRON] Qayta eslatma: User ID ${user.id}, Habit "${habit.name}" @ ${nowTimeStr}`);
          } catch (err) {
            console.error(`[CRON] Qayta eslatma yuborishda xatolik (${user.id}):`, err);
          }
        }
      }
    }

    if (process.env.VERCEL === '1') {
      if (nowTimeStr === '07:00') {
        await triggerDailyDigest(bot);
        if (now.getDay() === 1) await triggerWeeklyDigest(bot);
      }
      if (nowTimeStr === '21:00' && now.getDay() === 0) {
        await triggerWeeklyStreakSummary(bot);
      }
    }
  } catch (error) {
    console.error('[CRON 1-minut] Xatolik:', error);
  }
}

export function initReminderCron(bot: Telegraf<any>): void {
  console.log('✅ Odatlar eslatmasi va Dayjest cron-vazifalari (local) ishga tushirildi...');

  cron.schedule('* * * * *', async () => { await runReminderCheck(bot); });

  cron.schedule('0 7 * * *', async () => {
    console.log('[CRON] Kunlik dayjest yuborilmoqda (07:00 AM Tashkent)...');
    await triggerDailyDigest(bot);
  }, { timezone: UZBEKISTAN_TIMEZONE });

  cron.schedule('0 7 * * 1', async () => { await triggerWeeklyDigest(bot); }, { timezone: UZBEKISTAN_TIMEZONE });

  cron.schedule('0 21 * * 0', async () => { await triggerWeeklyStreakSummary(bot); }, { timezone: UZBEKISTAN_TIMEZONE });
}
