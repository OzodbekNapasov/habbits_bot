---
name: telegram-bot-mastery
description: Expert guidelines and best practices for developing, debugging, and scaling Telegram Bots with Telegraf or grammY.
---

# Telegram Bot Mastery Skill

## Overview
This skill provides production-grade standards, architecture patterns, and debugging strategies for building high-performance Telegram bots in Node.js/TypeScript using Telegraf or grammY.

## Core Rules & Patterns
1. **Access Control & Middleware**: Always place access control middleware at the very top of the middleware chain.
2. **Inline Keyboard Actions**: Every `Markup.inlineKeyboard` button callback must have a corresponding `bot.action()` pattern handler. Always answer callback queries using `ctx.answerCbQuery()` to prevent loading spinners.
3. **HTML Parse Mode**: Escape user-generated text using `escapeHtml()` before rendering in HTML mode to prevent malformed tag crashes.
4. **State Management**: Persist user creation/conversation states in database rather than in-memory objects to survive process restarts.
5. **Webhook vs Long-Polling**: Use Webhooks (e.g., Vercel / serverless) for production scalability and long-polling for local development.
