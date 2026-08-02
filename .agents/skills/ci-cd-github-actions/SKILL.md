---
name: ci-cd-github-actions
description: Automated CI/CD pipelines with GitHub Actions, testing, linting, and deployment.
---

# CI/CD GitHub Actions Skill

## Guidelines
1. **Automated Checks**: Run linting, type-checking (`tsc`), and unit tests on every Pull Request.
2. **Caching Dependencies**: Use `actions/setup-node` with package manager caching (`npm`/`pnpm`/`yarn`).
3. **Secret Protection**: Store tokens and keys in GitHub Repository Secrets.
4. **Matrix Testing**: Test across multiple Node.js runtime versions if publishing packages.
5. **Fast Pipeline**: Keep build steps parallelized for quick feedback loops.
