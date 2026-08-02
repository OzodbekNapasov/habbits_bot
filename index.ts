import { Bot, Context, session, Keyboard, InlineKeyboard } from 'grammy';
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from '@grammyjs/conversations';
import dotenv from 'dotenv';
import {
  saveUser,
  getHabits,
  getUser,
  addHabit,
  updateHabit,
  deleteHabit,
  findHabitById,
  toggleUserNotifications,
  clearUserHabits,
} from './database';
import {
  isValidTimeFormat,
  calculateNextDueDate,
  calculateNextDueDateAfterCompletion,
  mapLabelToIntervalType,
  formatDate,
  getOneHourLaterTime,
  addMinutesToTime,
  getTodayDateString,
  getTomorrowDateString,
  isValidDateFormat,
  calculateNextDueDateFromStartDate,
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
} from './utils';
import { IntervalType } from './types';
import { initReminderCron, triggerDailyDigest } from './cron';
import { startWebServer } from './server';

// Define Context and Conversation types for grammY
export type MyContext = Context & ConversationFlavor;
export type MyConversation = Conversation<MyContext>;

// Load environment variables from .env file
dotenv.config();

const token = process.env.BOT_TOKEN || '';

// Initialize Telegram bot with grammY Context flavor
const bot = new Bot<MyContext>(token);

const ALLOWED_USER_ID = Number(process.env.ALLOWED_USER_ID || 8135594558);

// Access control middleware: Only allow execution for ALLOWED_USER_ID (8135594558)
bot.use(async (ctx, next) => {
  const fromId = ctx.from?.id;
  if (!fromId || Number(fromId) !== Number(ALLOWED_USER_ID)) {
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery({
          text: "⚠️ Kechirasiz, ushbu bot shaxsiy va faqat ruxsat berilgan foydalanuvchi uchun ishlaydi.",
          show_alert: true,
        });
      } catch {
        // ignore
      }
    } else {
      await ctx.reply(
        "⚠️ <b>Kechirasiz, ushbu bot shaxsiy va faqat ruxsat berilgan foydalanuvchi uchun mo'ljallangan.</b>",
        { parse_mode: 'HTML' }
      );
    }
    return; // Block execution for unauthorized users
  }
  await next();
});

// 1. Persistent Main Menu Keyboard in Uzbek
const mainMenuKeyboard = new Keyboard()
  .text('➕ Yangi odat')
  .text('📋 Mening odatlarim')
  .row()
  .text('⚙️ Sozlamalar')
  .text('🌐 Mini App')
  .resized();

// 2. Session middleware (required for conversations)
bot.use(session({ initial: () => ({}) }));

// 3. Register conversations plugin middleware
bot.use(conversations());

/**
 * Helper to build interactive weekday selection keyboard for rest days
 */
function buildRestDaysKeyboard(selectedDays: string[]): InlineKeyboard {
  const days = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
  const keyboard = new InlineKeyboard();

  days.forEach((day, index) => {
    const label = selectedDays.includes(day) ? `✅ ${day}` : day;
    keyboard.text(label, `toggle_rest_${day}`);
    if ((index + 1) % 3 === 0) {
      keyboard.row();
    }
  });

  keyboard.row().text('➡️ Tayyor', 'rest_done');
  keyboard.row().text('❌ Bekor qilish', 'cancel_habit_creation');
  return keyboard;
}

/**
 * Helper to check cancellation or main menu button press during habit creation.
 * Exits conversation and directly opens the requested main menu section if clicked.
 */
