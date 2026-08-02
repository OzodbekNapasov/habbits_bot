---
name: error-handling-resilience
description: Fault tolerance, robust exception handling, retry policies, fallback logic, and application crash prevention.
---

# Error Handling & Resilience Skill

## Principles
1. **Global Unhandled Catching**: Always register handlers for `uncaughtException` and `unhandledRejection` to log errors safely before exit.
2. **Never Swallow Errors**: Avoid empty `catch {}` blocks. Always log or handle thrown exceptions explicitly.
3. **Exponential Backoff Retry**: When calling network services or external APIs, use exponential backoff retries with jitter.
4. **Graceful Fallbacks**: Return default fallback values or user-friendly messages when non-critical sub-services fail.
5. **Contextual Errors**: Include relevant metadata (user ID, request path, parameters) in error logs for rapid debugging.
