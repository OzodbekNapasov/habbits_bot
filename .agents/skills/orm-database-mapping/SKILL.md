---
name: orm-database-mapping
description: Prisma, Drizzle ORM, TypeORM schema setup, relations, and type-safe data access.
---

# ORM Database Mapping Skill

## Guidelines
1. **Type Safety**: Leverage ORM type generation for end-to-end type safety.
2. **Explicit Migrations**: Use versioned database migrations rather than auto-syncing schemas in production.
3. **Relation Loading**: Select only required fields rather than pulling full object graphs.
4. **Connection Lifecycle**: Manage singleton ORM client instances across serverless executions.
5. **Raw Queries**: Fall back to raw SQL when complex queries cannot be optimized by ORM abstraction.