async function isCancelledUpdate(ctx: MyContext, updateContext: any): Promise<boolean> {
  const isCancelData = updateContext.callbackQuery?.data === 'cancel_habit_creation';
  const textMsg = updateContext.message?.text?.trim();
  const userId = ctx.from?.id;

  const MENU_BUTTONS = [
    '➕ Yangi odat',
    '📋 Mening odatlarim',
    '⚙️ Sozlamalar',
    '🌐 Mini App',
    '/start',
    '/bekor',
    '/cancel',
    '❌ Bekor qilish',
  ];

  const isMenuTrigger = isCancelData || (textMsg && MENU_BUTTONS.includes(textMsg));

  if (isMenuTrigger) {
    if (updateContext.callbackQuery) {
      try {
        await updateContext.answerCallbackQuery();
      } catch {
        // ignore
      }
    }

    if (textMsg === '📋 Mening odatlarim' && userId) {
      const habits = getHabits(userId);
      if (habits.length === 0) {
        await ctx.reply("Sizda hozircha hech qanday odat yo'q.", { reply_markup: mainMenuKeyboard });
      } else {
        await ctx.reply(
          "📋 *Odatlar va Rejalar bo'limi*\n\nQaysi davr uchun rejalashtirilgan odatlaringizni ko'rmoqchisiz?",
          { parse_mode: 'Markdown', reply_markup: buildPeriodSelectionKeyboard() }
        );
      }
    } else if (textMsg === '⚙️ Sozlamalar' && userId && ctx.from) {
      const { text, keyboard } = buildSettingsMessageAndKeyboard(userId, ctx.from.first_name);
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else if (textMsg === '🌐 Mini App') {
      const miniAppKeyboard = new InlineKeyboard().url('🌐 Mini App-ni ochish', 'http://localhost:3000');
      await ctx.reply(
        `🌐 *Odatlar Trekeri Mini App*\n\nInteraktiv taqvim va oylik progressni ko'rish uchun quyidagi tugmani bosing:`,
        { parse_mode: 'Markdown', reply_markup: miniAppKeyboard }
      );
    } else if (textMsg === '/start') {
      await ctx.reply(
        `Salom! Men sizning shaxsiy odatlar trekeriman. Odatlarni boshqarish uchun pastdagi menyudan foydalaning.`,
        { reply_markup: mainMenuKeyboard }
      );
    } else {
      // Default response for "❌ Bekor qilish", /bekor, /cancel or cancel inline button
      await ctx.reply("❌ Odat qo'shish bekor qilindi.", {
        reply_markup: mainMenuKeyboard,
      });
    }

    return true;
  }
  return false;
}

/**
 * Conversation handler for creating a new habit
 */
async function addHabitConversation(conversation: MyConversation, ctx: MyContext) {
  const cancelInlineKeyboard = new InlineKeyboard().text('❌ Bekor qilish', 'cancel_habit_creation');

  // Step 1: Ask habit name
  await ctx.reply('Qanday odatni shakllantirmoqchisiz? (Masalan: 6kg gantel bilan mashq qilish)', {
    reply_markup: cancelInlineKeyboard,
  });

  const nameCtx = await conversation.waitFor(['message:text', 'callback_query:data']);
  if (await isCancelledUpdate(ctx, nameCtx)) return;

  const habitName = nameCtx.message?.text?.trim();
  if (!habitName) return;

  // Step 2: Ask interval with Inline Keyboard in Uzbek (including custom day interval)
  const intervalInlineKeyboard = new InlineKeyboard()
    .text('Kunlik', 'interval_kunlik')
    .text('Haftalik', 'interval_haftalik')
    .row()
    .text('2 haftalik', 'interval_2_haftalik')
    .text('Oylik', 'interval_oylik')
    .row()
    .text('✏️ Maxsus kun (Masalan: 20 kun)', 'interval_custom')
    .row()
    .text('❌ Bekor qilish', 'cancel_habit_creation');

  await ctx.reply('Qanday oraliqda takrorlab turaylik?', {
    reply_markup: intervalInlineKeyboard,
  });

  let intervalType: IntervalType | null = null;
  let customIntervalDays: number | undefined = undefined;
  let intervalDescription = '';

  while (!intervalType) {
    const cbCtx = await conversation.waitFor(['callback_query:data', 'message:text']);
    if (await isCancelledUpdate(ctx, cbCtx)) return;

    const data = cbCtx.callbackQuery?.data;

    if (data && data.startsWith('interval_')) {
      const rawType = data.replace('interval_', '');
      if (['kunlik', 'haftalik', '2_haftalik', 'oylik', 'custom'].includes(rawType)) {
        intervalType = rawType as IntervalType;
        await cbCtx.answerCallbackQuery();

        if (intervalType === 'custom') {
          let validDays = false;
          await ctx.reply("Necha kun oralig'ida eslatib turay? (Faqat son kiriting, masalan: 3, 10, 20):", {
            reply_markup: cancelInlineKeyboard,
          });

          while (!validDays) {
            const daysCtx = await conversation.waitFor(['message:text', 'callback_query:data']);
            if (await isCancelledUpdate(ctx, daysCtx)) return;

            const inputNum = parseInt(daysCtx.message?.text?.trim() || '', 10);

            if (!isNaN(inputNum) && inputNum > 0) {
              customIntervalDays = inputNum;
              intervalDescription = `Har ${customIntervalDays} kunda`;
              validDays = true;
            } else {
              await ctx.reply("⚠️ Iltimos, faqat noldan katta son kiriting (Masalan: 20):", {
                reply_markup: cancelInlineKeyboard,
              });
            }
          }
        } else {
          intervalDescription =
            intervalType === 'kunlik'
              ? 'Kunlik (Har kuni)'
              : intervalType === 'haftalik'
              ? 'Haftalik (Har 7 kunda)'
              : intervalType === '2_haftalik'
              ? '2 haftalik (Har 14 kunda)'
              : 'Oylik (Har oy)';
        }
      }
    }
  }

  // Step 3: Ask Start Date (Boshlanish kuni)
  const todayStr = getTodayDateString();
  const tomorrowStr = getTomorrowDateString();

  const startDateInlineKeyboard = new InlineKeyboard()
    .text(`Bugundan (${formatDateUzbek(todayStr, false)})`, 'start_today')
    .text(`Ertadan (${formatDateUzbek(tomorrowStr, false)})`, 'start_tomorrow')
    .row()
    .text('📅 Boshqa sana (YYYY-MM-DD)', 'start_custom')
    .row()
    .text('❌ Bekor qilish', 'cancel_habit_creation');

  await ctx.reply('Ushbu odat qaysi kundan boshlab eslatib turilsin?', {
    reply_markup: startDateInlineKeyboard,
  });

  let startDate: string | null = null;

  while (!startDate) {
    const startCtx = await conversation.waitFor(['callback_query:data', 'message:text']);
    if (await isCancelledUpdate(ctx, startCtx)) return;

    const startData = startCtx.callbackQuery?.data;

    if (startData === 'start_today') {
      startDate = todayStr;
      await startCtx.answerCallbackQuery();
    } else if (startData === 'start_tomorrow') {
      startDate = tomorrowStr;
      await startCtx.answerCallbackQuery();
    } else if (startData === 'start_custom') {
      await startCtx.answerCallbackQuery();
      let validCustomDate = false;
      await ctx.reply('Boshlanish sanasini YYYY-MM-DD formatida kiriting (Masalan: 2026-08-10):', {
        reply_markup: cancelInlineKeyboard,
      });

      while (!validCustomDate) {
        const customDateCtx = await conversation.waitFor(['message:text', 'callback_query:data']);
        if (await isCancelledUpdate(ctx, customDateCtx)) return;

        const inputDate = customDateCtx.message?.text?.trim() || '';

        if (isValidDateFormat(inputDate)) {
          startDate = inputDate;
          validCustomDate = true;
        } else {
          await ctx.reply(
            "⚠️ Sana formati noto'g'ri. Iltimos, YYYY-MM-DD formatida kiriting (Masalan: 2026-08-10):",
            { reply_markup: cancelInlineKeyboard }
          );
        }
      }
    }
  }

  // Step 4: Ask if there are any rest days (dam olish kunlari)
  const restOptionKeyboard = new InlineKeyboard()
    .text('Ha, dam olish kuni bor', 'rest_yes')
    .row()
    .text("Yo'q, dam olish kuni yo'q", 'rest_no')
    .row()
    .text('❌ Bekor qilish', 'cancel_habit_creation');

  await ctx.reply('Ushbu odat uchun dam olish (tanaffus) kunlari bormi?', {
    reply_markup: restOptionKeyboard,
  });

  let selectedRestDays: string[] = [];
  let restDecisionMade = false;

  while (!restDecisionMade) {
    const restOptCtx = await conversation.waitFor(['callback_query:data', 'message:text']);
    if (await isCancelledUpdate(ctx, restOptCtx)) return;

    const data = restOptCtx.callbackQuery?.data;

    if (data === 'rest_no') {
      restDecisionMade = true;
      await restOptCtx.answerCallbackQuery();
    } else if (data === 'rest_yes') {
      await restOptCtx.answerCallbackQuery();

      let selectingWeekdays = true;

      await ctx.reply(
        "Qaysi kun(lar) dam olish kuni deb belgilansin? (Kerakli kunlarni tanlab, '➡️ Tayyor' tugmasini bosing):",
        {
          reply_markup: buildRestDaysKeyboard(selectedRestDays),
        }
      );

      while (selectingWeekdays) {
        const dayCtx = await conversation.waitFor(['callback_query:data', 'message:text']);
        if (await isCancelledUpdate(ctx, dayCtx)) return;

        const dayData = dayCtx.callbackQuery?.data;

        if (dayData === 'rest_done') {
          selectingWeekdays = false;
          restDecisionMade = true;
          await dayCtx.answerCallbackQuery();
        } else if (dayData && dayData.startsWith('toggle_rest_')) {
          const dayName = dayData.replace('toggle_rest_', '');

          if (selectedRestDays.includes(dayName)) {
            selectedRestDays = selectedRestDays.filter((d) => d !== dayName);
          } else {
            selectedRestDays.push(dayName);
          }

          try {
            await dayCtx.editMessageReplyMarkup({
              reply_markup: buildRestDaysKeyboard(selectedRestDays),
            });
          } catch {
            // Ignore markup edit errors if unchanged
          }

          await dayCtx.answerCallbackQuery();
        }
      }
    }
  }

  // Step 5: Ask target time
  await ctx.reply('Aynan soat nechida eslatishimni xohlaysiz? (Masalan, 16:00)', {
    reply_markup: cancelInlineKeyboard,
  });

  let targetTime: string | null = null;

  while (!targetTime) {
    const timeCtx = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (await isCancelledUpdate(ctx, timeCtx)) return;

    const inputTime = timeCtx.message?.text?.trim() || '';

    if (isValidTimeFormat(inputTime)) {
      targetTime = inputTime;
    } else {
      await ctx.reply(
        "⚠️ Vaqt formati noto'g'ri. Iltimos, HH:mm formatida kiriting (Masalan: 16:00):",
        { reply_markup: cancelInlineKeyboard }
      );
    }
  }

  // Step 6: Calculate nextDueDate from startDate and save habit to db.json
  const userId = ctx.from?.id;

  if (userId) {
    if (!getUser(userId) && ctx.from) {
      saveUser({ id: userId, firstName: ctx.from.first_name });
    }

    const nextDueDate = calculateNextDueDateFromStartDate(
      startDate,
      targetTime,
      intervalType,
      selectedRestDays,
      customIntervalDays
    );

    addHabit(userId, {
      name: habitName,
      intervalType: intervalType,
      customIntervalDays: customIntervalDays,
      intervalDescription: intervalDescription,
      startDate: startDate,
      restDays: selectedRestDays,
      targetTime: targetTime,
      lastCompletedAt: null,
      nextDueDate: nextDueDate,
    });
  }

  const restDaysSummary = selectedRestDays.length > 0 ? selectedRestDays.join(', ') : "Yo'q";
  const calculatedNext = calculateNextDueDateFromStartDate(
    startDate,
    targetTime,
    intervalType,
    selectedRestDays,
    customIntervalDays
  );

  const remainingText = getDaysRemainingText(calculatedNext);

  // Step 7: Reply with detailed confirmation message and restore main menu keyboard
  await ctx.reply(
    `✅ *Odat muvaffaqiyatli saqlandi!*\n\n` +
      `📌 *Odat:* ${habitName}\n` +
      `⏱ *Oraliq:* ${intervalDescription}\n` +
      `📅 *Boshlanish kuni:* ${formatDateUzbek(startDate, false)}\n` +
      `🏖 *Dam olish kunlari:* ${restDaysSummary}\n` +
      `⏰ *Eslatma vaqti:* ${targetTime} da\n` +
      `📅 *Birinchi eslatma sanasi:* ${formatDateUzbek(calculatedNext, true)}\n` +
      `⏳ *Qolgan vaqt:* ${remainingText}`,
    {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard,
    }
  );
}

// Register habit creation conversation
bot.use(createConversation(addHabitConversation));

/**
 * /start command handler
 * Saves user details to db.json and sends welcome message with persistent Reply Keyboard.
 */
bot.command('start', async (ctx) => {
  const from = ctx.from;
  if (!from) return;

  saveUser({
    id: from.id,
    firstName: from.first_name,
  });

  await ctx.reply(
    `Salom! Men sizning shaxsiy odatlar trekeriman. Odatlarni boshqarish uchun pastdagi menyudan foydalaning.`,
    {
      reply_markup: mainMenuKeyboard,
    }
  );
});

/**
 * Bot hears "➕ Yangi odat" -> Triggers habit registration conversation
 */
bot.hears('➕ Yangi odat', async (ctx) => {
  await ctx.conversation.enter('addHabitConversation');
});

/**
 * /bekor command or "❌ Bekor qilish" hears handler
 */
bot.command('bekor', async (ctx) => {
  await ctx.reply("❌ Odat qo'shish bekor qilindi.", {
    reply_markup: mainMenuKeyboard,
  });
});

bot.hears('❌ Bekor qilish', async (ctx) => {
  await ctx.reply("❌ Odat qo'shish bekor qilindi.", {
    reply_markup: mainMenuKeyboard,
  });
});

/**
 * /digest or /test_digest command handler to manually trigger 07:00 AM Morning Digest
 */
bot.command(['digest', 'test_digest'], async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  await triggerDailyDigest(bot, userId);
});

