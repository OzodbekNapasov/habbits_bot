---
name: fullstack-debugging
description: Systematic fullstack debugging techniques, root cause analysis, stack traces, and log inspection.
---

# Fullstack Debugging Skill

## Guidelines
1. **Read Log Traces First**: Never guess root causes; read exact error messages and line numbers.
2. **Isolate Component**: Determine whether failure occurs in frontend UI, HTTP network layer, or database.
3. **Minimal Reproducible Example**: Isolate failing logic into a minimal test case.
4. **Inspect Data Types**: Log `typeof` and `JSON.stringify()` to catch type mismatches.
5. **Verify Fix**: Run automated tests and build commands to confirm bug resolution.
