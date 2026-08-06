import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import {
  getUser,
  saveUser,
  getHabits,
  addHabit,
  deleteHabit,
  findHabitById,
  toggleUserNotifications,
  clearUserHabits,
  updateHabit,
  getUserCreationState,
  setUserCreationState,
  addCompletionRecord,
} from './database';
import {
  isValidTimeFormat,
  getTodayDateString,
  getTomorrowDateString,
  isValidDateFormat,
  parseUzbekDateToISO,
  formatISOToUzbekDate,
  calculateNextDueDateFromStartDate,
  calculateNextDueDateAfterCompletion,
  isHabitForToday,
  isHabitInNextDays,
  formatDateWithWeekday,
  formatDateUzbek,
  getDaysRemainingText,
  getCurrentWeekDays,
  getWeekDaysByOffset,
  isHabitScheduledOnDate,
  getPrettyIntervalName,
  escapeHtml,
  addMinutesToTime,
  getCurrentTimeString,
  getUzbekistanDate,
} from './utils';
import { IntervalType } from './types';
import { initReminderCron, triggerDailyDigest } from './cron';
import { startWebServer } from './server';

dotenv.config();

const token = process.env.BOT_TOKEN || '';
export const bot = new Telegraf<any>(token);

const ALLOWED_USER_ID = Number(process.env.ALLOWED_USER_ID || 8135594558);

// Access control middleware: Only allow execution for ALLOWED_USER_ID (8135594558)
bot.use(async (ctx, next) => {
  const fromId = ctx.from?.id;
  if (!fromId || Number(fromId) !== Number(ALLOWED_USER_ID)) {
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCbQuery("⚠️ Kechirasiz, ushbu bot shaxsiy va faqat ruxsat berilgan foydalanuvchi uchun ishlaydi.", { show_alert: true });
      } catch {
        // ignore
      }
    } else {
      await ctx.reply("⚠️ <b>Kechirasiz, ushbu bot shaxsiy va faqat ruxsat berilgan foydalanuvchi uchun mo'ljallangan.</b>", { parse_mode: 'HTML' });
    }
    return;
  }
  await next();
});

// Main Menu Keyboard in Uzbek with clean, minimal Emojis
const mainMenuKeyboard = Markup.keyboard([
  ['➕ Yangi odat', '📋 Mening odatlarim'],
  ['⚙️ Sozlamalar', '🌐 Mini App'],
]).resize();

/**
 * /start command handler with clean welcome info
 */
bot.command('start', async (ctx) => {
  const from = ctx.from;
  if (from) {
    await saveUser({
      id: from.id,
      firstName: from.first_name || 'Foydalanuvchi',
    });
  }

  await setUserCreationState(ctx.from.id, null);

  const startMessage =
    `👋 <b>Salom, ${escapeHtml(ctx.from?.first_name || 'Foydalanuvchi')}!</b>\n\n` +
    `Odatlar trekeriga xush kelibsiz! Ushbu bot orqali kunlik rejalaringizni shakllantirishingiz va muntazam kuzatib borishingiz mumkin.\n\n` +
    `➕ <b>Yangi odat:</b> Odat yaratish\n` +
    `📋 <b>Mening odatlarim:</b> Rejalar ro'yxati\n` +
    `🌐 <b>Mini App:</b> Interaktiv dashboard\n\n` +
    `Boshlash uchun menyudan kerakli tugmani tanlang:`;

  await ctx.reply(startMessage, { parse_mode: 'HTML', ...mainMenuKeyboard });
});

/**
 * Helper to build Period Selection Keyboard with clean Emojis
 */
function buildPeriodSelectionKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📅 Bugungi rejalar', 'filter_today'),
      Markup.button.callback('🗓 Haftalik rejalar', 'filter_week'),
    ],
    [
      Markup.button.callback('📅 Oylik rejalar', 'filter_month'),
      Markup.button.callback('📋 Barcha odatlarim', 'filter_all'),
    ],
  ]);
}

/**
 * Helper to build Settings message and Inline Keyboard
 */
function buildSettingsMessageAndKeyboard(userId: number, firstName: string) {
  const user = getUser(userId);
  const habits = getHabits(userId);
  const notificationsStatus = user?.notificationsEnabled !== false ? '🔔 Yoqilgan' : '🔕 O\'chirilgan';

  const text =
    `⚙️ <b>Sozlamalar paneli</b>\n\n` +
    `👤 <b>Foydalanuvchi:</b> ${escapeHtml(firstName)}\n` +
    `🆔 <b>ID:</b> <code>${userId}</code>\n` +
    `📋 <b>Odatlar soni:</b> ${habits.length} ta\n` +
    `🔔 <b>Bildirishnomalar:</b> ${notificationsStatus}\n\n` +
    `Amalni tanlang:`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`🔔 Bildirishnomalarni o'zgartirish`, 'toggle_notifications')],
    [Markup.button.callback('🗑 Barcha odatlarni o\'chirish', 'confirm_clear_all')],
  ]);

  return { text, keyboard };
}

/**
 * Helper to build single-column habit buttons (one habit per row)
 */
function buildHabitButtonsRows(habits: any[]) {
  return habits.map((h) => {
    const isMed = h.isMedication || h.name.toLowerCase().includes('dori') || h.name.toLowerCase().includes('tabletka');
    const icon = isMed ? '💊' : '📌';
    return [Markup.button.callback(`${icon} ${h.name}`, `view_${h.id}`)];
  });
}

/**
 * Render day-by-day weekly schedule breakdown with week date range navigation
 */