/**
 * Helper to build period filter keyboard
 */
function buildPeriodSelectionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 Bugungi rejalar', 'filter_today')
    .text('🗓 Shu haftalik rejalar', 'filter_week')
    .row()
    .text('📆 Shu oylik rejalar', 'filter_month')
    .text('📋 Barcha odatlarim', 'filter_all');
}

/**
 * Helper to build Settings message and Inline Keyboard
 */
function buildSettingsMessageAndKeyboard(userId: number, firstName: string) {
  const user = getUser(userId);
  const habits = getHabits(userId);
  const notifEnabled = user?.notificationsEnabled !== false;

  const notifStatusText = notifEnabled ? '🟢 Yoqilgan' : "🔴 O'chirilgan";
  const notifBtnText = notifEnabled ? "🔴 Eslatmalarni o'chirish" : '🟢 Eslatmalarni yoqish';

  const text =
    `⚙️ *Sozlamalar paneli*\n\n` +
    `👤 *Foydalanuvchi:* ${firstName} (ID: \`${userId}\`)\n` +
    `🔔 *Eslatmalar holati:* ${notifStatusText}\n` +
    `📊 *Odatlaringiz soni:* ${habits.length} ta\n`;

  const keyboard = new InlineKeyboard()
    .text(notifBtnText, 'toggle_notifications')
    .row()
    .text("🧹 Barcha odatlarni tozalash", 'confirm_clear_habits');

  return { text, keyboard };
}

