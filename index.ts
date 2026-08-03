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

// Main Menu Keyboard in Uzbek with Telegram Premium Emojis
const mainMenuKeyboard = Markup.keyboard([
  ['✨ ➕ Yangi odat', '📊 📋 Mening odatlarim'],
  ['⚙️ Sozlamalar', '💎 🌐 Mini App'],
]).resize();

/**
 * /start command handler with rich detailed welcome info
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
    `👑 <b>Salom, ${escapeHtml(ctx.from?.first_name || 'Foydalanuvchi')}!</b> ✨\n\n` +
    `Men sizning shaxsiy <b>VIP Odatlar Treker</b> botingizman.\n\n` +
    `🎯 <b>Yangi odat qo'shish:</b> ✨ ➕ Yangi odat\n` +
    `📊 <b>Odatlaringizni ko'rish:</b> 📊 📋 Mening odatlarim\n` +
    `💎 <b>Mini App interfeysi:</b> 💎 🌐 Mini App\n\n` +
    `👇 <b>Boshlash uchun menyudan kerakli tugmani bosing:</b>`;

  await ctx.reply(startMessage, { parse_mode: 'HTML', ...mainMenuKeyboard });
});

/**
 * Helper to build Period Selection Keyboard with Premium Emojis
 */
function buildPeriodSelectionKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('👑 📅 Bugungi rejalar', 'filter_today'),
      Markup.button.callback('⚡️ 🗓 Shu haftalik rejalar', 'filter_week'),
    ],
    [
      Markup.button.callback('🔮 📆 Shu oylik rejalar', 'filter_month'),
      Markup.button.callback('💎 📋 Barcha odatlarim', 'filter_all'),
    ],
  ]);
}

/**
 * Helper to build Settings message and Inline Keyboard
 */
function buildSettingsMessageAndKeyboard(userId: number, firstName: string) {
  const user = getUser(userId);
  const habits = getHabits(userId);
  const notificationsStatus = user?.notificationsEnabled !== false ? '🔔 ⚡️ Yoqilgan' : '🔕 O\'chirilgan';

  const text =
    `⚙️ 👑 <b>Sozlamalar paneli</b>\n\n` +
    `👤 <b>Foydalanuvchi:</b> ${escapeHtml(firstName)}\n` +
    `🆔 <b>Telegram ID:</b> <code>${userId}</code>\n` +
    `📊 <b>Odatlar soni:</b> ${habits.length} ta\n` +
    `🔔 <b>Eslatmalar:</b> ${notificationsStatus}\n\n` +
    `✨ Kerakli amalni tanlang:`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`🔔 ⚡️ Eslatmalarni o'zgartirish (${notificationsStatus})`, 'toggle_notifications')],
    [Markup.button.callback('🔥 🗑 Barcha odatlarni o\'chirish', 'confirm_clear_all')],
  ]);

  return { text, keyboard };
}

/**
 * Render day-by-day weekly schedule breakdown with week date range navigation
 */
