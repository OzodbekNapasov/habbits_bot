---
name: telegram-mini-app
description: Building Telegram WebApp / Mini Apps with Telegram SDK, theme integration, and viewport adaptation.
---

# Telegram Mini App Skill

## Guidelines
1. **Telegram WebApp SDK**: Initialize `window.Telegram.WebApp.ready()` and `expand()`.
2. **User Context Parsing**: Extract user info safely from `tg.initDataUnsafe`.
3. **Theme Alignment**: Match background colors and text styles to Telegram theme parameters.
4. **Haptic Feedback**: Use `tg.HapticFeedback` for button presses and user interactions.
5. **REST API Integration**: Connect WebApp UI seamlessly to backend `/api/` endpoints.