/**
 * Bot hears "📋 Mening odatlarim" -> Shows period selection menu (Today, Week, Month, All)
 */
bot.hears('📋 Mening odatlarim', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const habits = getHabits(userId);

  if (habits.length === 0) {
    await ctx.reply("Sizda hozircha hech qanday odat yo'q.", {
      reply_markup: mainMenuKeyboard,
    });
    return;
  }

  await ctx.reply(
    "📋 *Odatlar va Rejalar bo'limi*\n\nQaysi davr uchun rejalashtirilgan odatlaringizni ko'rmoqchisiz?",
    {
      parse_mode: 'Markdown',
      reply_markup: buildPeriodSelectionKeyboard(),
    }
  );
});

/**
 * Callback query handler for returning to period selection menu (list_period_menu)
 */
bot.callbackQuery('list_period_menu', async (ctx) => {
  await ctx.editMessageText(
    "📋 *Odatlar va Rejalar bo'limi*\n\nQaysi davr uchun rejalashtirilgan odatlaringizni ko'rmoqchisiz?",
    {
      parse_mode: 'Markdown',
      reply_markup: buildPeriodSelectionKeyboard(),
    }
  );
  await ctx.answerCallbackQuery();
});

/**
 * Renders weekly habits schedule for a specific week offset (0 = current week, 1 = next week, -1 = previous week)
 */
