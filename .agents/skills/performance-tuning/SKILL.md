---
name: performance-tuning
description: Memory leak prevention, event loop monitoring, bundle optimization, and code execution speedups.
---

# Performance Tuning Skill

## Guidelines
1. **Event Loop Non-Blocking**: Offload CPU-heavy tasks to worker threads or background processes.
2. **Memory Profiling**: Monitor heap usage and clean up global event listeners and timers.
3. **Caching**: Store frequently queried read-only data in memory or Redis cache.
4. **Async Optimization**: Use `Promise.all()` for parallel independent async operations.
5. **Lightweight Dependencies**: Prefer native APIs and minimal utility libraries over heavy dependencies.
