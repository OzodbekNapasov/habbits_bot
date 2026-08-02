---
name: api-rate-limiting
description: Rate limiting strategies (token bucket, sliding window), middleware, and status headers.
---

# API Rate Limiting Skill

## Guidelines
1. **Sliding Window**: Implement sliding window counter for precise rate limiting.
2. **Identification**: Rate limit by IP address, user ID, or API token.
3. **Standard Headers**: Return `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers.
4. **429 Too Many Requests**: Return status `429` with a human-readable retry message when limit is exceeded.
5. **Distributed Storage**: Use Redis for rate limit counters across multiple server nodes.