async function renderWeekSchedule(ctx: MyContext, offset: number = 0, isEdit: boolean = true) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const habits = getHabits(userId);
  const weekInfo = getWeekDaysByOffset(offset);
  const weekDateStrs = weekInfo.days.map((d) => d.dateStr.trim());

  // Filter habits scheduled to occur on any of this week's 7 dates
  const weekHabits = habits.filter((h) => weekInfo.days.some((d) => isHabitScheduledOnDate(h, d.dateStr)));

  const prevOffset = offset - 1;
  const nextOffset = offset + 1;

  let message = `🗓 <b>Haftalik rejalaringiz</b>\n📌 <b>Oraliq:</b> <i>${weekInfo.startDateUz} — ${weekInfo.endDateUz}</i>\n\n`;

  if (weekHabits.length === 0) {
    message += `<blockquote>ℹ️ <b>Ushbu haftada (${weekInfo.startDateUz} — ${weekInfo.endDateUz}) hech qanday rejalashtirilgan odat topilmadi.</b></blockquote>`;
  } else {
    weekInfo.days.forEach((day) => {
      const habitsForDay = habits.filter((h) => isHabitScheduledOnDate(h, day.dateStr));
      if (habitsForDay.length > 0) {
        message += `<blockquote>`;
        message += `🔹 <b>${day.weekdayName} (${day.formattedDateUz}):</b>\n`;
        habitsForDay.forEach((habit) => {
          const remainingText = getDaysRemainingText(day.dateStr);
          message += `• 📌 <b>${escapeHtml(habit.name)}</b> (Soat: ${habit.targetTime} da) — <i>${remainingText}</i>\n`;
        });
        message += `</blockquote>\n`;
      }
    });

    message += `<i>Odatni boshqarish yoki haftalarni almashtirish uchun quyidagi tugmalardan birini bosing:</i>`;
  }

  const keyboard = new InlineKeyboard();
  if (weekHabits.length > 0) {
    weekHabits.forEach((habit) => {
      keyboard.text(habit.name, `view_${habit.id}`).row();
    });
  }

  // Navigation row: [ ⬅️ Oldingi hafta ] [ ➡️ Keyingi hafta ]
  keyboard
    .text('⬅️ Oldingi hafta', `week_nav_${prevOffset}`)
    .text('➡️ Keyingi hafta', `week_nav_${nextOffset}`)
    .row()
    .text('🔙 Orqaga', 'list_period_menu');

  if (isEdit) {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
}

