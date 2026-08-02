---
name: cron-job-scheduling
description: Background cron job setup, node-cron scheduling, and timezone management.
---

# Cron Job Scheduling Skill

## Guidelines
1. **Timezone Awareness**: Always specify explicit timezones (e.g. `Asia/Tashkent`) when scheduling.
2. **Execution Locking**: Prevent overlapping job runs using concurrency flags or locks.
3. **Error Isolation**: Wrap job execution bodies in `try/catch` blocks to keep cron process running.
4. **Logging**: Log start time, duration, and completion status of scheduled jobs.
5. **Serverless Cron**: Use external ping services or platform cron (Vercel Cron) in serverless setups.
