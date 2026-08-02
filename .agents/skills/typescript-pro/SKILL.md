---
name: typescript-pro
description: Advanced TypeScript patterns, strict type safety, utility types, and performance optimization guidelines.
---

# TypeScript Pro Skill

## Guidelines
1. **Strict Type Safety**: Enable `strict: true` in `tsconfig.json`. Avoid `any` type; use `unknown`, generics, or union types.
2. **Type Assertions**: Minimize `as` assertions. Prefer type guards (`is` functions) and assertion functions.
3. **Immutability**: Use `readonly` arrays and properties where state mutations should be prevented.
4. **Utility Types**: Leverage `Partial<T>`, `Required<T>`, `Pick<T, K>`, `Omit<T, K>`, and `Record<K, T>` for flexible type transformations.
5. **Nullish Coalescing & Optional Chaining**: Use `??` and `?.` instead of verbose conditional checks.
