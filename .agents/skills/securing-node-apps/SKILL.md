---
name: securing-node-apps
description: Node.js security best practices, input sanitization, rate limiting, and environment variable protection.
---

# Securing Node Applications Skill

## Guidelines
1. **Environment Protection**: Never commit secrets or API tokens to git repository. Use .env and dotenv.
2. **Input Sanitization**: Sanitize all user inputs to prevent XSS, command injection, and SQL injection.
3. **Rate Limiting**: Protect endpoints against brute-force and DoS attacks using rate limiters.
4. **Security Headers**: Use Helmet or set CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers.
5. **Dependency Audit**: Routinely run `npm audit` to fix vulnerable packages.