/**
 * Callback query handler for week navigation (week_nav_<offset>)
 */
bot.callbackQuery(/^week_nav_(-?\d+)$/, async (ctx) => {
  const offset = parseInt(ctx.match[1], 10);
  await renderWeekSchedule(ctx, offset, true);
  await ctx.answerCallbackQuery();
});

/**
 * Callback query handler for period filtering (filter_today, filter_week, filter_month, filter_all)
 */
bot.callbackQuery(/^filter_(today|week|month|all)$/, async (ctx) => {
  const filterType = ctx.match[1];
  const userId = ctx.from.id;
  const habits = getHabits(userId);
  const todayStr = getTodayDateString();

  if (filterType === 'week') {
    await renderWeekSchedule(ctx, 0, true);
    await ctx.answerCallbackQuery();
    return;
  }

  let filteredHabits = habits;
  let periodTitle = "📋 <b>Barcha odatlaringiz ro'yxati:</b>";

  if (filterType === 'today') {
    filteredHabits = habits.filter((h) => isHabitForToday(h.nextDueDate, todayStr));
    periodTitle = '📅 <b>Bugungi rejangizdagi odatlar:</b>';
  } else if (filterType === 'month') {
    filteredHabits = habits.filter((h) => isHabitInNextDays(h.nextDueDate, 30));
    periodTitle = '📆 <b>Ushbu oydagi rejalaringiz:</b>';
  }

  if (filteredHabits.length === 0) {
    const keyboard = new InlineKeyboard().text('🔙 Orqaga', 'list_period_menu');
    await ctx.editMessageText('Ushbu davr uchun hech qanday rejalashtirilgan odat topilmadi.', {
      reply_markup: keyboard,
    });
  } else {
    let message = `${periodTitle}\n\n`;

    filteredHabits.forEach((habit, index) => {
      const prettyInterval = getPrettyIntervalName(habit);
      const formattedDate = formatDateWithWeekday(habit.nextDueDate);
      const restText = habit.restDays && habit.restDays.length > 0 ? habit.restDays.join(', ') : "Yo'q";
      const remainingText = getDaysRemainingText(habit.nextDueDate);

      message += `<blockquote>`;
      message += `📌 <b>${index + 1}. ${escapeHtml(habit.name)}</b>\n`;
      message += `🔄 <b>Oraliq:</b> ${escapeHtml(prettyInterval)}\n`;
      message += `⏰ <b>Vaqt:</b> ${habit.targetTime} da\n`;
      message += `📅 <b>Keyingi sana:</b> ${formattedDate}\n`;
      message += `⏳ <b>Qolgan vaqt:</b> ${remainingText}\n`;
      if (habit.restDays && habit.restDays.length > 0) {
        message += `🏖 <b>Dam olish:</b> ${escapeHtml(restText)}\n`;
      }
      message += `</blockquote>\n`;
    });

    message += `<i>Odatni boshqarish yoki o'chirish uchun quyidagi tugmalardan birini bosing:</i>`;

    const keyboard = new InlineKeyboard();
    filteredHabits.forEach((habit) => {
      keyboard.text(habit.name, `view_${habit.id}`).row();
    });
    keyboard.row().text('🔙 Orqaga', 'list_period_menu');

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  await ctx.answerCallbackQuery();
});

/**
 * Bot hears "⚙️ Sozlamalar" -> Shows interactive Settings Panel
 */
bot.hears('⚙️ Sozlamalar', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const firstName = ctx.from?.first_name || 'Foydalanuvchi';
  const { text, keyboard } = buildSettingsMessageAndKeyboard(userId, firstName);

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

/**
 * Callback query handler for toggling notifications in Settings
 */
bot.callbackQuery('toggle_notifications', async (ctx) => {
  const userId = ctx.from.id;
  const isEnabled = toggleUserNotifications(userId);

  const { text, keyboard } = buildSettingsMessageAndKeyboard(userId, ctx.from.first_name);

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });

  const alertMsg = isEnabled ? 'Eslatmalar yoqildi! 🟢' : "Eslatmalar o'chirildi! 🔴";
  await ctx.answerCallbackQuery({ text: alertMsg });
});

/**
 * Callback query handler for confirming clear all habits
 */
