---
name: env-config-management
description: Secure environment variable management, schema validation with Zod/Joi, and defaults.
---

# Environment Config Management Skill

## Guidelines
1. **Strict Validation**: Validate all environment variables at startup using a schema.
2. **Type-Safe Config**: Expose a typed configuration object across the codebase.
3. **Example Config File**: Maintain an up-to-date `.env.example` without real secrets.
4. **Fallback Defaults**: Provide safe default values for non-critical config parameters.
5. **Zero Exposure**: Ensure `.env` files are listed in `.gitignore`.
