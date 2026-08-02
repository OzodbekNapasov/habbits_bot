---
name: database-optimization
description: SQL & NoSQL database performance optimization, indexing strategies, transaction handling, and query tuning.
---

# Database Optimization Skill

## Core Rules
1. **Indexing**: Ensure all foreign keys, query filter fields, and `ORDER BY` columns are indexed properly.
2. **Parameterized Queries**: Always use prepared statements/parameterized args (`?` or `$1`) to prevent SQL injection and enable query plan caching.
3. **Transaction Safety**: Wrap multi-table updates in transactions (`BEGIN ... COMMIT`) to guarantee ACID compliance and avoid partial writes.
4. **N+1 Query Prevention**: Batch queries or use JOINs / eager loading to prevent executing N queries inside loops.
5. **Connection Pooling**: Use managed connection pools with appropriate min/max connection limits for cloud databases (Turso, Postgres, MySQL).