bot.callbackQuery('confirm_clear_habits', async (ctx) => {
  const confirmKeyboard = new InlineKeyboard()
    .text("✅ Ha, barchasini o'chirish", 'clear_all_habits')
    .row()
    .text('❌ Bekor qilish', 'open_settings');

  await ctx.editMessageText("⚠️ *Rostdan ham barcha odatlaringizni o'chirib tashlamoqchimisiz?*", {
    parse_mode: 'Markdown',
    reply_markup: confirmKeyboard,
  });

  await ctx.answerCallbackQuery();
});

/**
 * Callback query handler for returning to main Settings panel
 */
bot.callbackQuery('open_settings', async (ctx) => {
  const userId = ctx.from.id;
  const { text, keyboard } = buildSettingsMessageAndKeyboard(userId, ctx.from.first_name);

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });

  await ctx.answerCallbackQuery();
});

/**
 * Callback query handler for clearing all habits
 */
bot.callbackQuery('clear_all_habits', async (ctx) => {
  const userId = ctx.from.id;
  clearUserHabits(userId);

  await ctx.editMessageText("✅ Barcha odatlaringiz muvaffaqiyatli tozalandi.", {
    reply_markup: undefined,
  });

  await ctx.answerCallbackQuery({ text: 'Barcha odatlar tozalandi! 🧹' });
});

/**
 * Bot hears "🌐 Mini App" -> Opens Web App Dashboard
 */
bot.hears('🌐 Mini App', async (ctx) => {
  const miniAppKeyboard = new InlineKeyboard().url(
    '🌐 Mini App-ni ochish',
    'http://localhost:3000'
  );

  await ctx.reply(
    `🌐 *Odatlar Trekeri Mini App*\n\n` +
      `Interaktiv taqvim va oylik progressni ko'rish uchun quyidagi tugmani bosing:`,
    {
      parse_mode: 'Markdown',
      reply_markup: miniAppKeyboard,
    }
  );
});

/**
 * Callback query handler for "✅ Bajarildi" (done_<habit_id>)
 */
bot.callbackQuery(/^done_(.+)$/, async (ctx) => {
  const habitId = ctx.match[1];
  const userId = ctx.from.id;

  const habitInfo = findHabitById(habitId);

  if (!habitInfo) {
    await ctx.answerCallbackQuery({ text: 'Odat topilmadi!' });
    return;
  }

  const { habit } = habitInfo;
  const now = new Date();
  const lastCompletedAt = formatDate(now);
  const nextDueDate = calculateNextDueDateAfterCompletion(
    habit.intervalType,
    habit.targetTime,
    now,
    habit.restDays,
    habit.customIntervalDays
  );

  // Update habit in db.json
  updateHabit(userId, habitId, {
    lastCompletedAt,
    nextDueDate,
  });

  // Edit original message text and remove inline keyboard
  await ctx.editMessageText('✅ Bajarildi! Keyingi safargacha.', {
    reply_markup: undefined,
  });

  await ctx.answerCallbackQuery({ text: 'Barakalla! Odat bajarildi deb belgilandi. 🎉' });
});

/**
 * Callback query handler for Multi-Snooze buttons (delay_15_<habit_id>, delay_30_<habit_id>, delay_60_<habit_id>)
 */
bot.callbackQuery(/^delay_(\d+)_(.+)$/, async (ctx) => {
  const minutesToAdd = parseInt(ctx.match[1], 10);
  const habitId = ctx.match[2];
  const userId = ctx.from.id;

  const habitInfo = findHabitById(habitId);

  if (!habitInfo) {
    await ctx.answerCallbackQuery({ text: 'Odat topilmadi!' });
    return;
  }

  const { habit } = habitInfo;
  const newTargetTime = addMinutesToTime(habit.targetTime, minutesToAdd);

  // Update targetTime in db.json
  updateHabit(userId, habitId, {
    targetTime: newTargetTime,
  });

  const durationText = minutesToAdd === 60 ? '1 soatdan' : `${minutesToAdd} daqiqadan`;

  // Edit original message text and remove inline keyboard
  await ctx.editMessageText(`🕒 Eslatma ${durationText} keyinga surildi (${newTargetTime}).`, {
    reply_markup: undefined,
  });

  await ctx.answerCallbackQuery({ text: `Eslatma ${durationText} keyinga surildi.` });
});

/**
 * Callback query handler for "❌ Qoldirish" (skip_<habit_id>)
 */