async function renderWeekSchedule(ctx: any, offset: number = 0, isEdit: boolean = false) {
  const userId = ctx.from.id;
  const userHabits = getHabits(userId);

  const { startDateUz, endDateUz, days } = getWeekDaysByOffset(offset);

  let message = `✨ 🗓 <b>Haftalik rejalaringiz</b>\n📌 <b>Oraliq:</b> <i>${startDateUz} — ${endDateUz}</i>\n\n`;

  let totalScheduledInWeek = 0;

  days.forEach((dayInfo) => {
    const dayHabits = userHabits.filter((h) => isHabitScheduledOnDate(h, dayInfo.dateStr));

    if (dayHabits.length > 0) {
      totalScheduledInWeek += dayHabits.length;
      message += `<b>♦️ ${dayInfo.weekdayName} (${dayInfo.formattedDateUz}):</b>\n`;
      message += `<blockquote>`;
      dayHabits.forEach((habit) => {
        const timeRemaining = getDaysRemainingText(habit.nextDueDate);
        message += `📌 <b>${escapeHtml(habit.name)}</b> (Soat: <code>${habit.targetTime}</code> da) — <i>${timeRemaining}</i>\n`;
      });
      message += `</blockquote>\n\n`;
    }
  });

  if (totalScheduledInWeek === 0) {
    message += `<i>Ushbu haftada hechnarsa rejalashtirilmagan.</i>\n\n`;
  }

  message += `<i>Odatni boshqarish yoki haftalarni almashtirish uchun quyidagi tugmalardan birini bosing:</i>`;

  const buttons: any[] = [];
  const habitsRow: any[] = [];

  userHabits.slice(0, 4).forEach((h) => {
    habitsRow.push(Markup.button.callback(h.name, `view_${h.id}`));
  });

  if (habitsRow.length > 0) {
    buttons.push(habitsRow);
  }

  buttons.push([
    Markup.button.callback('◀️ Oldingi hafta', `week_nav_${offset - 1}`),
    Markup.button.callback('▶️ Keyingi hafta', `week_nav_${offset + 1}`),
  ]);

  buttons.push([Markup.button.callback('🔙 Orqaga', 'list_habits')]);

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
bot.hears(/(?:📊\s*)?📋\s*Mening odatlarim/, async (ctx: any) => {
  await saveUser({ id: ctx.from.id, firstName: ctx.from.first_name || 'Foydalanuvchi' });
  await setUserCreationState(ctx.from.id, null);
  const userId = ctx.from.id;
  const habits = getHabits(userId);

  if (habits.length === 0) {
    await ctx.reply("✨ Sizda hozircha hech qanday odat yo'q. Yangi odat qo'shish uchun <b>✨ ➕ Yangi odat</b> tugmasini bosing.", { parse_mode: 'HTML', ...mainMenuKeyboard });
  } else {
    await ctx.reply("📋 ⚡️ <b>Odatlar va Rejalar bo'limi</b>\n\nQaysi davr uchun rejalashtirilgan odatlaringizni ko'rmoqchisiz?", {
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

bot.hears(/(?:💎\s*)?🌐\s*Mini App/, async (ctx: any) => {
  await saveUser({ id: ctx.from.id, firstName: ctx.from.first_name || 'Foydalanuvchi' });
  await setUserCreationState(ctx.from.id, null);
  const miniAppUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://habbits-bot-seven.vercel.app/';
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.webApp('🚀 💎 Mini App Dashboard', miniAppUrl)],
  ]);
  await ctx.reply("💎 🌐 <b>Telegram Mini App loyihasi</b>\n\nOdatlaringizni interaktiv grafiklar va chiroyli interfeys orqali boshqarish uchun pastdagi tugmani bosing:", {
    parse_mode: 'HTML',
    ...keyboard,
  });
});

bot.command('digest', async (ctx: any) => {
  await triggerDailyDigest(bot, ctx.from.id);
});

// Habit Creation Flow Handlers
bot.hears(/(?:✨\s*)?➕\s*Yangi odat/, async (ctx: any) => {
  await saveUser({ id: ctx.from.id, firstName: ctx.from.first_name || 'Foydalanuvchi' });
  await setUserCreationState(ctx.from.id, { step: 'WAITING_NAME' });
  await ctx.reply(
    "✨ 📝 <b>Yangi odat nomini kiriting:</b>\n\nMasalan: <i>Mashg'ulot, Kitob o'qish, Sartaroshga borish</i>\n\n<i>Bekor qilish uchun /bekor buyrug'ini yuboring.</i>",
    { parse_mode: 'HTML' }
  );
});

bot.command('bekor', async (ctx: any) => {
  await setUserCreationState(ctx.from.id, null);
  await ctx.reply("❌ 🚫 Odat qo'shish bekor qilindi.", mainMenuKeyboard);
});

// Callback Query Handlers
bot.action('filter_today', async (ctx: any) => {
  const userId = ctx.from.id;
  const habits = getHabits(userId);
  const todayStr = getTodayDateString();
  const todayHabits = habits.filter((h) => isHabitForToday(h.nextDueDate, todayStr));

  let message = `👑 📅 <b>Bugungi odatlaringiz (${formatDateUzbek(todayStr)}):</b>\n\n`;

  if (todayHabits.length === 0) {
    message += `<i>Bugun uchun hech qanday odat rejalashtirilmagan. Unumli dam oling!</i>`;
  } else {
    todayHabits.forEach((habit) => {
      message += `<blockquote>`;
      message += `📌 <b>${escapeHtml(habit.name)}</b>\n`;
      message += `⏰ <b>Vaqti:</b> Soat <code>${habit.targetTime}</code> da\n`;
      message += `🔄 <b>Takrorlanish:</b> ${getPrettyIntervalName(habit)}\n`;
      message += `⏳ <b>Holat:</b> Bugun 🔥 ⚡️`;
      message += `</blockquote>\n\n`;
    });
  }

  const habitsRow: any[] = [];
  todayHabits.slice(0, 4).forEach((h) => {
    habitsRow.push(Markup.button.callback(h.name, `view_${h.id}`));
  });

  const buttons: any[] = [];
  if (habitsRow.length > 0) buttons.push(habitsRow);
  buttons.push([Markup.button.callback('🔙 ◀️ Orqaga', 'list_habits')]);

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
  const monthHabits = habits.filter((h) => isHabitInNextDays(h.nextDueDate, 30));

  let message = `🔮 📆 <b>Shu oylik rejalashtirilgan odatlaringiz:</b>\n\n`;

  if (monthHabits.length === 0) {
    message += `<i>Shu oy uchun hech qanday odat rejalashtirilmagan.</i>`;
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

  const habitsRow: any[] = [];
  monthHabits.slice(0, 4).forEach((h) => {
    habitsRow.push(Markup.button.callback(h.name, `view_${h.id}`));
  });

  const buttons: any[] = [];
  if (habitsRow.length > 0) buttons.push(habitsRow);
  buttons.push([Markup.button.callback('🔙 ◀️ Orqaga', 'list_habits')]);

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  await ctx.answerCbQuery();
});

bot.action('filter_all', async (ctx: any) => {
  const userId = ctx.from.id;
  const habits = getHabits(userId);

  let message = `💎 📋 <b>Barcha odatlaringiz ro'yxati (${habits.length} ta):</b>\n\n`;

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

  const habitsRow: any[] = [];
  habits.slice(0, 4).forEach((h) => {
    habitsRow.push(Markup.button.callback(h.name, `view_${h.id}`));
  });

  const buttons: any[] = [];
  if (habitsRow.length > 0) buttons.push(habitsRow);
  buttons.push([Markup.button.callback('🔙 ◀️ Orqaga', 'list_habits')]);

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  await ctx.answerCbQuery();
});

bot.action('list_habits', async (ctx: any) => {
  const userId = ctx.from.id;
  const habits = getHabits(userId);

  if (habits.length === 0) {
    await ctx.editMessageText("✨ Sizda hozircha hech qanday odat yo'q.");
  } else {
    await ctx.editMessageText(
      "📋 ⚡️ <b>Odatlar va Rejalar bo'limi</b>\n\nQaysi davr uchun rejalashtirilgan odatlaringizni ko'rmoqchisiz?",
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

  let message = `📌 📍 👑 <b>Odat batafsil ma'lumotlari:</b>\n\n`;
  message += `<b>Nomi:</b> ${escapeHtml(habit.name)}\n`;
  message += `<b>Takrorlanish turi:</b> ${getPrettyIntervalName(habit)}\n`;
  message += `<b>Eslatma soati:</b> <code>${habit.targetTime}</code>\n`;
  message += `<b>Keyingi bajarish kuni:</b> ${formatDateWithWeekday(habit.nextDueDate)}\n`;
  message += `<b>Qolgan vaqt:</b> <i>${remainingText}</i>\n`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔥 🗑 O\'chirish', `delete_${habit.id}`)],
    [Markup.button.callback('🔙 ◀️ Orqaga', 'list_habits')],
  ]);

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
  await ctx.answerCbQuery();
});

bot.action(/^delete_(.+)$/, async (ctx: any) => {
  const habitId = ctx.match[1];
  const userId = ctx.from.id;
  deleteHabit(userId, habitId);

  await ctx.editMessageText("🔥 🗑 Odat muvaffaqiyatli o'chirildi.");
  await ctx.answerCbQuery("Odat o'chirildi! 🔥 🗑");
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
  });

  await ctx.editMessageText(`🌟 👑 🎉 Barakalla! <b>${escapeHtml(habit.name)}</b> odatini muvaffaqiyatli bajardingiz! Keyingi eslatma kuni: ${formatDateWithWeekday(nextDueDate)}.`, { parse_mode: 'HTML' });
  await ctx.answerCbQuery("Barakalla! 🌟 🎉");
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

  await updateHabit(userId, habitId, { nextDueDate });

  await ctx.editMessageText('❌ 🚫 Bu safargi harakat qoldirildi.');
  await ctx.answerCbQuery("Harakat qoldirildi. ❌ 🚫");
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
    `⚡️ ⏱ <b>${escapeHtml(habit.name)}</b> odati eslatmasi <b>${minutesToAdd} minutga</b> surildi.\n\nYangi eslatma vaqti: <code>${newTargetTime}</code>`,
    { parse_mode: 'HTML' }
  );
  await ctx.answerCbQuery(`${minutesToAdd} minutga surildi! ⚡️ ⏱`);
});

