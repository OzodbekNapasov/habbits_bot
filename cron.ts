import cron from 'node-cron';
import { Telegraf, Markup } from 'telegraf';
import { getUsers, updateHabit } from './database';
import {
  getTodayDateString,
  getCurrentTimeString,
  isHabitForToday,
  isHabitInNextDays,
  getUzbekistanDate,
} from './utils';
import { getRandomQuote } from './quotes';

// Uzbekistan Timezone (+05:00)
const UZBEKISTAN_TIMEZONE = 'Asia/Tashkent';

/**
 * Triggers the 07:00 AM Daily Digest notification manually for a specific user or all users.
 */
export async function triggerDailyDigest(bot: Telegraf<any>, targetUserId?: number): Promise<void> {
  const users = getUsers();
  const todayStr = getTodayDateString(getUzbekistanDate());

  for (const user of users) {
    if (targetUserId && user.id !== targetUserId) continue;
    if (user.notificationsEnabled === false) continue;

    const todayHabits = user.habits.filter((h) => isHabitForToday(h.nextDueDate, todayStr));

    const quote = getRandomQuote();
    let message = `☀️ 💫 <b>Xayrli tong! Bugungi muhim kunlik rejalaringiz:</b>\n\n`;

    if (todayHabits.length > 0) {
      todayHabits.forEach((habit) => {
        message += `  ⚡️ <b>${habit.name}</b> — ⏰ Soat <code>${habit.targetTime}</code> da\n`;
      });
    } else {
      message += `✨ Bugun uchun maxsus eslatma yo'q. Kuningiz unumli, omadli va maroqli o'tsin!\n`;
    }

    message += `\n💭 <i>"${quote}"</i>`;

    try {
      await bot.telegram.sendMessage(user.id, message, { parse_mode: 'HTML' });
      console.log(`[DAILY DIGEST] Kunlik dayjest yuborildi: User ${user.id}`);
    } catch (err) {
      console.error(`[DAILY DIGEST] Kunlik dayjest yuborishda xatolik (${user.id}):`, err);
    }
  }
}

/**
 * Initializes and starts all cron jobs for the Telegram Habit Bot:
 * 1. Exact Time 1-minute reminder checker with multi-snooze inline actions & motivational quotes
 * 2. Daily 07:00 AM Morning Digest with motivational quotes
 * 3. Weekly Monday 07:00 AM Weekly Digest
 * @param bot The Telegraf Bot instance
 */
export async function triggerWeeklyDigest(bot: Telegraf<any>): Promise<void> {
  console.log('[CRON] Haftalik dayjest yuborilmoqda (Dushanba 07:00 AM Tashkent)...');
  try {
    const users = getUsers();

    for (const user of users) {
      if (user.notificationsEnabled === false) continue;
      const weeklyHabits = user.habits.filter((h) => isHabitInNextDays(h.nextDueDate, 7));

      if (weeklyHabits.length > 0) {
        const quote = getRandomQuote();
        let message = `✨ 📅 <b>Yangi hafta muborak! Ushbu haftadagi asosiy rejalaringiz:</b>\n\n`;
        weeklyHabits.forEach((habit) => {
          message += `  💎 <b>${habit.name}</b> — ${habit.nextDueDate} (Soat: <code>${habit.targetTime}</code> da)\n`;
        });
        message += `\n💭 <i>"${quote}"</i>`;

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

        // Match today's date AND current exact time (HH:mm)
        if (
          habit.nextDueDate === todayStr &&
          habit.targetTime === nowTimeStr &&
          habit.lastNotifiedDueDate !== habitNotificationKey
        ) {
          const quote = getRandomQuote();

          // Rich Premium Inline Keyboard with 3 snooze options (15m, 30m, 1h)
          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🌟 ✅ Bajarildi', `done_${habit.id}`)],
            [
              Markup.button.callback('⚡️ ⏱ 15 min', `delay_15_${habit.id}`),
              Markup.button.callback('⚡️ ⏱ 30 min', `delay_30_${habit.id}`),
              Markup.button.callback('⚡️ ⏱ 1 soat', `delay_60_${habit.id}`),
            ],
            [Markup.button.callback('❌ Qoldirish', `skip_${habit.id}`)],
          ]);

          try {
            await bot.telegram.sendMessage(
              user.id,
              `👑 🔔 <b>Diqqat! Odat vaqti bo'ldi!</b>\n\n📌 <b>Odat nomi:</b> <b>${habit.name}</b>\n⏰ <b>Vaqt:</b> Soat <code>${habit.targetTime}</code> da\n\n💭 <i>"${quote}"</i>`,
              {
                parse_mode: 'HTML',
                ...keyboard,
              }
            );

            // Update lastNotifiedDueDate to prevent repeated notifications for this minute
            await updateHabit(user.id, habit.id, {
              lastNotifiedDueDate: habitNotificationKey,
            });

            console.log(`[CRON] Eslatma yuborildi: User ID ${user.id}, Habit "${habit.name}"`);
          } catch (err) {
            console.error(`[CRON] ${user.id} foydalanuvchiga eslatma yuborishda xatolik:`, err);
          }
        }
      }
    }

    // Trigger daily/weekly digest at exactly 07:00 AM Uzbekistan time on Vercel
    if (process.env.VERCEL === '1' && nowTimeStr === '07:00') {
      console.log('[CRON] Vercel manual daily/weekly digest trigger...');
      await triggerDailyDigest(bot);
      if (now.getDay() === 1) { // Monday
        await triggerWeeklyDigest(bot);
      }
    }
  } catch (error) {
    console.error('[CRON 1-minut] Xatolik:', error);
  }
}

/**
 * Initializes and starts all cron jobs for the Telegram Habit Bot locally (non-Vercel):
 */
export function initReminderCron(bot: Telegraf<any>): void {
  console.log('⚡️ ⏰ Odatlar eslatmasi va Dayjest cron-vazifalari (local) ishga tushirildi...');

  // 1. Exact Time Reminder Job (Runs every 1 minute)
  cron.schedule('* * * * *', async () => {
    await runReminderCheck(bot);
  });

  // 2. Daily Morning Digest (Every day at 07:00 AM Asia/Tashkent)
  cron.schedule(
    '0 7 * * *',
    async () => {
      console.log('[CRON] Kunlik dayjest yuborilmoqda (07:00 AM Tashkent)...');
      await triggerDailyDigest(bot);
    },
    {
      timezone: UZBEKISTAN_TIMEZONE,
    }
  );

  // 3. Weekly Digest (Every Monday at 07:00 AM Asia/Tashkent)
  cron.schedule(
    '0 7 * * 1',
    async () => {
      await triggerWeeklyDigest(bot);
    },
    {
      timezone: UZBEKISTAN_TIMEZONE,
    }
  );
}
