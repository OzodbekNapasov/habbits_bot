import cron from 'node-cron';
import { Bot, InlineKeyboard } from 'grammy';
import { getUsers, updateHabit } from './database';
import {
  getTodayDateString,
  getCurrentTimeString,
  isHabitForToday,
  isHabitInNextDays,
} from './utils';
import { getRandomQuote } from './quotes';
import type { MyContext } from './index';

// Uzbekistan Timezone (+05:00)
const UZBEKISTAN_TIMEZONE = 'Asia/Tashkent';

/**
 * Triggers the 07:00 AM Daily Digest notification manually for a specific user or all users.
 */
export async function triggerDailyDigest(bot: Bot<MyContext>, targetUserId?: number): Promise<void> {
  const users = getUsers();
  const todayStr = getTodayDateString();

  for (const user of users) {
    if (targetUserId && user.id !== targetUserId) continue;
    if (user.notificationsEnabled === false) continue;

    const todayHabits = user.habits.filter((h) => isHabitForToday(h.nextDueDate, todayStr));

    const quote = getRandomQuote();
    let message = `☀️ *Xayrli tong! Bugungi muhim rejangiz:*\n\n`;

    if (todayHabits.length > 0) {
      todayHabits.forEach((habit) => {
        message += `• *${habit.name}* (Soat: ${habit.targetTime} da)\n`;
      });
    } else {
      message += `Bugun uchun maxsus eslatma yo'q. Kuningiz unumli va maroqli o'tsin!\n`;
    }

    message += `\n_${quote}_`;

    try {
      await bot.api.sendMessage(user.id, message, { parse_mode: 'Markdown' });
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
 * @param bot The grammY Bot instance
 */
export function initReminderCron(bot: Bot<MyContext>): void {
  console.log('⏰ Odatlar eslatmasi va Dayjest cron-vazifalari ishga tushirildi...');

  // -------------------------------------------------------------
  // 1. Exact Time Reminder Job (Runs every 1 minute)
  // -------------------------------------------------------------
  cron.schedule('* * * * *', async () => {
    try {
      const users = getUsers();
      const now = new Date();
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

            // Rich Inline Keyboard with 3 snooze options (15m, 30m, 1h)
            const keyboard = new InlineKeyboard()
              .text('✅ Bajarildi', `done_${habit.id}`)
              .row()
              .text('⏱ 15 min', `delay_15_${habit.id}`)
              .text('⏱ 30 min', `delay_30_${habit.id}`)
              .text('⏱ 1 soat', `delay_60_${habit.id}`)
              .row()
              .text('❌ Qoldirish', `skip_${habit.id}`);

            try {
              await bot.api.sendMessage(
                user.id,
                `🔔 Diqqat! *${habit.name}* vaqti keldi!\n\n_${quote}_`,
                {
                  parse_mode: 'Markdown',
                  reply_markup: keyboard,
                }
              );

              // Update lastNotifiedDueDate to prevent repeated notifications for this minute
              updateHabit(user.id, habit.id, {
                lastNotifiedDueDate: habitNotificationKey,
              });

              console.log(`[CRON] Eslatma yuborildi: User ID ${user.id}, Habit "${habit.name}"`);
            } catch (err) {
              console.error(`[CRON] ${user.id} foydalanuvchiga eslatma yuborishda xatolik:`, err);
            }
          }
        }
      }
    } catch (error) {
      console.error('[CRON 1-minut] Ishlash davomida xatolik yuz berdi:', error);
    }
  });

  // -------------------------------------------------------------
  // 2. Daily Morning Digest (Every day at 07:00 AM Asia/Tashkent)
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // 3. Weekly Digest (Every Monday at 07:00 AM Asia/Tashkent)
  // -------------------------------------------------------------
  cron.schedule(
    '0 7 * * 1',
    async () => {
      console.log('[CRON] Haftalik dayjest yuborilmoqda (Dushanba 07:00 AM Tashkent)...');
      try {
        const users = getUsers();

        for (const user of users) {
          const weeklyHabits = user.habits.filter((h) => isHabitInNextDays(h.nextDueDate, 7));

          if (weeklyHabits.length > 0) {
            const quote = getRandomQuote();
            let message = `📅 Yangi hafta muborak! Ushbu haftadagi asosiy rejalaringiz:\n\n`;
            weeklyHabits.forEach((habit) => {
              message += ` - ${habit.nextDueDate} (Soat: ${habit.targetTime} da) : ${habit.name}\n`;
            });
            message += `\n_${quote}_`;

            try {
              await bot.api.sendMessage(user.id, message, { parse_mode: 'Markdown' });
              console.log(`[CRON] Haftalik dayjest yuborildi: User ${user.id}`);
            } catch (err) {
              console.error(`[CRON] Haftalik dayjest yuborishda xatolik (${user.id}):`, err);
            }
          }
        }
      } catch (error) {
        console.error('[CRON Weekly Digest] Xatolik:', error);
      }
    },
    {
      timezone: UZBEKISTAN_TIMEZONE,
    }
  );
}
