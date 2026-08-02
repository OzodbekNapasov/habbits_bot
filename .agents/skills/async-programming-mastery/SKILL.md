---
name: async-programming-mastery
description: Promise management, async/await patterns, event emitters, streams, and concurrency limits.
---

# Async Programming Mastery Skill

## Guidelines
1. **Always Await Promises**: Avoid floating promises that lead to unhandled rejections.
2. **Parallel Concurrency**: Use `Promise.allSettled()` when operating on batch items where partial success is acceptable.
3. **Async Iteration**: Use `for await (... of ...)` for stream reading or paginated async loops.
4. **Event Emitter Safety**: Remove event listeners when components unmount or complete.
5. **AbortController**: Pass `AbortSignal` to cancel long-running HTTP fetches or timeouts.
