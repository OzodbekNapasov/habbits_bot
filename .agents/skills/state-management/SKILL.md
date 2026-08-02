---
name: state-management
description: Client-side state management patterns, Zustand, Redux Toolkit, and optimistic UI updates.
---

# State Management Skill

## Guidelines
1. **Local vs Global**: Keep transient component state local; elevate to global store only when shared.
2. **Immutability**: Avoid mutating state objects directly; return new copies or use Immer.
3. **Optimistic Updates**: Update UI immediately on user action and rollback on server error.
4. **State Normalization**: Normalize complex nested objects by ID to avoid duplicate data.
5. **Selectors**: Use memoized selectors to prevent unnecessary re-renders.