bot.action('toggle_notifications', async (ctx: any) => {
  const userId = ctx.from.id;
  await toggleUserNotifications(userId);
  const { text, keyboard } = buildSettingsMessageAndKeyboard(userId, ctx.from.first_name || 'Foydalanuvchi');
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
  await ctx.answerCbQuery("Eslatma sozlamalari yangilandi!");
});

bot.action('confirm_clear_all', async (ctx: any) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⚠️ 🔥 Ha, barchasini o\'chirish', 'clear_all_habits')],
    [Markup.button.callback('❌ 🚫 Bekor qilish', 'list_habits')],
  ]);
  await ctx.editMessageText("⚠️ ⚡️ <b>Haqiqatan ham barcha odatlaringizni o'chirib tashlamoqchimisiz?</b>\n\nBu amalni ortga qaytarib bo'lmaydi!", { parse_mode: 'HTML', ...keyboard });
  await ctx.answerCbQuery();
});

bot.action('clear_all_habits', async (ctx: any) => {
  const userId = ctx.from.id;
  await clearUserHabits(userId);
  await ctx.editMessageText("🔥 🗑 Barcha odatlaringiz muvaffaqiyatli o'chirildi.");
  await ctx.answerCbQuery("Barcha odatlar o'chirildi! 🔥 🗑");
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
    [Markup.button.callback('⚡️ Tanaffussiz (Har kuni)', 'rest_none')],
    [Markup.button.callback('➡️ Keyingi (Vaqtni kiriting)', 'rest_done')],
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
      "🏖 👑 <b>Tanaffus (dam olish) kunlarini tanlang:</b>\n\nQaysi haftaning kunlarida eslatma yuborilmasligini xohlaysiz?\n\nTanlangan kunlar: <b>Yo'q (Tanaffussiz)</b>",
      { parse_mode: 'HTML', ...buildRestDaysKeyboard([]) }
    );
  } else if (choice === 'haftalik') {
    state.intervalType = 'haftalik';
    state.intervalDescription = 'Har haftada';
    state.restDays = [];
    state.step = 'WAITING_TIME';
    await setUserCreationState(userId, state);
    await ctx.editMessageText("⏰ ⚡️ <b>Odat bajariladigan vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>07:00</code> yoki <code>21:30</code>", { parse_mode: 'HTML' });
  } else if (choice === 'oylik') {
    state.intervalType = 'oylik';
    state.intervalDescription = 'Har oyda 1 marta';
    state.restDays = [];
    state.step = 'WAITING_TIME';
    await setUserCreationState(userId, state);
    await ctx.editMessageText("⏰ ⚡️ <b>Odat bajariladigan vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>07:00</code> yoki <code>21:30</code>", { parse_mode: 'HTML' });
  } else if (choice === 'boshqa') {
    state.intervalType = 'custom';
    state.restDays = [];
    state.step = 'WAITING_CUSTOM_DAYS';
    await setUserCreationState(userId, state);
    await ctx.editMessageText("🔢 ⚡️ <b>Necha kunda 1 marta takrorlanishini xohlaysiz?</b>\n\nFaqat kunlar sonini kiriting (masalan: <code>3</code>, <code>5</code>, <code>20</code>):", { parse_mode: 'HTML' });
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
  const message = `🏖 👑 <b>Tanaffus (dam olish) kunlarini tanlang:</b>\n\nTanlangan tanaffus kunlari: <b>${selectedText}</b>\n\n<i>Kerakli kunlarni bosing va <b>➡️ Keyingi</b> tugmasini bosing:</i>`;

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

  await ctx.editMessageText("⏰ ⚡️ <b>Odat bajariladigan vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>07:00</code> yoki <code>21:30</code>", { parse_mode: 'HTML' });
  await ctx.answerCbQuery("Tanaffussiz tanlandi!");
});