async function renderWeekSchedule(ctx: any, offset: number = 0, isEdit: boolean = false) {
  const userId = ctx.from.id;
  const userHabits = getHabits(userId);

  const { startDateUz, endDateUz, days } = getWeekDaysByOffset(offset);

  let message = `🗓 <b>Haftalik rejalaringiz</b>\n📌 <b>Oraliq:</b> <i>${startDateUz} — ${endDateUz}</i>\n\n`;

  let totalScheduledInWeek = 0;

  days.forEach((dayInfo) => {
    const dayHabits = userHabits
      .filter((h) => isHabitScheduledOnDate(h, dayInfo.dateStr))
      .sort((a, b) => a.targetTime.localeCompare(b.targetTime));

    if (dayHabits.length > 0) {
      totalScheduledInWeek += dayHabits.length;
      message += `<b>${dayInfo.weekdayName} (${dayInfo.formattedDateUz}):</b>\n`;
      message += `<blockquote>`;
      dayHabits.forEach((habit) => {
        const timeRemaining = getDaysRemainingText(habit.nextDueDate);
        message += `📌 <b>${escapeHtml(habit.name)}</b> (Soat: <code>${habit.targetTime}</code>) — <i>${timeRemaining}</i>\n`;
      });
      message += `</blockquote>\n\n`;
    }
  });

  if (totalScheduledInWeek === 0) {
    message += `<i>Ushbu haftada hech narsa rejalashtirilmagan.</i>\n\n`;
  }

  message += `<i>Haftalarni almashtirish yoki odatni tanlash:</i>`;

  const buttons: any[] = [
    ...buildHabitButtonsRows(userHabits),
    [
      Markup.button.callback('◀️ Oldingi hafta', `week_nav_${offset - 1}`),
      Markup.button.callback('▶️ Keyingi hafta', `week_nav_${offset + 1}`),
    ],
    [Markup.button.callback('🔙 Orqaga', 'list_habits')],
  ];

  const keyboard = Markup.inlineKeyboard(buttons);

  if (isEdit && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
    } catch {
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    }
  } else {
    await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
  }
}

// Bot Hears Commands & Keyboard Actions
bot.hears(/(?:📋\s*)?Mening odatlarim/, async (ctx: any) => {
  await saveUser({ id: ctx.from.id, firstName: ctx.from.first_name || 'Foydalanuvchi' });
  await setUserCreationState(ctx.from.id, null);
  const userId = ctx.from.id;
  const habits = getHabits(userId);

  if (habits.length === 0) {
    await ctx.reply("Sizda hozircha hech qanday odat yo'q. Yangi odat qo'shish uchun <b>➕ Yangi odat</b> tugmasini bosing.", { parse_mode: 'HTML', ...mainMenuKeyboard });
  } else {
    await ctx.reply("📋 <b>Odatlar va Rejalar bo'limi</b>\n\nQaysi davr uchun rejalashtirilgan odatlaringizni ko'rmoqchisiz?", {
      parse_mode: 'HTML',
      ...buildPeriodSelectionKeyboard(),
    });
  }
});

bot.hears(/(?:⚙️\s*)?Sozlamalar/, async (ctx: any) => {
  await saveUser({ id: ctx.from.id, firstName: ctx.from.first_name || 'Foydalanuvchi' });
  await setUserCreationState(ctx.from.id, null);
  const userId = ctx.from.id;
  const { text, keyboard } = buildSettingsMessageAndKeyboard(userId, ctx.from.first_name || 'Foydalanuvchi');
  await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
});

bot.hears(/(?:🌐\s*)?Mini App/, async (ctx: any) => {
  await saveUser({ id: ctx.from.id, firstName: ctx.from.first_name || 'Foydalanuvchi' });
  await setUserCreationState(ctx.from.id, null);
  const miniAppUrl = 'https://habbits-bot-seven.vercel.app/';
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.webApp('🌐 Dashboard', miniAppUrl)],
  ]);
  await ctx.reply("🌐 <b>Mini App interfeysi</b>\n\nOdatlaringizni interaktiv grafiklar orqali boshqarish uchun quyidagi tugmani bosing:", {
    parse_mode: 'HTML',
    ...keyboard,
  });
});

bot.command('digest', async (ctx: any) => {
  await triggerDailyDigest(bot, ctx.from.id);
});

bot.command(['test', 'test_eslatma'], async (ctx: any) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Bajarildi', 'done_sample')],
    [
      Markup.button.callback('⏰ 15 daqiqa', 'delay_15_sample'),
      Markup.button.callback('⏰ 30 daqiqa', 'delay_30_sample'),
      Markup.button.callback('⏰ 1 soat', 'delay_60_sample'),
    ],
    [Markup.button.callback('❌ Qoldirish', 'skip_sample')],
  ]);

  const sampleNormalMsg =
    `🔔 <b>Eslatma vaqti keldi! (Test)</b>\n\n` +
    `<blockquote>🎯 <b>Odat nomi:</b> <b>Kitob o'qish bo'yicha</b>\n` +
    `⏰ <b>Vaqt:</b> Soat <code>15:15</code></blockquote>\n\n` +
    `<blockquote>✨ <i>"Har bir daqiqa o'z maqsadlaringizga yaqinlashish uchun imkoniyatdir."</i></blockquote>`;

  const sampleMedMsg =
    `💊 <b>Dori ichish vaqti keldi! (Test)</b>\n\n` +
    `<blockquote>🎯 <b>Dori nomi:</b> <b>Tabletka - Paratsetamol (Ertalab)</b>\n` +
    `⏰ <b>Vaqt:</b> Soat <code>08:00</code>\n` +
    `💧 <i>Shu dorini ichib, bir stakan suv bilan xo'plab oling!</i></blockquote>`;

  await ctx.reply(sampleNormalMsg, { parse_mode: 'HTML', ...keyboard });
  await ctx.reply(sampleMedMsg, { parse_mode: 'HTML', ...keyboard });
});

// Habit Creation Flow Handlers
bot.hears(/(?:➕\s*)?Yangi odat/, async (ctx: any) => {
  await saveUser({ id: ctx.from.id, firstName: ctx.from.first_name || 'Foydalanuvchi' });
  await setUserCreationState(ctx.from.id, { step: 'WAITING_NAME' });

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💊 3 mahal dori / tabletka eslatmasi', 'create_medication')],
  ]);

  await ctx.reply(
    "📝 <b>Yangi odat nomini kiriting:</b>\n\nMasalan: <i>Yugurish, Kitob o'qish</i>\n\nYoki maxsus <b>💊 3 mahal dori eslatmasi</b> o'rnatish uchun quyidagi tugmani bosing:\n\n<i>Bekor qilish uchun /bekor buyrug'ini yuboring.</i>",
    { parse_mode: 'HTML', ...keyboard }
  );
});

bot.action('create_medication', async (ctx: any) => {
  const userId = ctx.from.id;
  await setUserCreationState(userId, { step: 'WAITING_MEDICINE_NAME', isMedication: true });

  await ctx.editMessageText(
    "💊 <b>3 mahal dori eslatmasi</b>\n\n" +
      "Dori yoki tabletka nomini kiriting:\n" +
      "(Masalan: <i>Paratsetamol</i>, <i>Vitamin C</i> yoki shunchaki <b>Tabletka</b> deb nomlash uchun kiritmasdan /otkazib_yuborish buyrug'ini yuboring)",
    { parse_mode: 'HTML' }
  );
  await ctx.answerCbQuery();
});