bot.callbackQuery(/^skip_(.+)$/, async (ctx) => {
  const habitId = ctx.match[1];
  const userId = ctx.from.id;

  const habitInfo = findHabitById(habitId);

  if (!habitInfo) {
    await ctx.answerCallbackQuery({ text: 'Odat topilmadi!' });
    return;
  }

  const { habit } = habitInfo;
  const now = new Date();

  // Calculate nextDueDate without setting lastCompletedAt
  const nextDueDate = calculateNextDueDateAfterCompletion(
    habit.intervalType,
    habit.targetTime,
    now,
    habit.restDays,
    habit.customIntervalDays
  );

  // Update nextDueDate in db.json
  updateHabit(userId, habitId, {
    nextDueDate,
  });

  // Edit original message text and remove inline keyboard
  await ctx.editMessageText('❌ Bu safargi harakat qoldirildi.', {
    reply_markup: undefined,
  });

  await ctx.answerCallbackQuery({ text: 'Harakat qoldirildi. ❌' });
});

/**
 * Callback query handler for viewing habit details (view_<habit_id>)
 */
bot.callbackQuery(/^view_(.+)$/, async (ctx) => {
  const habitId = ctx.match[1];
  const habitInfo = findHabitById(habitId);

  if (!habitInfo) {
    await ctx.answerCallbackQuery({ text: 'Odat topilmadi!' });
    return;
  }

  const { habit } = habitInfo;
  const intervalText =
    habit.intervalType === 'kunlik'
      ? 'Kunlik'
      : habit.intervalType === 'haftalik'
      ? 'Haftalik'
      : habit.intervalType === '2_haftalik'
      ? '2 haftalik'
      : 'Oylik';

  const intervalDesc = habit.intervalDescription || intervalText;
  const restDaysText = habit.restDays && habit.restDays.length > 0 ? habit.restDays.join(', ') : "Yo'q";

  const startDateText = habit.startDate ? formatDateUzbek(habit.startDate, false) : "Bugun";
  const nextDueDateText = formatDateUzbek(habit.nextDueDate, true);
  const remainingText = getDaysRemainingText(habit.nextDueDate);

  const detailsText =
    `📌 Nomi: ${habit.name}\n` +
    `⏱ Oraliq: ${intervalDesc}\n` +
    `📅 Boshlanish kuni: ${startDateText}\n` +
    `🏖 Dam olish kunlari: ${restDaysText}\n` +
    `⏰ Vaqti: ${habit.targetTime} da\n` +
    `📅 Keyingi safar: ${nextDueDateText}\n` +
    `⏳ Qolgan vaqt: ${remainingText}`;

  const detailKeyboard = new InlineKeyboard()
    .text('🔙 Orqaga', 'list_habits')
    .text("🗑 O'chirish", `delete_${habit.id}`);

  await ctx.editMessageText(detailsText, {
    reply_markup: detailKeyboard,
  });

  await ctx.answerCallbackQuery();
});

/**
 * Callback query handler for returning to habits list (list_habits)
 */
bot.callbackQuery('list_habits', async (ctx) => {
  const userId = ctx.from.id;
  const habits = getHabits(userId);

  if (habits.length === 0) {
    await ctx.editMessageText("Sizda hozircha hech qanday odat yo'q.", {
      reply_markup: undefined,
    });
  } else {
    await ctx.editMessageText(
      "📋 *Odatlar va Rejalar bo'limi*\n\nQaysi davr uchun rejalashtirilgan odatlaringizni ko'rmoqchisiz?",
      { parse_mode: 'Markdown', reply_markup: buildPeriodSelectionKeyboard() }
    );
  }

  await ctx.answerCallbackQuery();
});

/**
 * Callback query handler for deleting a habit (delete_<habit_id>)
 */
bot.callbackQuery(/^delete_(.+)$/, async (ctx) => {
  const habitId = ctx.match[1];
  const userId = ctx.from.id;

  deleteHabit(userId, habitId);

  await ctx.editMessageText("✅ Odat o'chirildi.", {
    reply_markup: undefined,
  });

  await ctx.answerCallbackQuery({ text: "Odat o'chirildi! 🗑" });
});

/**
 * Global error handling middleware
 */
bot.catch((err) => {
  console.error(`Bot xatoligi yuz berdi:`, err.error);
});

export { bot };

if (process.env.VERCEL !== '1') {
  // Initialize Turso tables and load cloud database data
  initTursoTables().then(() => {
    loadFromTurso();
  });

  // Initialize 1-minute reminder and dayjest cron jobs
  initReminderCron(bot);

  // Initialize HTTP Web Server for Telegram Mini App & REST APIs
  startWebServer();

  // Start the bot
  console.log('🤖 Telegram Odatlar Boti ishga tushmoqda...');
  bot.start();
}
