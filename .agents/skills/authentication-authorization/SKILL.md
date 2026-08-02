---
name: authentication-authorization
description: JWT, OAuth2, session management, RBAC, password hashing, and token handling.
---

# Authentication & Authorization Skill

## Guidelines
1. **Secure Hashing**: Use `argon2` or `bcrypt` with strong salt rounds for password storage.
2. **JWT Best Practices**: Sign JWTs with strong secrets, set short expiration times, and verify algorithm.
3. **Role-Based Access Control**: Enforce authorization checks at the route/service level.
4. **HttpOnly Cookies**: Store refresh tokens in HttpOnly, SameSite, Secure cookies.
5. **Token Invalidation**: Implement token revocation/blacklisting mechanisms.
