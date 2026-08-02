---
name: logging-monitoring
description: Structured logging (Pino/Winston), log formatting, levels, and error tracking.
---

# Logging & Monitoring Skill

## Guidelines
1. **Structured JSON Logs**: Log in JSON format for easy parsing and log aggregator ingestion.
2. **Appropriate Log Levels**: Use `debug`, `info`, `warn`, and `error` correctly.
3. **No Sensitive Data**: Sanitize passwords, auth tokens, and personal data from logs.
4. **Request Tracing**: Attach unique correlation IDs to trace logs across HTTP requests.
5. **Performance Impact**: Keep loggers fast and non-blocking.