bot.command('bekor', async (ctx: any) => {
  await setUserCreationState(ctx.from.id, null);
  await ctx.reply("❌ Odat yaratish bekor qilindi.", mainMenuKeyboard);
});

// Callback Query Handlers
bot.action('filter_today', async (ctx: any) => {
  const userId = ctx.from.id;
  const habits = getHabits(userId);
  const todayStr = getTodayDateString();
  const todayHabits = habits
    .filter((h) => isHabitForToday(h.nextDueDate, todayStr))
    .sort((a, b) => a.targetTime.localeCompare(b.targetTime));

  let message = `📅 <b>Bugungi rejalar (${formatDateUzbek(todayStr)}):</b>\n\n`;

  if (todayHabits.length === 0) {
    message += `<i>Bugun uchun odatlar rejalashtirilmagan.</i>`;
  } else {
    todayHabits.forEach((habit) => {
      message += `<blockquote>`;
      message += `📌 <b>${escapeHtml(habit.name)}</b>\n`;
      message += `⏰ <b>Vaqti:</b> Soat <code>${habit.targetTime}</code>\n`;
      message += `🔄 <b>Takrorlanish:</b> ${getPrettyIntervalName(habit)}\n`;
      message += `⏳ <b>Holat:</b> Bugun`;
      message += `</blockquote>\n\n`;
    });
  }

  const buttons: any[] = [
    ...buildHabitButtonsRows(todayHabits),
    [Markup.button.callback('🔙 Orqaga', 'list_habits')],
  ];

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  await ctx.answerCbQuery();
});

bot.action('filter_week', async (ctx: any) => {
  await renderWeekSchedule(ctx, 0, true);
  await ctx.answerCbQuery();
});

bot.action(/^week_nav_(-?\d+)$/, async (ctx: any) => {
  const offset = parseInt(ctx.match[1], 10);
  await renderWeekSchedule(ctx, offset, true);
  await ctx.answerCbQuery();
});

bot.action('filter_month', async (ctx: any) => {
  const userId = ctx.from.id;
  const habits = getHabits(userId);
  const monthHabits = habits
    .filter((h) => isHabitInNextDays(h.nextDueDate, 30))
    .sort((a, b) => {
      const dateCompare = a.nextDueDate.localeCompare(b.nextDueDate);
      if (dateCompare !== 0) return dateCompare;
      return a.targetTime.localeCompare(b.targetTime);
    });

  let message = `📅 <b>Shu oylik rejalar:</b>\n\n`;

  if (monthHabits.length === 0) {
    message += `<i>Shu oy uchun rejalar yo'q.</i>`;
  } else {
    monthHabits.forEach((habit) => {
      const remainingText = getDaysRemainingText(habit.nextDueDate);
      message += `<blockquote>`;
      message += `📌 <b>${escapeHtml(habit.name)}</b>\n`;
      message += `📅 <b>Kuni:</b> ${formatDateWithWeekday(habit.nextDueDate)}\n`;
      message += `⏰ <b>Vaqti:</b> <code>${habit.targetTime}</code>\n`;
      message += `⏳ <b>Qolgan vaqt:</b> <i>${remainingText}</i>`;
      message += `</blockquote>\n\n`;
    });
  }

  const buttons: any[] = [
    ...buildHabitButtonsRows(monthHabits),
    [Markup.button.callback('🔙 Orqaga', 'list_habits')],
  ];

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  await ctx.answerCbQuery();
});

bot.action('filter_all', async (ctx: any) => {
  const userId = ctx.from.id;
  const habits = [...getHabits(userId)].sort((a, b) => {
    const dateCompare = a.nextDueDate.localeCompare(b.nextDueDate);
    if (dateCompare !== 0) return dateCompare;
    return a.targetTime.localeCompare(b.targetTime);
  });

  let message = `📋 <b>Barcha odatlar ro'yxati (${habits.length} ta):</b>\n\n`;

  habits.forEach((habit) => {
    const remainingText = getDaysRemainingText(habit.nextDueDate);
    message += `<blockquote>`;
    message += `📌 <b>${escapeHtml(habit.name)}</b>\n`;
    message += `🔄 <b>Oraliq:</b> ${getPrettyIntervalName(habit)}\n`;
    message += `⏰ <b>Soati:</b> <code>${habit.targetTime}</code>\n`;
    message += `📅 <b>Keyingi reja:</b> ${formatDateWithWeekday(habit.nextDueDate)}\n`;
    message += `⏳ <b>Qolgan vaqt:</b> <i>${remainingText}</i>`;
    message += `</blockquote>\n\n`;
  });

  const buttons: any[] = [
    ...buildHabitButtonsRows(habits),
    [Markup.button.callback('🔙 Orqaga', 'list_habits')],
  ];

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  await ctx.answerCbQuery();
});

bot.action('list_habits', async (ctx: any) => {
  const userId = ctx.from.id;
  const habits = getHabits(userId);

  if (habits.length === 0) {
    await ctx.editMessageText("Sizda hozircha hech qanday odat yo'q.");
  } else {
    await ctx.editMessageText(
      "📋 <b>Odatlar va Rejalar bo'limi</b>\n\nKerakli davrni tanlang:",
      { parse_mode: 'HTML', ...buildPeriodSelectionKeyboard() }
    );
  }
  await ctx.answerCbQuery();
});

bot.action(/^view_(.+)$/, async (ctx: any) => {
  const habitId = ctx.match[1];
  const habitInfo = findHabitById(habitId);

  if (!habitInfo) {
    await ctx.answerCbQuery("Odat topilmadi!");
    return;
  }

  const { habit } = habitInfo;
  const remainingText = getDaysRemainingText(habit.nextDueDate);

  let message = `📋 <b>Odat ma'lumotlari:</b>\n\n`;
  message += `<b>Nomi:</b> ${escapeHtml(habit.name)}\n`;
  message += `<b>Takrorlanish turi:</b> ${getPrettyIntervalName(habit)}\n`;
  message += `<b>Eslatma soati:</b> <code>${habit.targetTime}</code>\n`;
  message += `<b>Keyingi bajarish kuni:</b> ${formatDateWithWeekday(habit.nextDueDate)}\n`;
  message += `<b>Qolgan vaqt:</b> <i>${remainingText}</i>\n`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✍️ Tahrirlash', `edit_menu_${habit.id}`)],
    [Markup.button.callback('🗑 O\'chirish', `delete_${habit.id}`)],
    [Markup.button.callback('🔙 Orqaga', 'list_habits')],
  ]);

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
  await ctx.answerCbQuery();
});

