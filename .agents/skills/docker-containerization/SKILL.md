---
name: docker-containerization
description: Multi-stage Dockerfiles, docker-compose configuration, and container deployment.
---

# Docker Containerization Skill

## Guidelines
1. **Multi-Stage Builds**: Separate build phase from runtime image to produce minimal production containers.
2. **Non-Root User**: Run container processes under non-root users (`node`) for security.
3. **.dockerignore**: Exclude `node_modules`, `.git`, and local secrets from container context.
4. **Layer Caching**: Copy `package.json` before `npm install` to leverage layer caching.
5. **Healthchecks**: Include HEALTHCHECK instructions for container orchestration.
