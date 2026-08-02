---
name: memory-leak-debugging
description: Heap snapshot inspection, memory leak identification, garbage collection, and cleanup.
---

# Memory Leak Debugging Skill

## Guidelines
1. **Identify Unbounded Arrays**: Watch out for growing global arrays, caches, or event listeners.
2. **Clear Intervals & Timeouts**: Always call `clearInterval()` and `clearTimeout()` when jobs complete.
3. **Remove Event Listeners**: Call `emitter.removeListener()` or use `AbortController`.
4. **Heap Snapshots**: Take heap snapshots before and after operations using Chrome DevTools or Node inspector.
5. **WeakMap & WeakSet**: Use `WeakMap`/`WeakSet` for object metadata caching to allow garbage collection.
