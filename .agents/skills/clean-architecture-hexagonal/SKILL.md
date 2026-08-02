---
name: clean-architecture-hexagonal
description: Clean architecture, domain-driven design, separation of concerns, and ports & adapters.
---

# Clean Architecture Skill

## Guidelines
1. **Independence of Frameworks**: Business logic must not depend on UI or web framework details.
2. **Domain Model**: Keep core business rules isolated inside entity objects.
3. **Use Cases**: Encapsulate application workflow logic inside dedicated use-case services.
4. **Interface Segregation**: Define interfaces (ports) for repositories and external services.
5. **Dependency Rule**: Dependencies only point inwards towards domain concepts.
