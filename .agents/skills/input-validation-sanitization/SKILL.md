---
name: input-validation-sanitization
description: Input validation schemas using Zod/Joi, sanitization, and request payload checks.
---

# Input Validation & Sanitization Skill

## Guidelines
1. **Schema Validation**: Validate all incoming HTTP payloads, query params, and route params using Zod.
2. **String Trimming**: Trim whitespace and normalize strings prior to database storage.
3. **Type Coercion**: Safely coerce strings to numbers or dates with fallback checks.
4. **Sanitize HTML**: Strip dangerous HTML tags and scripts using DOMPurify or sanitize-html.
5. **Clear Error Messages**: Return precise validation error messages mapping to failed fields.