bot.action(/^edit_menu_([a-zA-Z0-9-]+)$/, async (ctx: any) => {
  const habitId = ctx.match[1];
  const habitInfo = findHabitById(habitId);

  if (!habitInfo) {
    await ctx.answerCbQuery("Odat topilmadi!");
    return;
  }

  const { habit } = habitInfo;
  let message = `✍️ <b>Odatni tahrirlash:</b> "${escapeHtml(habit.name)}"\n\n`;
  message += `O'zgartirmoqchi bo'lgan maydonni tanlang:`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📝 Nomini o\'zgartirish', `edit_name_${habit.id}`),
      Markup.button.callback('⏰ Soatini o\'zgartirish', `edit_time_${habit.id}`),
    ],
    [Markup.button.callback('🔙 Orqaga', `view_${habit.id}`)],
  ]);

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
  await ctx.answerCbQuery();
});

bot.action(/^edit_name_([a-zA-Z0-9-]+)$/, async (ctx: any) => {
  const habitId = ctx.match[1];
  const userId = ctx.from.id;

  await setUserCreationState(userId, { step: 'EDITING_NAME', habitId });

  await ctx.reply("📝 <b>Odat uchun yangi nom kiriting:</b>\n\nMasalan: <i>Har kuni yugurish, 2 litr suv ichish</i>", { parse_mode: 'HTML' });
  await ctx.answerCbQuery();
});

bot.action(/^edit_time_([a-zA-Z0-9-]+)$/, async (ctx: any) => {
  const habitId = ctx.match[1];
  const userId = ctx.from.id;

  await setUserCreationState(userId, { step: 'EDITING_TIME', habitId });

  await ctx.reply("⏰ <b>Odat uchun vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>09:00</code> yoki <code>22:15</code>", { parse_mode: 'HTML' });
  await ctx.answerCbQuery();
});

bot.action(/^delete_(.+)$/, async (ctx: any) => {
  const habitId = ctx.match[1];
  const userId = ctx.from.id;
  deleteHabit(userId, habitId);

  await ctx.editMessageText("🗑 Odat muvaffaqiyatli o'chirildi.");
  await ctx.answerCbQuery("Odat o'chirildi! 🗑");
});

bot.action(/^done_(.+)$/, async (ctx: any) => {
  const habitId = ctx.match[1];
  const userId = ctx.from.id;
  const habitInfo = findHabitById(habitId);

  if (!habitInfo) {
    await ctx.answerCbQuery("Odat topilmadi!");
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

  await updateHabit(userId, habitId, {
    lastCompletedAt: todayStr,
    nextDueDate,
    pendingReminderTimes: [], // Clear re-notifications on completion
  });

  // Record completion and update streak
  await addCompletionRecord(userId, habitId, todayStr);

  await ctx.editMessageText(`🎉 Barakalla! <b>${escapeHtml(habit.name)}</b> odatini muvaffaqiyatli bajardingiz! Keyingi eslatma kuni: ${formatDateWithWeekday(nextDueDate)}.`, { parse_mode: 'HTML' });
  await ctx.answerCbQuery("Barakalla! 🎉");
});

bot.action(/^skip_(.+)$/, async (ctx: any) => {
  const habitId = ctx.match[1];
  const userId = ctx.from.id;
  const habitInfo = findHabitById(habitId);

  if (!habitInfo) {
    await ctx.answerCbQuery("Odat topilmadi!");
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

  const todayStr = getTodayDateString(now);
  await updateHabit(userId, habitId, {
    nextDueDate,
    lastSkippedAt: todayStr,
    pendingReminderTimes: [], // Clear re-notifications on skip
  });

  await ctx.editMessageText(`⏭️ "<b>${habit.name}</b>" odati qoldirildi.`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: "↩️ Qaytarish (Bekor qilish)", callback_data: `unskip_${habitId}` },
          { text: "✅ Bajarildi", callback_data: `done_${habitId}` }
        ]
      ]
    }
  });
  await ctx.answerCbQuery("Harakat qoldirildi. ⏭️");
});

bot.action(/^unskip_(.+)$/, async (ctx: any) => {
  const habitId = ctx.match[1];
  const userId = ctx.from.id;
  const habitInfo = findHabitById(habitId);
  if (!habitInfo) {
    await ctx.answerCbQuery("Odat topilmadi.");
    return;
  }

  const now = getUzbekistanDate();
  const todayStr = getTodayDateString(now);

  await updateHabit(userId, habitId, {
    nextDueDate: todayStr,
    lastSkippedAt: null,
  });

  await ctx.editMessageText(`🔄 "<b>${habitInfo.habit.name}</b>" odati qaytarildi va bugun uchun faollashtirildi!`, { parse_mode: 'HTML' });
  await ctx.answerCbQuery("Odat qaytarildi! 🔄");
});

bot.action('done_sample', async (ctx: any) => {
  await ctx.editMessageText('🎉 <b>Barakalla! Test eslatmasi bajarildi!</b>', { parse_mode: 'HTML' });
  await ctx.answerCbQuery("Barakalla! 🎉");
});

bot.action('skip_sample', async (ctx: any) => {
  await ctx.editMessageText('❌ <b>Test eslatmasi qoldirildi.</b>', { parse_mode: 'HTML' });
  await ctx.answerCbQuery("Harakat qoldirildi. ❌");
});

bot.action(/^delay_(\d+)_sample$/, async (ctx: any) => {
  const min = ctx.match[1];
  await ctx.editMessageText(`⏱ <b>Test eslatmasi ${min} daqiqaga surildi.</b>`, { parse_mode: 'HTML' });
  await ctx.answerCbQuery(`${min} daqiqaga surildi! ⏱`);
});

bot.action(/^delay_(\d+)_(.+)$/, async (ctx: any) => {
  const minutesToAdd = parseInt(ctx.match[1], 10);
  const habitId = ctx.match[2];
  const userId = ctx.from.id;
  const habitInfo = findHabitById(habitId);

  if (!habitInfo) {
    await ctx.answerCbQuery("Odat topilmadi!");
    return;
  }

  const { habit } = habitInfo;
  const now = getUzbekistanDate();
  const newTargetTime = addMinutesToTime(getCurrentTimeString(now), minutesToAdd);

  await updateHabit(userId, habitId, {
    targetTime: newTargetTime,
    lastNotifiedDueDate: undefined,
  });

  await ctx.editMessageText(
    `⏱ <b>${escapeHtml(habit.name)}</b> eslatmasi <b>${minutesToAdd} daqiqaga</b> surildi.\n\nYangi vaqt: <code>${newTargetTime}</code>`,
    { parse_mode: 'HTML' }
  );
  await ctx.answerCbQuery(`${minutesToAdd} daqiqaga surildi! ⏱`);
});

