---
name: regex-pattern-matching
description: Regular expression optimization, input validation patterns, and safe regex usage.
---

# Regex Pattern Matching Skill

## Guidelines
1. **Avoid Catastrophic Backtracking**: Test regex patterns against long inputs to prevent ReDoS vulnerability.
2. **Anchoring**: Use `^` and `$` to anchor regex patterns when validating full string formats.
3. **Named Capture Groups**: Use `(?<name>pattern)` for self-documenting Regex group extractions.
4. **RegExp Compilation**: Pre-compile `new RegExp()` instances outside hot execution loops.
5. **Test Utility**: Use Regex101 to verify regex patterns against diverse test strings.
