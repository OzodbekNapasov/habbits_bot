---
name: graphql-api
description: GraphQL schema design, query resolvers, DataLoader batching, and performance tuning.
---

# GraphQL API Skill

## Guidelines
1. **Schema First**: Define clear GraphQL types, inputs, and mutations in SDL.
2. **DataLoader**: Use DataLoader to batch and cache database requests to eliminate N+1 queries.
3. **Query Depth Limiting**: Enforce query complexity and depth limits to prevent DoS attack vectors.
4. **Clear Mutations**: Design explicit input types for mutations and return payload types.
5. **Error Formatting**: Sanitize internal server error stack traces in production responses.