bot.action('toggle_notifications', async (ctx: any) => {
  const userId = ctx.from.id;
  await toggleUserNotifications(userId);
  const { text, keyboard } = buildSettingsMessageAndKeyboard(userId, ctx.from.first_name || 'Foydalanuvchi');
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
  await ctx.answerCbQuery("Bildirishnoma sozlamalari yangilandi!");
});

bot.action('confirm_clear_all', async (ctx: any) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🗑 Ha, o\'chirilsin', 'clear_all_habits')],
    [Markup.button.callback('❌ Bekor qilish', 'list_habits')],
  ]);
  await ctx.editMessageText("⚠️ <b>Haqiqatan ham barcha odatlaringizni o'chirib tashlamoqchimisiz?</b>\n\nBu amalni ortga qaytarib bo'lmaydi!", { parse_mode: 'HTML', ...keyboard });
  await ctx.answerCbQuery();
});

bot.action('clear_all_habits', async (ctx: any) => {
  const userId = ctx.from.id;
  await clearUserHabits(userId);
  await ctx.editMessageText("🗑 Barcha odatlar o'chirildi.");
  await ctx.answerCbQuery("Barcha odatlar o'chirildi! 🗑");
});

/**
 * Helper to build Rest Days Selection Inline Keyboard
 */
function buildRestDaysKeyboard(selectedDays: string[] = []) {
  const days = [
    { code: 'Du', label: 'Dushanba' },
    { code: 'Se', label: 'Sechanba' },
    { code: 'Ch', label: 'Chorshanba' },
    { code: 'Pa', label: 'Payshanba' },
    { code: 'Ju', label: 'Juma' },
    { code: 'Sh', label: 'Shanba' },
    { code: 'Ya', label: 'Yakshanba' },
  ];

  const row1 = days.slice(0, 4).map((d) => {
    const isSelected = selectedDays.includes(d.code);
    return Markup.button.callback(`${isSelected ? '✅' : '▫️'} ${d.code}`, `toggle_rest_${d.code}`);
  });

  const row2 = days.slice(4, 7).map((d) => {
    const isSelected = selectedDays.includes(d.code);
    return Markup.button.callback(`${isSelected ? '✅' : '▫️'} ${d.code}`, `toggle_rest_${d.code}`);
  });

  return Markup.inlineKeyboard([
    row1,
    row2,
    [Markup.button.callback('▫️ Tanaffussiz', 'rest_none')],
    [Markup.button.callback('➡️ Keyingi', 'rest_done')],
  ]);
}

// Interval Selection Callbacks for Habit Creation
bot.action(/^interval_(.+)$/, async (ctx: any) => {
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  const choice = ctx.match[1];

  if (choice === 'kunlik') {
    state.intervalType = 'kunlik';
    state.intervalDescription = 'Har kuni';
    state.restDays = [];
    state.step = 'WAITING_REST_DAYS';
    await setUserCreationState(userId, state);
    await ctx.editMessageText(
      "🏖 <b>Tanaffus kunlarini tanlang:</b>\n\nHaftaning qaysi kunlarida eslatma yuborilmasligini xohlaysiz?\n\nTanlangan kunlar: <b>Tanaffussiz</b>",
      { parse_mode: 'HTML', ...buildRestDaysKeyboard([]) }
    );
  } else if (choice === 'haftalik') {
    state.intervalType = 'haftalik';
    state.intervalDescription = 'Har haftada';
    state.restDays = [];
    state.step = 'WAITING_TIME';
    await setUserCreationState(userId, state);
    await ctx.editMessageText("⏰ <b>Odat bajariladigan vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>07:00</code> yoki <code>21:30</code>", { parse_mode: 'HTML' });
  } else if (choice === 'oylik') {
    state.intervalType = 'oylik';
    state.intervalDescription = 'Har oyda 1 marta';
    state.restDays = [];
    state.step = 'WAITING_TIME';
    await setUserCreationState(userId, state);
    await ctx.editMessageText("⏰ <b>Odat bajariladigan vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>07:00</code> yoki <code>21:30</code>", { parse_mode: 'HTML' });
  } else if (choice === 'boshqa') {
    state.intervalType = 'custom';
    state.restDays = [];
    state.step = 'WAITING_CUSTOM_DAYS';
    await setUserCreationState(userId, state);
    await ctx.editMessageText("🔢 <b>Oraliqni kiriting (kunlar soni):</b>\n\nFaqat kunlar sonini kiriting (masalan: <code>3</code>, <code>5</code>, <code>20</code>):", { parse_mode: 'HTML' });
  }
  await ctx.answerCbQuery();
});

// Rest Days Selection Callbacks
bot.action(/^toggle_rest_(.+)$/, async (ctx: any) => {
  const dayCode = ctx.match[1];
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  state.restDays = state.restDays || [];
  if (state.restDays.includes(dayCode)) {
    state.restDays = state.restDays.filter((d: string) => d !== dayCode);
  } else {
    state.restDays.push(dayCode);
  }

  await setUserCreationState(userId, state);

  const selectedText = state.restDays.length > 0 ? state.restDays.join(', ') : "Yo'q (Tanaffussiz)";
  const message = `🏖 <b>Tanaffus kunlarini tanlang:</b>\n\nTanlangan tanaffus kunlari: <b>${selectedText}</b>\n\n<i>Kerakli kunlarni tanlab, <b>➡️ Keyingi</b> tugmasini bosing:</i>`;

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    ...buildRestDaysKeyboard(state.restDays),
  });
  await ctx.answerCbQuery();
});

bot.action('rest_none', async (ctx: any) => {
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  state.restDays = [];
  state.step = 'WAITING_TIME';
  await setUserCreationState(userId, state);

  await ctx.editMessageText("⏰ <b>Odat bajariladigan vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>07:00</code> yoki <code>21:30</code>", { parse_mode: 'HTML' });
  await ctx.answerCbQuery("Tanaffussiz tanlandi!");
});

bot.action('rest_done', async (ctx: any) => {
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  state.step = 'WAITING_TIME';
  await setUserCreationState(userId, state);

  await ctx.editMessageText("⏰ <b>Odat bajariladigan vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>07:00</code> yoki <code>21:30</code>", { parse_mode: 'HTML' });
  await ctx.answerCbQuery();
});

