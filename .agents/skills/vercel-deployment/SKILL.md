---
name: vercel-deployment
description: Vercel serverless deployment, routing, edge functions, and environment configuration.
---

# Vercel Deployment Skill

## Guidelines
1. **Serverless Functions**: Export clean default request/response handlers in `api/` directory.
2. **Stateless Operations**: Serverless functions must remain stateless; rely on database for persistence.
3. **vercel.json Routing**: Configure static files, API routes, and fallbacks cleanly in `vercel.json`.
4. **Cold Start Minimization**: Keep dependencies lean in `api/` entry points.
5. **Environment Variables**: Configure secrets in Vercel project settings.