bot.action('rest_done', async (ctx: any) => {
  const userId = ctx.from.id;
  const state = await getUserCreationState(userId);
  if (!state) return;

  state.step = 'WAITING_TIME';
  await setUserCreationState(userId, state);

  await ctx.editMessageText("⏰ ⚡️ <b>Odat bajariladigan vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>07:00</code> yoki <code>21:30</code>", { parse_mode: 'HTML' });
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
      `🌟 ✅ <b>Yangi odat muvaffaqiyatli saqlandi!</b>\n\n` +
      `📌 <b>Nomi:</b> ${escapeHtml(habit.name)}\n` +
      `🔄 <b>Oraliq:</b> ${intervalName}\n` +
      `🏖 <b>Tanaffus kunlari:</b> ${restDaysText}\n` +
      `📅 <b>Boshlanish kuni:</b> <code>${startDateUz}</code>\n` +
      `⏰ <b>Vaqti:</b> Soat <code>${habit.targetTime}</code> da\n` +
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

// Multi-step Habit Registration via Text Input using Persistent DB State
bot.on('text', async (ctx: any) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  const state = await getUserCreationState(userId);

  if (!state) {
    if (!text.startsWith('/')) {
      await ctx.reply(
        "✨ <i>Tushunmadim. Yangi odat qo'shish uchun <b>✨ ➕ Yangi odat</b> tugmasini bosing yoki barcha odatlarni ko'rish uchun <b>📊 📋 Mening odatlarim</b> menyusini tanlang.</i>",
        { parse_mode: 'HTML', ...mainMenuKeyboard }
      );
    }
    return;
  }

  if (state.step === 'WAITING_NAME') {
    state.name = text;
    state.step = 'WAITING_INTERVAL';
    await setUserCreationState(userId, state);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('☀️ ⚡️ Har kuni', 'interval_kunlik')],
      [Markup.button.callback('🗓 ⚡️ Har haftada (7 kunda)', 'interval_haftalik')],
      [Markup.button.callback('🔮 ⚡️ Har oyda (1 marta)', 'interval_oylik')],
      [Markup.button.callback('💎 ⚙️ Boshqa oraliq (Kunlar bilan)', 'interval_boshqa')],
    ]);

    await ctx.reply(`📌 Odat nomi: <b>${escapeHtml(text)}</b>\n\nEndi ushbu odatning takrorlanish oralig'ini tanlang:`, {
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
    await ctx.reply("⏰ ⚡️ <b>Odat bajariladigan vaqtni kiriting (HH:mm formatida):</b>\n\nMasalan: <code>07:00</code> yoki <code>21:30</code>", { parse_mode: 'HTML' });
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
      [Markup.button.callback(`⚡️ Bugundan boshlash (${todayUz})`, 'start_date_today')],
      [Markup.button.callback(`🌅 Ertagadan boshlash (${tomorrowUz})`, 'start_date_tomorrow')],
    ]);

    await ctx.reply(
      `📅 👑 <b>Odat qaysi kundan boshlanishini kiriting (DD.MM.YYYY formatida):</b>\n\n` +
        `Masalan: <code>${tomorrowUz}</code> yoki pastdagi tayyor tugmalardan birini bosing:`,
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
  bot.launch();
}