// Habit Registration Callback handlers and Helpers

// Start Date Selection Callbacks
bot.action('start_date_today', async (ctx: any) => {
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  const startDate = getTodayDateString();
  await finalizeHabitCreation(ctx, userId, state, startDate);
  await ctx.answerCbQuery();
});

bot.action('start_date_tomorrow', async (ctx: any) => {
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  const startDate = getTomorrowDateString();
  await finalizeHabitCreation(ctx, userId, state, startDate);
  await ctx.answerCbQuery();
});

/**
 * Finalizes habit creation and sends confirmation message
 */
async function finalizeHabitCreation(ctx: any, userId: number, state: any, startDate: string) {
  const nextDueDate = calculateNextDueDateFromStartDate(
    startDate,
    state.targetTime!,
    state.intervalType!,
    state.restDays,
    state.customIntervalDays
  );

  const habit = await addHabit(userId, {
    name: state.name!,
    intervalType: state.intervalType!,
    customIntervalDays: state.customIntervalDays,
    intervalDescription: state.intervalDescription,
    startDate: startDate,
    restDays: state.restDays || [],
    targetTime: state.targetTime!,
    lastCompletedAt: null,
    nextDueDate,
  });

  // Clear persistent creation state
  await setUserCreationState(userId, null);

  if (habit) {
    const intervalName = getPrettyIntervalName(habit);
    const restDaysText = habit.restDays && habit.restDays.length > 0 ? habit.restDays.join(', ') : "Yo'q (Tanaffussiz)";
    const startDateUz = formatISOToUzbekDate(startDate);
    const message =
      `✅ <b>Yangi odat muvaffaqiyatli yaratildi!</b>\n\n` +
      `📌 <b>Nomi:</b> ${escapeHtml(habit.name)}\n` +
      `🔄 <b>Oraliq:</b> ${intervalName}\n` +
      `🏖 <b>Tanaffus kunlari:</b> ${restDaysText}\n` +
      `📅 <b>Boshlanish kuni:</b> <code>${startDateUz}</code>\n` +
      `⏰ <b>Vaqti:</b> Soat <code>${habit.targetTime}</code>\n` +
      `📅 <b>Keyingi eslatma:</b> ${formatDateWithWeekday(habit.nextDueDate)}`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(message, { parse_mode: 'HTML', ...mainMenuKeyboard });
    }
  } else {
    await ctx.reply("❌ Odatni saqlashda xatolik yuz berdi.", mainMenuKeyboard);
  }
}

// Medication Creation Callback Handlers
bot.action('med_times_default', async (ctx: any) => {
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  state.medicationTimes = ['08:00', '13:00', '20:00'];
  state.step = 'WAITING_MEDICINE_START_DATE';
  await setUserCreationState(userId, state);

  const todayStr = getTodayDateString();
  const tomorrowStr = getTomorrowDateString();
  const todayUz = formatISOToUzbekDate(todayStr);
  const tomorrowUz = formatISOToUzbekDate(tomorrowStr);

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`📅 Bugundan boshlash (${todayUz})`, 'med_start_today')],
    [Markup.button.callback(`🌅 Ertagadan boshlash (${tomorrowUz})`, 'med_start_tomorrow')],
  ]);

  await ctx.editMessageText(
    `💊 <b>Dori nomi:</b> ${escapeHtml(state.medicineName || 'Tabletka')}\n` +
      `⏰ <b>Vaqtlar:</b> <code>08:00</code> (Ertalab), <code>13:00</code> (Tushlik), <code>20:00</code> (Kechqurun)\n\n` +
      `📅 <b>Qaysi kundan boshlansin?</b> (yoki sanani <b>DD.MM.YYYY</b> formatida yuboring):`,
    { parse_mode: 'HTML', ...keyboard }
  );
  await ctx.answerCbQuery();
});

bot.action('med_times_custom', async (ctx: any) => {
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  state.step = 'WAITING_MEDICINE_TIMES_INPUT';
  await setUserCreationState(userId, state);

  await ctx.editMessageText(
    `⏰ <b>3 ta eslatma vaqtini vergul bilan kiriting (HH:mm formatida):</b>\n\n` +
      `Masalan: <code>08:30, 14:00, 21:00</code>`,
    { parse_mode: 'HTML' }
  );
  await ctx.answerCbQuery();
});

bot.action('med_start_today', async (ctx: any) => {
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  const startDate = getTodayDateString();
  await finalizeMedicationCreation(ctx, userId, state, startDate);
  await ctx.answerCbQuery();
});

bot.action('med_start_tomorrow', async (ctx: any) => {
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  const startDate = getTomorrowDateString();
  await finalizeMedicationCreation(ctx, userId, state, startDate);
  await ctx.answerCbQuery();
});

/**
 * Finalizes creation of 3-times-a-day medication habits
 */
async function finalizeMedicationCreation(ctx: any, userId: number, state: any, startDate: string) {
  const times = state.medicationTimes || ['08:00', '13:00', '20:00'];
  const rawMedName = state.medicineName || 'Tabletka';
  const labels = ['Ertalab', 'Tushlik', 'Kechqurun'];

  for (let i = 0; i < 3; i++) {
    const time = times[i];
    const label = labels[i];
    const fullName = `Tabletka - ${rawMedName} (${label})`;
    const nextDueDate = calculateNextDueDateFromStartDate(
      startDate,
      time,
      'kunlik',
      [],
      undefined
    );

    await addHabit(userId, {
      name: fullName,
      intervalType: 'kunlik',
      intervalDescription: 'Har kuni',
      startDate: startDate,
      restDays: [],
      targetTime: time,
      lastCompletedAt: null,
      nextDueDate,
      isMedication: true,
    });
  }

  await setUserCreationState(userId, null);

  const startDateUz = formatISOToUzbekDate(startDate);
  const message =
    `✅ <b>3 mahal dori eslatmasi muvaffaqiyatli o'rnatildi!</b>\n\n` +
    `💊 <b>Dori:</b> ${escapeHtml(rawMedName)}\n` +
    `📅 <b>Boshlanish kuni:</b> <code>${startDateUz}</code>\n\n` +
    `🌅 <b>Ertalab:</b> Soat <code>${times[0]}</code>\n` +
    `☀️ <b>Tushlik:</b> Soat <code>${times[1]}</code>\n` +
    `🌙 <b>Kechqurun:</b> Soat <code>${times[2]}</code>\n\n` +
    `<i>Bot belgilangan vaqtlarda sizga eslatma yuboradi. Har safar dorini ichib, ✅ Bajarildi tugmasini bosing!</i>`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, { parse_mode: 'HTML' });
  } else {
    await ctx.reply(message, { parse_mode: 'HTML', ...mainMenuKeyboard });
  }
}

