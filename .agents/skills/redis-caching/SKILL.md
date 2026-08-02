---
name: redis-caching
description: Redis caching strategies, rate limiting, pub/sub messaging, and cache invalidation.
---

# Redis Caching Skill

## Guidelines
1. **TTL Expiration**: Always set a Time-To-Live (TTL) on cached items to prevent memory bloat.
2. **Key Namespacing**: Use structured key names with colons (e.g. `user:100:profile`).
3. **Cache Invalidation**: Invalidate or update relevant cache keys on data mutation.
4. **Connection Resilience**: Handle connection errors gracefully without breaking core application flow.
5. **Atomic Operations**: Use Redis transactions (`MULTI`/`EXEC`) or Lua scripts for atomic updates.
