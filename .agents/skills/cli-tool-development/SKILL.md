---
name: cli-tool-development
description: Building CLI utilities with Node.js, Commander/Yargs, interactive prompts, and terminal styling.
---

# CLI Tool Development Skill

## Guidelines
1. **Executable Shebang**: Add `#!/usr/bin/env node` at top of CLI entry points.
2. **Clean Argument Parsing**: Use Commander or Yargs to parse flags (`--help`, `--version`, `-v`).
3. **Interactive Prompts**: Use Inquirer or Enquirer for interactive multi-choice prompts.
4. **Terminal Styling**: Format output cleanly using Chalk/Picocolors and spinners (Ora).
5. **Exit Codes**: Exit with code `0` on success and non-zero (e.g. `1`) on execution failures.