// Multi-step Habit Registration via Text Input using Persistent DB State
bot.on('text', async (ctx: any) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  const state = await getUserCreationState(userId);

  if (state && state.step === 'EDITING_NAME') {
    const habitInfo = findHabitById(state.habitId);
    if (!habitInfo) {
      await setUserCreationState(userId, null);
      await ctx.reply("❌ Odat topilmadi yoki o'chirib yuborilgan.", mainMenuKeyboard);
      return;
    }
    const oldName = habitInfo.habit.name;
    await updateHabit(userId, state.habitId, { name: text });
    await setUserCreationState(userId, null);

    const updatedInfo = findHabitById(state.habitId);
    let msg = `✅ <b>Odat nomi muvaffaqiyatli o'zgartirildi!</b>\n\n`;
    msg += `📝 <b>Eski nom:</b> <s>${escapeHtml(oldName)}</s>\n`;
    msg += `📌 <b>Yangi nom:</b> <b>${escapeHtml(text)}</b>\n\n`;

    if (updatedInfo) {
      const { habit } = updatedInfo;
      const remainingText = getDaysRemainingText(habit.nextDueDate);
      msg += `📋 <b>Odat ma'lumotlari:</b>\n\n`;
      msg += `<b>Nomi:</b> ${escapeHtml(habit.name)}\n`;
      msg += `<b>Takrorlanish turi:</b> ${getPrettyIntervalName(habit)}\n`;
      msg += `<b>Eslatma soati:</b> <code>${habit.targetTime}</code>\n`;
      msg += `<b>Keyingi bajarish kuni:</b> ${formatDateWithWeekday(habit.nextDueDate)}\n`;
      msg += `<b>Qolgan vaqt:</b> <i>${remainingText}</i>\n`;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✍️ Tahrirlash', `edit_menu_${state.habitId}`)],
      [Markup.button.callback('🗑 O\'chirish', `delete_${state.habitId}`)],
      [Markup.button.callback('🔙 Orqaga', 'list_habits')],
    ]);

    await ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
    return;
  }

  if (state && state.step === 'EDITING_TIME') {
    if (!isValidTimeFormat(text)) {
      await ctx.reply("⚠️ Noto'g'ri vaqt formati. Iltimos, vaqtni <b>HH:mm</b> formatida kiriting (masalan: <code>08:00</code>):", { parse_mode: 'HTML' });
      return;
    }
    const habitInfo = findHabitById(state.habitId);
    if (!habitInfo) {
      await setUserCreationState(userId, null);
      await ctx.reply("❌ Odat topilmadi yoki o'chirib yuborilgan.", mainMenuKeyboard);
      return;
    }
    const oldTime = habitInfo.habit.targetTime;
    await updateHabit(userId, state.habitId, { targetTime: text });
    await setUserCreationState(userId, null);

    const updatedInfo = findHabitById(state.habitId);
    let msg = `✅ <b>Odat eslatma vaqti muvaffaqiyatli o'zgartirildi!</b>\n\n`;
    msg += `⏰ <b>Eski vaqt:</b> <s>${oldTime}</s>\n`;
    msg += `⚡️ <b>Yangi vaqt:</b> <code>${text}</code>\n\n`;

    if (updatedInfo) {
      const { habit } = updatedInfo;
      const remainingText = getDaysRemainingText(habit.nextDueDate);
      msg += `📋 <b>Odat ma'lumotlari:</b>\n\n`;
      msg += `<b>Nomi:</b> ${escapeHtml(habit.name)}\n`;
      msg += `<b>Takrorlanish turi:</b> ${getPrettyIntervalName(habit)}\n`;
      msg += `<b>Eslatma soati:</b> <code>${habit.targetTime}</code>\n`;
      msg += `<b>Keyingi bajarish kuni:</b> ${formatDateWithWeekday(habit.nextDueDate)}\n`;
      msg += `<b>Qolgan vaqt:</b> <i>${remainingText}</i>\n`;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✍️ Tahrirlash', `edit_menu_${state.habitId}`)],
      [Markup.button.callback('🗑 O\'chirish', `delete_${state.habitId}`)],
      [Markup.button.callback('🔙 Orqaga', 'list_habits')],
    ]);

    await ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
    return;
  }

  if (!state) {
    if (!text.startsWith('/')) {
      await ctx.reply(
        "Tushunmadim. Yangi odat qo'shish uchun <b>➕ Yangi odat</b> tugmasini bosing yoki barcha odatlarni ko'rish uchun <b>📋 Mening odatlarim</b> menyusini tanlang.",
        { parse_mode: 'HTML', ...mainMenuKeyboard }
      );
    }
    return;
  }

  if (state.step === 'WAITING_MEDICINE_NAME') {
    const medName = text === '/otkazib_yuborish' || text.startsWith('/') ? 'Tabletka' : text;
    state.medicineName = medName;
    state.step = 'WAITING_MEDICINE_TIMES_CHOICE';
    await setUserCreationState(userId, state);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⏰ Standart vaqtlar (08:00, 13:00, 20:00)', 'med_times_default')],
      [Markup.button.callback('✍️ O\'zim vaqtlarni kiritaman', 'med_times_custom')],
    ]);

    await ctx.reply(
      `💊 <b>Dori nomi:</b> ${escapeHtml(medName)}\n\n` +
        `Eslatma vaqtlarini tanlang:`,
      { parse_mode: 'HTML', ...keyboard }
    );
    return;
  }

  if (state.step === 'WAITING_MEDICINE_TIMES_INPUT') {
    const parts = text.split(',').map((s: string) => s.trim());
    if (parts.length !== 3 || !parts.every((t: string) => isValidTimeFormat(t))) {
      await ctx.reply(
        "⚠️ Iltimos, aynan 3 ta vaqtni <b>HH:mm</b> formatida vergul bilan kiriting!\n" +
          "Masalan: <code>08:00, 13:30, 20:00</code>",
        { parse_mode: 'HTML' }
      );
      return;
    }
    state.medicationTimes = parts;
    state.step = 'WAITING_MEDICINE_START_DATE';
    await setUserCreationState(userId, state);

    const todayStr = getTodayDateString();
    const tomorrowStr = getTomorrowDateString();
    const todayUz = formatISOToUzbekDate(todayStr);
    const tomorrowUz = formatISOToUzbekDate(tomorrowStr);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(`📅 Bugundan boshlash (${todayUz})`, 'med_start_today')],
      [Markup.button.callback(`🌅 Ertagadan boshlash (${tomorrowUz})`, 'med_start_tomorrow')],
    ]);

    await ctx.reply(
      `💊 <b>Dori nomi:</b> ${escapeHtml(state.medicineName || 'Tabletka')}\n` +
        `⏰ <b>Vaqtlar:</b> <code>${parts.join('</code>, <code>')}</code>\n\n` +
        `📅 <b>Qaysi kundan boshlansin?</b> (yoki sanani <b>DD.MM.YYYY</b> formatida yuboring):`,
      { parse_mode: 'HTML', ...keyboard }
    );
    return;
  }

  if (state.step === 'WAITING_MEDICINE_START_DATE') {
    const isoDate = parseUzbekDateToISO(text);
    if (!isoDate) {
      await ctx.reply(
        "⚠️ Noto'g'ri sana formati. Iltimos, sanani <b>DD.MM.YYYY</b> formatida kiriting (masalan: <code>06.08.2026</code>):",
        { parse_mode: 'HTML' }
      );
      return;
    }
    await finalizeMedicationCreation(ctx, userId, state, isoDate);
    return;
  }

  if (state.step === 'WAITING_NAME') {
    state.name = text;
    state.step = 'WAITING_INTERVAL';
    await setUserCreationState(userId, state);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📅 Har kuni', 'interval_kunlik')],
      [Markup.button.callback('🗓 Har haftada', 'interval_haftalik')],
      [Markup.button.callback('📅 Har oyda', 'interval_oylik')],
      [Markup.button.callback('⚙️ Boshqa oraliq', 'interval_boshqa')],
    ]);

    await ctx.reply(`<b>Odat nomi:</b> ${escapeHtml(text)}\n\nEndi ushbu odatning takrorlanish oralig'ini tanlang:`, {
      parse_mode: 'HTML',
      ...keyboard,
    });
    return;
  }

  if (state.step === 'WAITING_CUSTOM_DAYS') {
    const days = parseInt(text, 10);
    if (isNaN(days) || days <= 0) {
      await ctx.reply("⚠️ Iltimos, faqat musbat son kiriting (masalan: 3, 5, 20):");
      return;
    }
    state.customIntervalDays = days;
    state.intervalDescription = `Har ${days} kunda`;
    state.step = 'WAITING_TIME';
    await setUserCreationState(userId, state);
    await ctx.reply("⏰ <b>Odat bajariladigan vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>07:00</code> yoki <code>21:30</code>", { parse_mode: 'HTML' });
    return;
  }

  if (state.step === 'WAITING_TIME') {
    if (!isValidTimeFormat(text)) {
      await ctx.reply("⚠️ Noto'g'ri vaqt formati. Iltimos, vaqtni <b>HH:mm</b> formatida kiriting (masalan: <code>08:00</code>):", { parse_mode: 'HTML' });
      return;
    }
    state.targetTime = text;
    state.step = 'WAITING_START_DATE';
    await setUserCreationState(userId, state);

    const todayStr = getTodayDateString();
    const tomorrowStr = getTomorrowDateString();
    const todayUz = formatISOToUzbekDate(todayStr);
    const tomorrowUz = formatISOToUzbekDate(tomorrowStr);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(`📅 Bugundan boshlash (${todayUz})`, 'start_date_today')],
      [Markup.button.callback(`🌅 Ertagadan boshlash (${tomorrowUz})`, 'start_date_tomorrow')],
    ]);

    await ctx.reply(
      `📅 <b>Odat qaysi kundan boshlanishini kiriting (DD.MM.YYYY formatida):</b>\n\n` +
        `Masalan: <code>${tomorrowUz}</code> yoki quyidagi tugmalardan birini tanlang:`,
      { parse_mode: 'HTML', ...keyboard }
    );
    return;
  }

  if (state.step === 'WAITING_START_DATE') {
    const isoDate = parseUzbekDateToISO(text);
    if (!isoDate) {
      await ctx.reply(
        "⚠️ Noto'g'ri sana formati. Iltimos, sanani <b>DD.MM.YYYY</b> formatida kiriting (masalan: <code>03.08.2026</code>):",
        { parse_mode: 'HTML' }
      );
      return;
    }
    await finalizeHabitCreation(ctx, userId, state, isoDate);
    return;
  }
});

