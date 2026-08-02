---
name: dependency-injection
description: Dependency Injection (DI) and Inversion of Control (IoC) in TypeScript/Node.js apps.
---

# Dependency Injection Skill

## Guidelines
1. **Constructor Injection**: Pass dependent services into constructors rather than importing singletons.
2. **Interface Abstraction**: Depend upon interfaces/abstract classes rather than concrete implementations.
3. **Easier Mocking**: DI allows effortless swapping of real database repositories with in-memory mocks.
4. **IoC Containers**: Use lightweight IoC containers (e.g. Awilix, TSyringe) for complex object graphs.
5. **Lifecycle Management**: Define singleton vs transient lifetimes clearly.
