---
name: i18n-localization
description: Multi-language internationalization (i18n), translation key management, and locale formatting.
---

# Internationalization (i18n) Skill

## Guidelines
1. **Key-Based Translation**: Never hardcode user-facing strings; use key paths (e.g. `common.submit`).
2. **Pluralization & Interpolation**: Use i18n libraries for plural forms and parameter interpolation.
3. **Locale Number & Date Formatting**: Use native `Intl.DateTimeFormat` and `Intl.NumberFormat`.
4. **RTL Support**: Design CSS layouts to accommodate Right-To-Left languages when required.
5. **Fallback Language**: Set a reliable fallback locale (e.g. `uz` or `en`) if key is missing.