// Error handling
bot.catch((err: any) => {
  console.error(`Bot xatoligi yuz berdi:`, err);
});

// Send update notification function
export async function sendUpdateNotification() {
  const versionMsg =
    `🚀 <b>Botga yangi versiya keldi!</b>\n\n` +
    `<blockquote>✨ <b>Yangi imkoniyatlar:</b>\n` +
    `💊 <b>3 mahal dori / tabletka eslatmasi:</b> Kuniga 3 mahal dori ichish uchun maxsus vaqtlar (<code>08:00</code>, <code>13:00</code>, <code>20:00</code> yoki moslashtirilgan vaqtlar) bo'yicha eslatmalar shakllantirish hamda suv bilan ichish bo'yicha chiroyli bildirishnoma va kartochkalar yaratildi.</blockquote>\n\n` +
    `<i>Sinab ko'rish uchun menyudan <b>➕ Yangi odat</b> tugmasini bosing!</i>`;

  try {
    await bot.telegram.sendMessage(ALLOWED_USER_ID, versionMsg, { parse_mode: 'HTML' });
    console.log(`[UPDATE NOTIFICATION] Yangi versiya haqida xabar yuborildi: ${ALLOWED_USER_ID}`);
  } catch (err) {
    console.error(`[UPDATE NOTIFICATION] Xatolik:`, err);
  }
}

if (process.env.VERCEL !== '1') {
  // Load database from GitHub repository
  const { loadFromGitHub } = require('./database');
  loadFromGitHub();

  // Initialize 1-minute reminder and dayjest cron jobs
  initReminderCron(bot);

  // Initialize HTTP Web Server for Telegram Mini App & REST APIs
  startWebServer();

  // Start the bot with long polling locally
  console.log('🤖 Telegram Odatlar Boti (Telegraf) ishga tushmoqda...');
  bot.launch().then(() => {
    sendUpdateNotification();
  });
}
