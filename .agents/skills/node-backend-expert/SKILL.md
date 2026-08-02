---
name: node-backend-expert
description: Enterprise Node.js backend development, architecture, event loop management, and asynchronous I/O patterns.
---

# Node Backend Expert Skill

## Principles
1. **Non-Blocking I/O**: Avoid synchronous methods (`readFileSync`, `execSync`) on hot execution paths to prevent blocking the event loop.
2. **Graceful Shutdown**: Intercept `SIGINT` and `SIGTERM` signals to close active server listeners, database pools, and clear timers.
3. **Stream Processing**: Use Node.js streams (`pipe`, `pipeline`) for reading/writing large datasets and files to keep memory footprint low.
4. **Environment Configuration**: Validate all `process.env` variables at server boot time before handling incoming traffic.
5. **Modular Architecture**: Separate routing/controller layer, business logic/service layer, and data access layer.
